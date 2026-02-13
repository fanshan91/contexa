'use server';

import crypto from 'node:crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getProjectPermissionChecker } from '@/lib/auth/project-permissions-server';
import { env } from '@/lib/env';
import { applyRuntimeDiffViaEnhanced, getEnhancedSystemStatus, heartbeatEnhanced } from '@/lib/enhanced/client';
import { decryptRuntimeToken, encryptRuntimeToken, generateRuntimeToken, hashRuntimeToken } from '@/lib/runtime/token';
import { computeDiffType, runtimeCaptureApplyRunV2, runtimeCaptureItemV2, runtimeCaptureRouteStatV2, runtimeCaptureSessionV2 } from '@/lib/runtime/capture-v2';

const ROOT_MODULE_NAME = '__root__';
const db = prisma as any;
const runtimeKeyAggregate = (prisma as any).runtimeKeyAggregate;

function parsePositiveIntEnv(raw: string | undefined, fallback: number) {
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function ensureRuntimeAggregate() {
  if (!runtimeKeyAggregate) {
    throw new Error('runtime_aggregate_unavailable');
  }
}

function rethrowNextNavigationError(error: unknown) {
  const digest = (error as any)?.digest;
  if (typeof digest === 'string' && (digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_NOT_FOUND'))) {
    throw error;
  }
}

function isDatabaseNotReadyError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2021' || error.code === 'P2022');
}

function runtimeV2NotReadyMessage() {
  return '运行时采集 V2 数据未初始化：请先执行数据库迁移（prisma migrate deploy），并重启服务进程。';
}

export type RuntimeSyncTopStatus = 'not_detected' | 'not_connected' | 'connected' | 'error' | 'expired';

export type RuntimeTokenInfo = {
  token: string;
  enabled: boolean;
  expiresAt: string | null;
  createdAt: string;
  rotatedAt: string;
  lastUsedAt: string | null;
};

export type RuntimeEventRow = {
  route: string;
  key: string;
  sourceText: string;
  entrySourceText: string | null;
  entrySourceLocale: string | null;
  count: number;
  lastSeenAt: string;
  diffType: 'new_key' | 'text_changed' | 'none';
  attention: boolean;
  attentionReason: 'missing_page' | 'unregistered' | 'unbound' | 'text_changed' | 'ok';
  pageId: number | null;
  pageTitle: string | null;
  moduleId: number | null;
  moduleName: string | null;
  entryId: number | null;
};

export type RuntimeEventsPage = {
  page: number;
  pageSize: number;
  total: number;
  items: RuntimeEventRow[];
  lastReportedAt: string | null;
};

export type RuntimeUnsavedSession = {
  session: {
    id: number;
    status: string;
    sdkIdentity: string | null;
    env: string | null;
    startedAt: string;
    lastSeenAt: string | null;
  };
  collectedKeys: number;
  workspaceReady: boolean;
};

export type RuntimeSyncBootstrap = {
  status: RuntimeSyncTopStatus;
  enhancedConnected: boolean;
  enhancedLicenseStatus: string;
  token: RuntimeTokenInfo | null;
  canManage: boolean;
  isSystemAdmin: boolean;
  sourceLocale: string;
  targetLocales: string[];
  defaultTargetLocale: string | null;
  unsavedSession: RuntimeUnsavedSession | null;
  events: RuntimeEventsPage;
};

async function getProjectLocales(projectId: number) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { locales: true }
  });
  if (!project) return null;
  return { sourceLocale: project.sourceLocale, locales: project.locales.map((l) => l.locale) };
}

function resolveTopStatus(input: {
  enhancedConnected: boolean;
  licenseStatus: string;
}): RuntimeSyncTopStatus {
  if (!input.enhancedConnected) return 'not_detected';
  if (input.licenseStatus === 'expired') return 'expired';
  if (input.licenseStatus === 'locked') return 'error';
  if (input.licenseStatus === 'unactivated') return 'not_connected';
  return 'connected';
}

async function getRuntimeTokenInfo(projectId: number): Promise<RuntimeTokenInfo | null> {
  const tokenModel = db.projectRuntimeToken as any;
  if (!tokenModel) return null;
  const row = await tokenModel.findUnique({
    where: { projectId }
  });
  if (!row) return null;
  return {
    token: decryptRuntimeToken(row.tokenEnc),
    enabled: row.enabled,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    rotatedAt: row.rotatedAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null
  };
}

type EnhancedRuntimeAggRow = {
  route: string;
  key: string;
  sourceText: string;
  count: number;
  lastSeenAt: string;
  lastSessionId: number | null;
};

async function hydrateRuntimeEvents(input: {
  projectId: number;
  enhancedItems: EnhancedRuntimeAggRow[];
}) {
  const routes = Array.from(new Set(input.enhancedItems.map((i) => i.route).filter(Boolean)));
  const keys = Array.from(new Set(input.enhancedItems.map((i) => i.key).filter(Boolean)));

  const [pages, entries] = await Promise.all([
    routes.length
      ? prisma.page.findMany({
          where: { projectId: input.projectId, route: { in: routes } },
          select: { id: true, route: true, title: true }
        })
      : Promise.resolve([]),
    keys.length
      ? prisma.entry.findMany({
          where: { projectId: input.projectId, key: { in: keys } },
          select: {
            id: true,
            key: true,
            sourceText: true,
            sourceLocale: true,
            placements: {
              select: {
                moduleId: true,
                module: { select: { name: true, pageId: true, page: { select: { route: true } } } }
              }
            }
          }
        })
      : Promise.resolve([])
  ]);

  const pageByRoute = new Map(pages.map((p) => [p.route, p] as const));
  const entryByKey = new Map(entries.map((e) => [e.key, e] as const));

  const out: RuntimeEventRow[] = input.enhancedItems.map((it) => {
    const page = pageByRoute.get(it.route) ?? null;
    const entry = entryByKey.get(it.key) ?? null;

    const placementOnPage =
      page && entry
        ? entry.placements.find((p) => p.module.pageId === page.id) ?? null
        : null;

    const structuralReason: RuntimeEventRow['attentionReason'] = !page
      ? 'missing_page'
      : !entry
        ? 'unregistered'
        : !placementOnPage
          ? 'unbound'
          : 'ok';
    const diffType = computeDiffType(it.sourceText, entry?.sourceText ?? null);
    const attentionReason: RuntimeEventRow['attentionReason'] =
      structuralReason !== 'ok' ? structuralReason : diffType === 'text_changed' ? 'text_changed' : 'ok';

    return {
      route: it.route,
      key: it.key,
      sourceText: it.sourceText,
      entrySourceText: entry?.sourceText ?? null,
      entrySourceLocale: entry?.sourceLocale ?? null,
      count: it.count,
      lastSeenAt: it.lastSeenAt,
      diffType,
      attention: structuralReason !== 'ok',
      attentionReason,
      pageId: page?.id ?? null,
      pageTitle: page?.title ?? null,
      moduleId: placementOnPage?.moduleId ?? null,
      moduleName: placementOnPage?.module?.name ?? null,
      entryId: entry?.id ?? null
    };
  });

  const lastReportedAt = input.enhancedItems[0]?.lastSeenAt ?? null;
  return { items: out, lastReportedAt };
}

export async function getRuntimeSyncBootstrapQuery(projectId: number): Promise<
  | { ok: true; data: RuntimeSyncBootstrap }
  | { ok: false; error: string }
> {
  try {
    const { can, user } = await getProjectPermissionChecker(projectId, true);
    const canManage = can(['admin', 'creator']);

    const localeConfig = await getProjectLocales(projectId);
    if (!localeConfig) return { ok: false, error: '项目不存在' };
    const targetLocales = localeConfig.locales.filter((l) => l !== localeConfig.sourceLocale);
    const defaultTargetLocale = targetLocales.length ? (targetLocales.includes('en') ? 'en' : targetLocales[0]!) : null;

    const enhanced = await getEnhancedSystemStatus();
    const enhancedConnected = enhanced.connected === true;
    const topStatus = resolveTopStatus({
      enhancedConnected,
      licenseStatus: enhanced.licenseStatus
    });

    const token = await getRuntimeTokenInfo(projectId);

    const workspaceReady = Boolean(runtimeCaptureSessionV2 && runtimeCaptureItemV2);
    const activeSession = workspaceReady
      ? await runtimeCaptureSessionV2.findFirst({
      where: { projectId, status: { in: ['active', 'closing'] } },
      orderBy: { startedAt: 'desc' },
      select: { id: true, status: true, sdkIdentity: true, env: true, startedAt: true, lastSeenAt: true }
        })
      : null;
    const collectedKeys =
      workspaceReady && activeSession?.id
        ? await runtimeCaptureItemV2.count({ where: { projectId, sessionId: activeSession.id } })
        : 0;

    const aggregates = workspaceReady
      ? ((await runtimeCaptureItemV2.findMany({
          where: { projectId },
          orderBy: { lastSeenAt: 'desc' },
          take: 20
        })) as Array<{ route: string; key: string; lastSourceText: string; seenCount: number; lastSeenAt: Date; sessionId: number }>)
      : [];
    const total = workspaceReady ? ((await runtimeCaptureItemV2.count({ where: { projectId } })) as number) : 0;
    const enhancedItems: EnhancedRuntimeAggRow[] = aggregates.map((row: any) => ({
      route: String(row.route),
      key: String(row.key),
      sourceText: String(row.lastSourceText),
      count: Number(row.seenCount),
      lastSeenAt: new Date(row.lastSeenAt).toISOString(),
      lastSessionId: typeof row.sessionId === 'number' ? row.sessionId : null
    }));
    const hydrated = await hydrateRuntimeEvents({
      projectId,
      enhancedItems
    });
    return {
      ok: true,
      data: {
        status: topStatus,
        enhancedConnected,
        enhancedLicenseStatus: enhanced.licenseStatus,
        token,
        canManage,
        isSystemAdmin: user.isSystemAdmin,
        sourceLocale: localeConfig.sourceLocale,
        targetLocales,
        defaultTargetLocale,
        unsavedSession: activeSession
          ? {
              session: {
                id: activeSession.id,
                status: activeSession.status,
                sdkIdentity: activeSession.sdkIdentity ?? null,
                env: activeSession.env ?? null,
                startedAt: activeSession.startedAt.toISOString(),
                lastSeenAt: activeSession.lastSeenAt ? activeSession.lastSeenAt.toISOString() : null
              },
              collectedKeys,
              workspaceReady
            }
          : null,
        events: {
          page: 1,
          pageSize: 20,
          total,
          items: hydrated.items,
          lastReportedAt: hydrated.lastReportedAt
        }
      }
    };
  } catch (error) {
    rethrowNextNavigationError(error);
    if (isDatabaseNotReadyError(error)) {
      return { ok: false, error: runtimeV2NotReadyMessage() };
    }
    const debugId = crypto.randomUUID();
    console.error('runtimeSync bootstrap failed', { debugId, projectId }, error);
    if (error instanceof Error && (error.message === 'runtime_aggregate_unavailable' || error.message === 'runtime_capture_v2_unavailable')) {
      return { ok: false, error: '运行时同步数据未初始化，请先执行数据库迁移' };
    }
    if (process.env.NODE_ENV !== 'production' && error instanceof Error && error.message) {
      const detail = String(error.message).split('\n')[0]?.slice(0, 200) ?? '';
      return { ok: false, error: `请求失败：${detail} (debugId: ${debugId})` };
    }
    return { ok: false, error: `请求失败 (debugId: ${debugId})` };
  }
}

const listSchema = z.object({
  projectId: z.number().int().positive(),
  search: z.string().trim().max(200).optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  onlyDiff: z.boolean().default(true),
  route: z.string().trim().min(1).max(200).optional()
});

export async function listRuntimeEventsQuery(input: z.infer<typeof listSchema>): Promise<
  | { ok: true; data: RuntimeEventsPage }
  | { ok: false; error: string }
> {
  try {
    const parsed = listSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

    await getProjectPermissionChecker(parsed.data.projectId);
    if (!runtimeCaptureItemV2) {
      return { ok: true, data: { page: parsed.data.page, pageSize: parsed.data.pageSize, total: 0, items: [], lastReportedAt: null } };
    }

    const where: any = {
      projectId: parsed.data.projectId
    };
    if (parsed.data.route?.trim()) {
      where.route = parsed.data.route.trim();
    }
    if (parsed.data.search?.trim()) {
      const q = parsed.data.search.trim();
      const entryMatches = await prisma.entry.findMany({
        where: { projectId: parsed.data.projectId, sourceText: { contains: q } },
        select: { key: true },
        take: 500
      });
      const entryKeys = entryMatches.map((e) => e.key).filter(Boolean);
      where.OR = [{ key: { contains: q } }, { lastSourceText: { contains: q } }, ...(entryKeys.length ? [{ key: { in: entryKeys } }] : [])];
    }

    const rows = (await runtimeCaptureItemV2.findMany({
      where,
      orderBy: { lastSeenAt: 'desc' },
      skip: (parsed.data.page - 1) * parsed.data.pageSize,
      take: parsed.data.pageSize
    })) as Array<{ route: string; key: string; lastSourceText: string; seenCount: number; lastSeenAt: Date; sessionId: number | null }>;
    const total = (await runtimeCaptureItemV2.count({ where })) as number;

    const enhancedItems: EnhancedRuntimeAggRow[] = rows.map((row: any) => ({
      route: String(row.route),
      key: String(row.key),
      sourceText: String(row.lastSourceText),
      count: Number(row.seenCount),
      lastSeenAt: new Date(row.lastSeenAt).toISOString(),
      lastSessionId: typeof row.sessionId === 'number' ? row.sessionId : null
    }));

    const hydrated = await hydrateRuntimeEvents({
      projectId: parsed.data.projectId,
      enhancedItems
    });

    const items = parsed.data.onlyDiff ? hydrated.items.filter((it) => it.diffType !== 'none') : hydrated.items;

    return {
      ok: true,
      data: {
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        total,
        items,
        lastReportedAt: hydrated.lastReportedAt
      }
    };
  } catch (error) {
    rethrowNextNavigationError(error);
    if (isDatabaseNotReadyError(error)) {
      return { ok: false, error: runtimeV2NotReadyMessage() };
    }
    const debugId = crypto.randomUUID();
    console.error('runtimeSync list events failed', { debugId, input }, error);
    return { ok: false, error: `请求失败 (debugId: ${debugId})` };
  }
}

const listRoutesSchema = z.object({
  projectId: z.number().int().positive(),
  search: z.string().trim().max(200).optional(),
  limit: z.number().int().positive().max(200).default(80)
});

export async function listRuntimeEventRoutesQuery(input: z.infer<typeof listRoutesSchema>): Promise<
  | { ok: true; data: string[] }
  | { ok: false; error: string }
> {
  try {
    const parsed = listRoutesSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

    await getProjectPermissionChecker(parsed.data.projectId);

    if (!runtimeCaptureItemV2) return { ok: true, data: [] };

    const where: any = { projectId: parsed.data.projectId };
    if (parsed.data.search?.trim()) {
      where.route = { contains: parsed.data.search.trim() };
    }

    const rows = (await runtimeCaptureItemV2.findMany({
      where,
      distinct: ['route'],
      orderBy: { lastSeenAt: 'desc' },
      take: parsed.data.limit,
      select: { route: true }
    })) as Array<{ route: string }>;

    return { ok: true, data: rows.map((r) => String(r.route)).filter(Boolean) };
  } catch (error) {
    rethrowNextNavigationError(error);
    if (isDatabaseNotReadyError(error)) {
      return { ok: false, error: runtimeV2NotReadyMessage() };
    }
    const debugId = crypto.randomUUID();
    console.error('runtimeSync list routes failed', { debugId, input }, error);
    return { ok: false, error: `请求失败 (debugId: ${debugId})` };
  }
}

export async function manualReconnectEnhancedAction(projectId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await getProjectPermissionChecker(projectId);
    await heartbeatEnhanced();
    return { ok: true };
  } catch (error) {
    rethrowNextNavigationError(error);
    const debugId = crypto.randomUUID();
    console.error('runtimeSync manual reconnect failed', { debugId, projectId }, error);
    return { ok: false, error: `重连失败 (debugId: ${debugId})` };
  }
}

export async function rotateRuntimeTokenAction(input: {
  projectId: number;
  ttlMonths: 1 | 3 | 6;
}): Promise<{ ok: true; data: RuntimeTokenInfo } | { ok: false; error: string }> {
  try {
    const parsed = z
      .object({ projectId: z.number().int().positive(), ttlMonths: z.union([z.literal(1), z.literal(3), z.literal(6)]) })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

    const { can } = await getProjectPermissionChecker(parsed.data.projectId, true);
    if (!can(['admin', 'creator'])) return { ok: false, error: '无权限执行令牌操作' };

    const token = generateRuntimeToken();
    const tokenEnc = encryptRuntimeToken(token);
    const tokenHash = hashRuntimeToken(token);
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + parsed.data.ttlMonths);

    const tokenModel = db.projectRuntimeToken as any;
    if (!tokenModel) return { ok: false, error: '运行时令牌模型不可用，请先同步数据库客户端' };
    const row = await tokenModel.upsert({
      where: { projectId: parsed.data.projectId },
      update: {
        tokenEnc,
        tokenHash,
        enabled: true,
        rotatedAt: now,
        expiresAt
      },
      create: {
        projectId: parsed.data.projectId,
        tokenEnc,
        tokenHash,
        enabled: true,
        createdAt: now,
        rotatedAt: now,
        expiresAt
      }
    });

    return {
      ok: true,
      data: {
        token,
        enabled: row.enabled,
        expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        rotatedAt: row.rotatedAt.toISOString(),
        lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null
      }
    };
  } catch (error) {
    rethrowNextNavigationError(error);
    if (isDatabaseNotReadyError(error)) {
      return { ok: false, error: runtimeV2NotReadyMessage() };
    }
    const debugId = crypto.randomUUID();
    console.error('runtimeSync rotate token failed', { debugId, input }, error);
    return { ok: false, error: `操作失败 (debugId: ${debugId})` };
  }
}

export async function toggleRuntimeTokenAction(input: {
  projectId: number;
  enabled: boolean;
}): Promise<{ ok: true; data: RuntimeTokenInfo } | { ok: false; error: string }> {
  try {
    const parsed = z.object({ projectId: z.number().int().positive(), enabled: z.boolean() }).safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

    const { can } = await getProjectPermissionChecker(parsed.data.projectId, true);
    if (!can(['admin', 'creator'])) return { ok: false, error: '无权限执行令牌操作' };

    const tokenModel = db.projectRuntimeToken as any;
    if (!tokenModel) return { ok: false, error: '运行时令牌模型不可用，请先同步数据库客户端' };
    const existing = await tokenModel.findUnique({ where: { projectId: parsed.data.projectId } });
    if (!existing) return { ok: false, error: '请先创建令牌' };

    const updated = await tokenModel.update({
      where: { projectId: parsed.data.projectId },
      data: { enabled: parsed.data.enabled }
    });

    return {
      ok: true,
      data: {
        token: decryptRuntimeToken(updated.tokenEnc),
        enabled: updated.enabled,
        expiresAt: updated.expiresAt ? updated.expiresAt.toISOString() : null,
        createdAt: updated.createdAt.toISOString(),
        rotatedAt: updated.rotatedAt.toISOString(),
        lastUsedAt: updated.lastUsedAt ? updated.lastUsedAt.toISOString() : null
      }
    };
  } catch (error) {
    rethrowNextNavigationError(error);
    if (isDatabaseNotReadyError(error)) {
      return { ok: false, error: runtimeV2NotReadyMessage() };
    }
    const debugId = crypto.randomUUID();
    console.error('runtimeSync toggle token failed', { debugId, input }, error);
    return { ok: false, error: `操作失败 (debugId: ${debugId})` };
  }
}

export type ContextPageNode = {
  id: number;
  route: string;
  title: string | null;
  modules: Array<{ id: number; name: string }>;
};

export async function listRuntimeContextNodesQuery(projectId: number): Promise<{ ok: true; data: { pages: ContextPageNode[] } } | { ok: false; error: string }> {
  try {
    await getProjectPermissionChecker(projectId);
    const pages = await prisma.page.findMany({
      where: { projectId },
      orderBy: { route: 'asc' },
      select: {
        id: true,
        route: true,
        title: true,
        modules: {
          where: { name: { not: ROOT_MODULE_NAME } },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true }
        }
      }
    });
    return { ok: true, data: { pages } };
  } catch (error) {
    rethrowNextNavigationError(error);
    const debugId = crypto.randomUUID();
    console.error('runtimeSync list context nodes failed', { debugId, projectId }, error);
    return { ok: false, error: `请求失败 (debugId: ${debugId})` };
  }
}

export type RuntimeDiffItem =
  | {
      kind: 'unregistered';
      key: string;
      sourceText: string;
      suggestedModuleName: string | null;
    }
  | {
      kind: 'add';
      key: string;
      sourceText: string;
      entryId: number;
      suggestedModuleName: string | null;
    }
  | {
      kind: 'move';
      key: string;
      sourceText: string;
      entryId: number;
      current: { moduleId: number; moduleName: string };
      suggestedModuleName: string | null;
    }
  | {
      kind: 'delete_suggestion';
      key: string;
      entryId: number;
      current: { moduleId: number; moduleName: string };
    };

export type RuntimeRouteDiff = {
  route: string;
  page: { id: number; title: string | null } | null;
  sdkKeysTotal: number;
  items: RuntimeDiffItem[];
  summary: { routeCount: number; added: number; moved: number; deleteSuggested: number; total: number };
};

function computeRuntimeDiffLocal(input: {
  sdkKeys: Array<{ key: string; sourceText: string; suggestedModuleName: string | null }>;
  coreEntries: Array<{ key: string; entryId: number }>;
  corePlacements: Array<{ key: string; entryId: number; moduleId: number; moduleName: string }>;
}) {
  const entryIdByKey = new Map<string, number>();
  for (const it of input.coreEntries) {
    entryIdByKey.set(it.key, it.entryId);
  }
  for (const it of input.corePlacements) {
    if (!entryIdByKey.has(it.key)) entryIdByKey.set(it.key, it.entryId);
  }

  const sdkByKey = new Map<string, { sourceText: string; suggestedModuleName: string | null }>();
  for (const s of input.sdkKeys) {
    const key = s.key.trim();
    if (!key) continue;
    sdkByKey.set(key, {
      sourceText: s.sourceText,
      suggestedModuleName: s.suggestedModuleName ?? null
    });
  }

  const currentByKey = new Map<string, { entryId: number; moduleId: number; moduleName: string }>();
  for (const c of input.corePlacements) {
    if (!currentByKey.has(c.key)) {
      currentByKey.set(c.key, {
        entryId: c.entryId,
        moduleId: c.moduleId,
        moduleName: c.moduleName
      });
    }
  }

  const items: RuntimeDiffItem[] = [];
  let addCount = 0;
  let moveCount = 0;
  let deleteCount = 0;

  for (const [key, sdk] of sdkByKey.entries()) {
    const entryId = entryIdByKey.get(key) ?? null;
    const current = currentByKey.get(key) ?? null;
    const suggestedModuleName = sdk.suggestedModuleName ?? null;

    if (!entryId) {
      items.push({
        kind: 'unregistered',
        key,
        sourceText: sdk.sourceText,
        suggestedModuleName
      });
      addCount += 1;
      continue;
    }

    if (!current) {
      items.push({
        kind: 'add',
        key,
        sourceText: sdk.sourceText,
        entryId,
        suggestedModuleName
      });
      addCount += 1;
      continue;
    }

    if (suggestedModuleName && suggestedModuleName !== current.moduleName) {
      items.push({
        kind: 'move',
        key,
        sourceText: sdk.sourceText,
        entryId,
        current: { moduleId: current.moduleId, moduleName: current.moduleName },
        suggestedModuleName
      });
      moveCount += 1;
    }
  }

  for (const [key, current] of currentByKey.entries()) {
    if (sdkByKey.has(key)) continue;
    items.push({
      kind: 'delete_suggestion',
      key,
      entryId: current.entryId,
      current: { moduleId: current.moduleId, moduleName: current.moduleName }
    });
    deleteCount += 1;
  }

  return {
    items,
    summary: {
      routeCount: 1,
      added: addCount,
      moved: moveCount,
      deleteSuggested: deleteCount,
      total: items.length
    }
  };
}

export async function getRuntimeRouteDiffQuery(input: {
  projectId: number;
  route: string;
}): Promise<{ ok: true; data: RuntimeRouteDiff } | { ok: false; error: string }> {
  try {
    const parsed = z.object({ projectId: z.number().int().positive(), route: z.string().trim().min(1).max(200) }).safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

    await getProjectPermissionChecker(parsed.data.projectId);

    const sdkItems = (await db.runtimeKeyAggregate.findMany({
      where: { projectId: parsed.data.projectId, route: parsed.data.route },
      orderBy: { lastSeenAt: 'desc' },
      take: 2000
    })) as Array<{ key: string; sourceText: string }>;
    const keys = sdkItems.map((i: any) => i.key).filter(Boolean);
    const page = await prisma.page.findFirst({
      where: { projectId: parsed.data.projectId, route: parsed.data.route },
      select: { id: true, title: true }
    });

    const existingEntries = keys.length
      ? await prisma.entry.findMany({
          where: { projectId: parsed.data.projectId, key: { in: keys } },
          select: { id: true, key: true }
        })
      : [];
    const entryIdByKey = new Map(existingEntries.map((e) => [e.key, e.id] as const));

    const coreEntries = existingEntries.map((e) => ({ key: e.key, entryId: e.id }));
    const entryIds = existingEntries.map((e) => e.id);

    const corePlacements =
      page && entryIds.length
        ? (
            await prisma.entryPlacement.findMany({
              where: { entryId: { in: entryIds }, module: { pageId: page.id } },
              select: {
                entry: { select: { key: true, id: true } },
                module: { select: { id: true, name: true } }
              }
            })
          ).map((p) => ({
            key: p.entry.key,
            entryId: p.entry.id,
            moduleId: p.module.id,
            moduleName: p.module.name
          }))
        : [];

    const diff = computeRuntimeDiffLocal({
      sdkKeys: sdkItems.map((s: any) => ({
        key: String(s.key),
        sourceText: String(s.sourceText),
        suggestedModuleName: null
      })),
      coreEntries,
      corePlacements
    });

    return {
      ok: true,
      data: {
        route: parsed.data.route,
        page: page ? { id: page.id, title: page.title } : null,
        sdkKeysTotal: keys.length,
        items: diff.items as any,
        summary: diff.summary as any
      }
    };
  } catch (error) {
    const debugId = crypto.randomUUID();
    console.error('runtimeSync get route diff failed', { debugId, input }, error);
    return { ok: false, error: `请求失败 (debugId: ${debugId})` };
  }
}

export async function createRuntimePageAction(input: {
  projectId: number;
  route: string;
  title?: string;
  moduleName?: string;
}): Promise<{ ok: true; data: { pageId: number; moduleId: number | null } } | { ok: false; error: string }> {
  try {
    const parsed = z
      .object({
        projectId: z.number().int().positive(),
        route: z.string().trim().min(1).max(200),
        title: z.string().trim().max(200).optional(),
        moduleName: z.string().trim().max(200).optional()
      })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

    const { can } = await getProjectPermissionChecker(parsed.data.projectId, true);
    if (!can(['admin', 'creator'])) return { ok: false, error: '无权限执行新增操作' };

    const existing = await prisma.page.findFirst({
      where: { projectId: parsed.data.projectId, route: parsed.data.route },
      select: { id: true }
    });
    if (existing) return { ok: true, data: { pageId: existing.id, moduleId: null } };

    const created = await prisma.page.create({
      data: {
        projectId: parsed.data.projectId,
        route: parsed.data.route,
        title: parsed.data.title?.trim() ? parsed.data.title.trim() : null,
        description: null
      },
      select: { id: true }
    });

    let moduleId: number | null = null;
    if (parsed.data.moduleName?.trim()) {
      const mod = await prisma.module.create({
        data: { pageId: created.id, name: parsed.data.moduleName.trim(), description: null },
        select: { id: true }
      });
      moduleId = mod.id;
    }

    return { ok: true, data: { pageId: created.id, moduleId } };
  } catch (error: any) {
    if (error?.code === 'P2002') return { ok: false, error: '页面路由/模块名冲突，请修改后重试。' };
    const debugId = crypto.randomUUID();
    console.error('runtimeSync create page failed', { debugId, input }, error);
    return { ok: false, error: `创建失败 (debugId: ${debugId})` };
  }
}

export async function createRuntimeModuleAction(input: {
  projectId: number;
  pageId: number;
  name: string;
}): Promise<{ ok: true; data: { moduleId: number } } | { ok: false; error: string }> {
  try {
    const parsed = z
      .object({
        projectId: z.number().int().positive(),
        pageId: z.number().int().positive(),
        name: z.string().trim().min(1).max(200)
      })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

    const { can } = await getProjectPermissionChecker(parsed.data.projectId, true);
    if (!can(['admin', 'creator'])) return { ok: false, error: '无权限执行新增操作' };

    const page = await prisma.page.findFirst({
      where: { id: parsed.data.pageId, projectId: parsed.data.projectId },
      select: { id: true }
    });
    if (!page) return { ok: false, error: '页面不存在' };

    const created = await prisma.module.create({
      data: { pageId: page.id, name: parsed.data.name, description: null },
      select: { id: true }
    });

    return { ok: true, data: { moduleId: created.id } };
  } catch (error: any) {
    if (error?.code === 'P2002') return { ok: false, error: '模块名冲突，请修改后重试。' };
    const debugId = crypto.randomUUID();
    console.error('runtimeSync create module failed', { debugId, input }, error);
    return { ok: false, error: `创建失败 (debugId: ${debugId})` };
  }
}

const applySchema = z.object({
  projectId: z.number().int().positive(),
  route: z.string().trim().min(1).max(200),
  operations: z
    .array(
      z.object({
        kind: z.enum(['unregistered', 'add', 'move', 'delete_suggestion']),
        key: z.string().trim().min(1).max(200),
        sourceText: z.string().trim().max(5000).optional(),
        entryId: z.number().int().positive().nullable().optional(),
        currentModuleId: z.number().int().positive().nullable().optional(),
        action: z.enum(['ignore', 'bind', 'delete']),
        targetPageId: z.number().int().positive().nullable().optional(),
        targetModuleId: z.number().int().positive().nullable().optional()
      })
    )
    .max(20_000)
});

export async function applyRuntimeDiffAction(input: z.infer<typeof applySchema>): Promise<{ ok: true } | { ok: false; error: string }> {
  let userId: number | null = null;
  try {
    const parsed = applySchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

    const { user, can } = await getProjectPermissionChecker(parsed.data.projectId, true);
    userId = user.id;
    if (!can(['admin', 'creator'])) return { ok: false, error: '无权限执行保存操作' };

    const res = await applyRuntimeDiffViaEnhanced({
      projectId: parsed.data.projectId,
      route: parsed.data.route,
      coreBaseUrl: env.BASE_URL,
      operations: parsed.data.operations as any
    });
    if (!res.connected) {
      return { ok: false, error: `Enhanced 不可用：${res.reason}` };
    }

    return { ok: true };
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return { ok: false, error: '保存失败：存在重复关系或 key 冲突。' };
    }
    const debugId = crypto.randomUUID();
    console.error('runtimeSync apply diff failed', { debugId, userId }, error);
    return { ok: false, error: `保存失败 (debugId: ${debugId})` };
  }
}

export type RuntimeSessionInfo = {
  id: number;
  status: string;
  sdkIdentity: string | null;
  env: string | null;
  requestedRoute: string | null;
  requestedLocale: string | null;
  startedAt: string;
  lastSeenAt: string | null;
};

export type RuntimeCaptureSessionBootstrap = {
  session: RuntimeSessionInfo | null;
  pendingSession: RuntimeSessionInfo | null;
  gate: {
    open: boolean;
    sessionId: number | null;
    userLastSeenAt: string | null;
    reason: string | null;
    expiresAt: string | null;
    ttlMs: number | null;
  };
  collectedKeys: number;
  lastReportedAt: string | null;
  warnUniqueKeys: number;
  hardUniqueKeys: number;
  nearLimit: boolean;
};

export async function openRuntimeCaptureGateAction(input: {
  projectId: number;
}): Promise<{ ok: true; data: { gateOpen: true; sessionId: number } } | { ok: false; error: string }> {
  void input;
  return {
    ok: false,
    error: '已废弃：采集会话仅可由 SDK 发起。请在应用中启动 SDK 采集后回到此页刷新查看状态。'
  };
}

export async function closeRuntimeCaptureGateAction(input: {
  projectId: number;
}): Promise<{ ok: true; data: { gateOpen: false } } | { ok: false; error: string }> {
  let userId: number | null = null;
  try {
    if (!runtimeCaptureSessionV2) {
      return {
        ok: false,
        error: '运行时采集 V2 未初始化：请先执行 prisma generate + migrate，并重启 next dev 服务进程。'
      };
    }
    const parsed = z.object({ projectId: z.number().int().positive() }).safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

    const { user, can } = await getProjectPermissionChecker(parsed.data.projectId, true);
    userId = user.id;
    if (!can(['admin', 'creator'])) return { ok: false, error: '无权限关闭采集会话' };

    const now = new Date();
    await runtimeCaptureSessionV2.updateMany({
      where: { projectId: parsed.data.projectId, status: 'active' },
      data: { status: 'closed', closeReason: 'forced', closedAt: now }
    });

    return { ok: true, data: { gateOpen: false } };
  } catch (error) {
    rethrowNextNavigationError(error);
    if (isDatabaseNotReadyError(error)) {
      return { ok: false, error: runtimeV2NotReadyMessage() };
    }
    const debugId = crypto.randomUUID();
    console.error('runtimeSync close capture gate failed', { debugId, userId, input }, error);
    return { ok: false, error: `操作失败 (debugId: ${debugId})` };
  }
}

export async function getRuntimeCaptureSessionBootstrapQuery(projectId: number): Promise<
  | { ok: true; data: RuntimeCaptureSessionBootstrap }
  | { ok: false; error: string }
> {
  try {
    await getProjectPermissionChecker(projectId);
    if (!runtimeCaptureSessionV2 || !runtimeCaptureItemV2) {
      return { ok: false, error: '运行时采集 V2 数据未初始化：请先执行 prisma generate + migrate，并重启 next dev 服务进程。' };
    }

    const warnUniqueKeys = parsePositiveIntEnv(process.env.RUNTIME_CAPTURE_SESSION_WARN_UNIQUE_KEYS, 8000);
    const hardUniqueKeys = parsePositiveIntEnv(process.env.RUNTIME_CAPTURE_SESSION_HARD_UNIQUE_KEYS, 10000);

    const [active, latestClosed] = await Promise.all([
      runtimeCaptureSessionV2.findFirst({
        where: { projectId, status: { in: ['active', 'closing'] } },
        orderBy: { startedAt: 'desc' },
        select: { id: true, status: true, sdkIdentity: true, env: true, summaryJson: true, startedAt: true, lastSeenAt: true }
      }),
      runtimeCaptureSessionV2.findFirst({
        where: { projectId, status: { in: ['closed', 'expired'] } },
        orderBy: { startedAt: 'desc' },
        select: { id: true, status: true, sdkIdentity: true, env: true, summaryJson: true, startedAt: true, lastSeenAt: true, closedAt: true, closeReason: true }
      })
    ]);

    const sessionId = active?.id ?? null;
    const [collectedKeys, lastReportedAt] = sessionId
      ? await Promise.all([
          runtimeCaptureItemV2.count({ where: { projectId, sessionId } }),
          runtimeCaptureItemV2
            .findFirst({
              where: { projectId, sessionId },
              orderBy: { lastSeenAt: 'desc' },
              select: { lastSeenAt: true }
            })
            .then((r: any) => (r?.lastSeenAt ? r.lastSeenAt.toISOString() : null))
        ])
      : [0, null];

    const toInfo = (s: typeof active): RuntimeSessionInfo | null =>
      s
        ? {
            id: s.id,
            status: s.status,
            sdkIdentity: s.sdkIdentity ?? null,
            env: s.env ?? null,
            requestedRoute:
              typeof s.summaryJson === 'string'
                ? (() => {
                    try {
                      const parsed = JSON.parse(s.summaryJson);
                      return typeof parsed?.route === 'string' ? parsed.route : null;
                    } catch {
                      return null;
                    }
                  })()
                : null,
            requestedLocale:
              typeof s.summaryJson === 'string'
                ? (() => {
                    try {
                      const parsed = JSON.parse(s.summaryJson);
                      return typeof parsed?.locale === 'string' ? parsed.locale : null;
                    } catch {
                      return null;
                    }
                  })()
                : null,
            startedAt: s.startedAt.toISOString(),
            lastSeenAt: s.lastSeenAt ? s.lastSeenAt.toISOString() : null
          }
        : null;
    const gateOpen = Boolean(active);
    const gateInfo = gateOpen
      ? {
          open: true,
          reason: 'open' as const,
          ttlMs: hardUniqueKeys > 0 ? hardUniqueKeys : null,
          expiresAt: null as Date | null
        }
      : null;

    return {
      ok: true,
      data: {
        session: toInfo(active),
        pendingSession: null,
        gate: {
          open: Boolean(gateInfo?.open),
          sessionId: active?.id ?? null,
          userLastSeenAt: active?.lastSeenAt ? active.lastSeenAt.toISOString() : null,
          reason: gateInfo?.reason ?? 'status_not_open',
          expiresAt: gateInfo?.expiresAt ? gateInfo.expiresAt.toISOString() : null,
          ttlMs: gateInfo?.ttlMs ?? null
        },
        collectedKeys,
        lastReportedAt: lastReportedAt ?? (latestClosed?.lastSeenAt ? latestClosed.lastSeenAt.toISOString() : null),
        warnUniqueKeys,
        hardUniqueKeys,
        nearLimit: Boolean(warnUniqueKeys > 0 && collectedKeys >= warnUniqueKeys)
      }
    };
  } catch (error) {
    rethrowNextNavigationError(error);
    if (isDatabaseNotReadyError(error)) {
      return { ok: false, error: runtimeV2NotReadyMessage() };
    }
    const debugId = crypto.randomUUID();
    console.error('runtimeSync get capture session bootstrap failed', { debugId, projectId }, error);
    return { ok: false, error: `请求失败 (debugId: ${debugId})` };
  }
}

const listSessionSchema = z.object({
  projectId: z.number().int().positive(),
  sessionId: z.number().int().positive(),
  search: z.string().trim().max(200).optional(),
  route: z.string().trim().min(1).max(200).optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  onlyDiff: z.boolean().default(true)
});

export async function listRuntimeSessionEventsQuery(input: z.infer<typeof listSessionSchema>): Promise<
  | { ok: true; data: RuntimeEventsPage }
  | { ok: false; error: string }
> {
  try {
    const parsed = listSessionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

    await getProjectPermissionChecker(parsed.data.projectId);
    if (!runtimeCaptureItemV2) {
      return {
        ok: true,
        data: { page: parsed.data.page, pageSize: parsed.data.pageSize, total: 0, items: [], lastReportedAt: null }
      };
    }

    const where: any = {
      projectId: parsed.data.projectId,
      sessionId: parsed.data.sessionId
    };
    if (parsed.data.route?.trim()) {
      where.route = parsed.data.route.trim();
    }
    if (parsed.data.search?.trim()) {
      const q = parsed.data.search.trim();
      const entryMatches = await prisma.entry.findMany({
        where: { projectId: parsed.data.projectId, sourceText: { contains: q } },
        select: { key: true },
        take: 500
      });
      const entryKeys = entryMatches.map((e) => e.key).filter(Boolean);
      where.OR = [{ key: { contains: q } }, { lastSourceText: { contains: q } }, ...(entryKeys.length ? [{ key: { in: entryKeys } }] : [])];
    }

    const rows = await runtimeCaptureItemV2.findMany({
      where,
      orderBy: { lastSeenAt: 'desc' },
      skip: (parsed.data.page - 1) * parsed.data.pageSize,
      take: parsed.data.pageSize,
      select: { route: true, key: true, lastSourceText: true, seenCount: true, lastSeenAt: true }
    });
    const total = await runtimeCaptureItemV2.count({ where });

    const enhancedItems: EnhancedRuntimeAggRow[] = rows.map((row: any) => ({
      route: String(row.route),
      key: String(row.key),
      sourceText: String(row.lastSourceText),
      count: Number(row.seenCount),
      lastSeenAt: new Date(row.lastSeenAt).toISOString(),
      lastSessionId: parsed.data.sessionId
    }));

    const hydrated = await hydrateRuntimeEvents({
      projectId: parsed.data.projectId,
      enhancedItems
    });

    const items = parsed.data.onlyDiff ? hydrated.items.filter((it) => it.diffType !== 'none') : hydrated.items;

    return {
      ok: true,
      data: {
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        total,
        items,
        lastReportedAt: hydrated.lastReportedAt
      }
    };
  } catch (error) {
    const debugId = crypto.randomUUID();
    console.error('runtimeSync list session events failed', { debugId, input }, error);
    return { ok: false, error: `请求失败 (debugId: ${debugId})` };
  }
}

export async function listRuntimeSessionRoutesQuery(input: {
  projectId: number;
  sessionId: number;
  search?: string;
  limit?: number;
}): Promise<{ ok: true; data: string[] } | { ok: false; error: string }> {
  try {
    const parsed = z
      .object({
        projectId: z.number().int().positive(),
        sessionId: z.number().int().positive(),
        search: z.string().trim().max(200).optional(),
        limit: z.number().int().positive().max(200).default(80)
      })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

    await getProjectPermissionChecker(parsed.data.projectId);

    const where: any = { projectId: parsed.data.projectId, sessionId: parsed.data.sessionId };
    if (parsed.data.search?.trim()) {
      where.route = { contains: parsed.data.search.trim() };
    }

    if (!runtimeCaptureItemV2) return { ok: true, data: [] };

    const rows = await runtimeCaptureItemV2.findMany({
      where,
      distinct: ['route'],
      orderBy: { lastSeenAt: 'desc' },
      take: parsed.data.limit,
      select: { route: true }
    });

    return { ok: true, data: rows.map((r: any) => String(r.route)).filter(Boolean) };
  } catch (error) {
    const debugId = crypto.randomUUID();
    console.error('runtimeSync list session routes failed', { debugId, input }, error);
    return { ok: false, error: `请求失败 (debugId: ${debugId})` };
  }
}

export type RuntimeSessionRouteStatsRow = {
  route: string;
  keysTotal: number;
  newKeysCount: number;
  textChangedCount: number;
  lastSeenAt: string;
};

export type RuntimeSessionRouteStatsPage = {
  page: number;
  pageSize: number;
  total: number;
  items: RuntimeSessionRouteStatsRow[];
};

export async function listRuntimeSessionRouteStatsQuery(input: {
  projectId: number;
  sessionId: number;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ ok: true; data: RuntimeSessionRouteStatsPage } | { ok: false; error: string }> {
  try {
    const parsed = z
      .object({
        projectId: z.number().int().positive(),
        sessionId: z.number().int().positive(),
        search: z.string().trim().max(200).optional(),
        page: z.number().int().positive().default(1),
        pageSize: z.number().int().positive().max(100).default(30)
      })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

    await getProjectPermissionChecker(parsed.data.projectId);
    if (!runtimeCaptureRouteStatV2 || !runtimeCaptureSessionV2) {
      return { ok: true, data: { page: parsed.data.page, pageSize: parsed.data.pageSize, total: 0, items: [] } };
    }

    const session = await runtimeCaptureSessionV2.findFirst({
      where: { id: parsed.data.sessionId, projectId: parsed.data.projectId },
      select: { id: true }
    });
    if (!session) return { ok: false, error: '会话不存在' };

    const where: any = { projectId: parsed.data.projectId, sessionId: parsed.data.sessionId };
    if (parsed.data.search?.trim()) where.route = { contains: parsed.data.search.trim() };

    const [total, rows] = await Promise.all([
      runtimeCaptureRouteStatV2.count({ where }),
      runtimeCaptureRouteStatV2.findMany({
        where,
        orderBy: { lastSeenAt: 'desc' },
        skip: (parsed.data.page - 1) * parsed.data.pageSize,
        take: parsed.data.pageSize,
        select: { route: true, keysTotal: true, newKeysCount: true, textChangedCount: true, lastSeenAt: true }
      })
    ]);

    return {
      ok: true,
      data: {
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        total,
        items: (rows as any[])
          .map((r) => ({
            route: String(r.route),
            keysTotal: Number(r.keysTotal ?? 0),
            newKeysCount: Number(r.newKeysCount ?? 0),
            textChangedCount: Number(r.textChangedCount ?? 0),
            lastSeenAt: new Date(r.lastSeenAt).toISOString()
          }))
          .filter((r) => r.route)
      }
    };
  } catch (error) {
    const debugId = crypto.randomUUID();
    console.error('runtimeSync list session route stats failed', { debugId, input }, error);
    const detail =
      process.env.NODE_ENV !== 'production'
        ? ` · ${(error instanceof Error ? error.message : String(error)) || 'unknown_error'}`
        : '';
    return { ok: false, error: `请求失败 (debugId: ${debugId})${detail}` };
  }
}

export async function getRuntimeSessionRouteDiffQuery(input: {
  projectId: number;
  sessionId: number;
  route: string;
}): Promise<{ ok: true; data: RuntimeRouteDiff } | { ok: false; error: string }> {
  try {
    const parsed = z
      .object({
        projectId: z.number().int().positive(),
        sessionId: z.number().int().positive(),
        route: z.string().trim().min(1).max(200)
      })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

    await getProjectPermissionChecker(parsed.data.projectId);
    if (!runtimeCaptureItemV2) return { ok: false, error: '运行时采集会话数据未初始化，请先执行数据库迁移' };

    const sdkItems = await runtimeCaptureItemV2.findMany({
      where: { projectId: parsed.data.projectId, sessionId: parsed.data.sessionId, route: parsed.data.route },
      orderBy: { lastSeenAt: 'desc' },
      take: 2000,
      select: { key: true, lastSourceText: true }
    });
    const keys = sdkItems.map((i: any) => i.key).filter(Boolean);

    const page = await prisma.page.findFirst({
      where: { projectId: parsed.data.projectId, route: parsed.data.route },
      select: { id: true, title: true }
    });

    const existingEntries = keys.length
      ? await prisma.entry.findMany({
          where: { projectId: parsed.data.projectId, key: { in: keys } },
          select: { id: true, key: true }
        })
      : [];

    const coreEntries = existingEntries.map((e) => ({ key: e.key, entryId: e.id }));
    const entryIds = existingEntries.map((e) => e.id);

    const corePlacements =
      page && entryIds.length
        ? (
            await prisma.entryPlacement.findMany({
              where: { entryId: { in: entryIds }, module: { pageId: page.id } },
              select: {
                entry: { select: { key: true, id: true } },
                module: { select: { id: true, name: true } }
              }
            })
          ).map((p) => ({
            key: p.entry.key,
            entryId: p.entry.id,
            moduleId: p.module.id,
            moduleName: p.module.name
          }))
        : [];

    const diff = computeRuntimeDiffLocal({
      sdkKeys: sdkItems.map((s: any) => ({
        key: String(s.key),
        sourceText: String(s.lastSourceText),
        suggestedModuleName: null
      })),
      coreEntries,
      corePlacements
    });

    return {
      ok: true,
      data: {
        route: parsed.data.route,
        page: page ? { id: page.id, title: page.title } : null,
        sdkKeysTotal: keys.length,
        items: diff.items as any,
        summary: diff.summary as any
      }
    };
  } catch (error) {
    const debugId = crypto.randomUUID();
    console.error('runtimeSync get session route diff failed', { debugId, input }, error);
    return { ok: false, error: `请求失败 (debugId: ${debugId})` };
  }
}

export type RuntimeSessionDraftOpRow = {
  route: string;
  key: string;
  action: 'ignore' | 'bind' | 'delete';
  targetPageId: number | null;
  targetModuleId: number | null;
};

export async function listRuntimeSessionDraftOpsQuery(input: {
  projectId: number;
  sessionId: number;
  route?: string;
}): Promise<{ ok: true; data: RuntimeSessionDraftOpRow[] } | { ok: false; error: string }> {
  try {
    const parsed = z
      .object({
        projectId: z.number().int().positive(),
        sessionId: z.number().int().positive(),
        route: z.string().trim().min(1).max(200).optional()
      })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
    await getProjectPermissionChecker(parsed.data.projectId);

    const where: any = { projectId: parsed.data.projectId, sessionId: parsed.data.sessionId };
    if (parsed.data.route) where.route = parsed.data.route;

    const rows = await prisma.runtimeSessionDraftOp.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: { route: true, key: true, action: true, targetPageId: true, targetModuleId: true }
    });

    return {
      ok: true,
      data: rows.map((r) => ({
        route: r.route,
        key: r.key,
        action: r.action as RuntimeSessionDraftOpRow['action'],
        targetPageId: r.targetPageId,
        targetModuleId: r.targetModuleId
      }))
    };
  } catch (error) {
    const debugId = crypto.randomUUID();
    console.error('runtimeSync list session draft ops failed', { debugId, input }, error);
    return { ok: false, error: `请求失败 (debugId: ${debugId})` };
  }
}

export async function upsertRuntimeSessionDraftOpAction(input: {
  projectId: number;
  sessionId: number;
  route: string;
  key: string;
  action: 'ignore' | 'bind' | 'delete';
  targetPageId?: number | null;
  targetModuleId?: number | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = z
      .object({
        projectId: z.number().int().positive(),
        sessionId: z.number().int().positive(),
        route: z.string().trim().min(1).max(200),
        key: z.string().trim().min(1).max(200),
        action: z.enum(['ignore', 'bind', 'delete']),
        targetPageId: z.number().int().positive().nullable().optional(),
        targetModuleId: z.number().int().positive().nullable().optional()
      })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
    const { user, can } = await getProjectPermissionChecker(parsed.data.projectId, true);
    if (!can(['admin', 'creator'])) return { ok: false, error: '无权限执行保存操作' };

    await prisma.runtimeSessionDraftOp.upsert({
      where: {
        sessionId_route_key: {
          sessionId: parsed.data.sessionId,
          route: parsed.data.route,
          key: parsed.data.key
        }
      },
      update: {
        action: parsed.data.action,
        targetPageId: parsed.data.targetPageId ?? null,
        targetModuleId: parsed.data.targetModuleId ?? null,
        createdByUserId: user.id
      },
      create: {
        projectId: parsed.data.projectId,
        sessionId: parsed.data.sessionId,
        route: parsed.data.route,
        key: parsed.data.key,
        action: parsed.data.action,
        targetPageId: parsed.data.targetPageId ?? null,
        targetModuleId: parsed.data.targetModuleId ?? null,
        createdByUserId: user.id
      }
    });

    return { ok: true };
  } catch (error) {
    const debugId = crypto.randomUUID();
    console.error('runtimeSync upsert session draft op failed', { debugId, input }, error);
    return { ok: false, error: `保存失败 (debugId: ${debugId})` };
  }
}

export async function upsertRuntimeSessionDraftOpsBatchAction(input: {
  projectId: number;
  sessionId: number;
  route: string;
  ops: Array<{
    key: string;
    action: 'ignore' | 'bind' | 'delete';
    targetPageId?: number | null;
    targetModuleId?: number | null;
  }>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = z
      .object({
        projectId: z.number().int().positive(),
        sessionId: z.number().int().positive(),
        route: z.string().trim().min(1).max(200),
        ops: z
          .array(
            z.object({
              key: z.string().trim().min(1).max(200),
              action: z.enum(['ignore', 'bind', 'delete']),
              targetPageId: z.number().int().positive().nullable().optional(),
              targetModuleId: z.number().int().positive().nullable().optional()
            })
          )
          .max(2000)
      })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

    const { user, can } = await getProjectPermissionChecker(parsed.data.projectId, true);
    if (!can(['admin', 'creator'])) return { ok: false, error: '无权限执行保存操作' };

    await prisma.$transaction(
      parsed.data.ops.map((op) =>
        prisma.runtimeSessionDraftOp.upsert({
          where: {
            sessionId_route_key: {
              sessionId: parsed.data.sessionId,
              route: parsed.data.route,
              key: op.key
            }
          },
          update: {
            action: op.action,
            targetPageId: op.targetPageId ?? null,
            targetModuleId: op.targetModuleId ?? null,
            createdByUserId: user.id
          },
          create: {
            projectId: parsed.data.projectId,
            sessionId: parsed.data.sessionId,
            route: parsed.data.route,
            key: op.key,
            action: op.action,
            targetPageId: op.targetPageId ?? null,
            targetModuleId: op.targetModuleId ?? null,
            createdByUserId: user.id
          }
        })
      )
    );

    return { ok: true };
  } catch (error) {
    const debugId = crypto.randomUUID();
    console.error('runtimeSync batch upsert draft ops failed', { debugId, input }, error);
    return { ok: false, error: `保存失败 (debugId: ${debugId})` };
  }
}

export type RuntimeSessionApplySummary = {
  routes: number;
  ops: { bind: number; delete: number; ignore: number };
};

export async function applyRuntimeSessionAction(input: {
  projectId: number;
  sessionId: number;
}): Promise<{ ok: true; data: { status: string; summary: RuntimeSessionApplySummary } } | { ok: false; error: string }> {
  let userId: number | null = null;
  try {
    const parsed = z.object({ projectId: z.number().int().positive(), sessionId: z.number().int().positive() }).safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

    const { user, can } = await getProjectPermissionChecker(parsed.data.projectId, true);
    userId = user.id;
    if (!can(['admin', 'creator'])) return { ok: false, error: '无权限执行保存操作' };
    if (!runtimeCaptureSessionV2 || !runtimeCaptureRouteStatV2 || !runtimeCaptureApplyRunV2) {
      return { ok: false, error: '运行时采集会话数据未初始化，请先执行数据库迁移' };
    }

    const session = await runtimeCaptureSessionV2.findFirst({
      where: { id: parsed.data.sessionId, projectId: parsed.data.projectId },
      select: { id: true, status: true }
    });
    if (!session) return { ok: false, error: '会话不存在' };
    if (session.status !== 'active' && session.status !== 'closing') return { ok: false, error: '会话未处于进行中状态' };

    const routeStats = (await runtimeCaptureRouteStatV2.findMany({
      where: { projectId: parsed.data.projectId, sessionId: session.id },
      select: { route: true, newKeysCount: true, textChangedCount: true }
    })) as Array<{ route: string; newKeysCount: number; textChangedCount: number }>;

    const bindCount = routeStats.reduce((sum, r) => sum + Number(r.newKeysCount ?? 0) + Number(r.textChangedCount ?? 0), 0);
    const summary: RuntimeSessionApplySummary = {
      routes: routeStats.length,
      ops: { bind: bindCount, delete: 0, ignore: 0 }
    };

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const trx = tx as any;
      await trx.runtimeCaptureApplyRunV2.create({
        data: {
          projectId: parsed.data.projectId,
          sessionId: session.id,
          status: 'applied',
          summaryJson: JSON.stringify({ appliedByUserId: userId, summary })
        }
      });
      await trx.runtimeCaptureSessionV2.update({
        where: { id: session.id },
        data: {
          status: 'closed',
          closeReason: 'saved',
          closedAt: now,
          summaryJson: JSON.stringify({ kind: 'applied', appliedByUserId: userId, summary })
        }
      });
    });

    return { ok: true, data: { status: 'closed', summary } };
  } catch (error) {
    const debugId = crypto.randomUUID();
    console.error('runtimeSync apply session failed', { debugId, userId, input }, error);
    return { ok: false, error: `保存失败 (debugId: ${debugId})` };
  }
}

export async function discardRuntimeSessionAction(input: {
  projectId: number;
  sessionId: number;
}): Promise<{ ok: true; data: { status: string } } | { ok: false; error: string }> {
  let userId: number | null = null;
  try {
    const parsed = z.object({ projectId: z.number().int().positive(), sessionId: z.number().int().positive() }).safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

    const { user, can } = await getProjectPermissionChecker(parsed.data.projectId, true);
    userId = user.id;
    if (!can(['admin', 'creator'])) return { ok: false, error: '无权限处理会话' };

    if (!runtimeCaptureSessionV2 || !runtimeCaptureItemV2 || !runtimeCaptureApplyRunV2) {
      return { ok: false, error: '运行时采集会话数据未初始化，请先执行数据库迁移' };
    }

    const session = await runtimeCaptureSessionV2.findFirst({
      where: { id: parsed.data.sessionId, projectId: parsed.data.projectId },
      select: { id: true, status: true }
    });
    if (!session) return { ok: false, error: '会话不存在' };
    if (session.status !== 'active' && session.status !== 'closing') return { ok: false, error: '会话未处于进行中状态' };

    const counts = await runtimeCaptureItemV2.count({ where: { projectId: parsed.data.projectId, sessionId: session.id } });
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const trx = tx as any;
      await trx.runtimeCaptureApplyRunV2.create({
        data: {
          projectId: parsed.data.projectId,
          sessionId: session.id,
          status: 'discarded',
          summaryJson: JSON.stringify({ discardedByUserId: userId, collectedKeys: counts })
        }
      });
      await trx.runtimeCaptureSessionV2.update({
        where: { id: session.id },
        data: {
          status: 'closed',
          closeReason: 'discarded',
          closedAt: now,
          summaryJson: JSON.stringify({ kind: 'discarded', discardedByUserId: userId, collectedKeys: counts })
        }
      });
    });

    return { ok: true, data: { status: 'closed' } };
  } catch (error) {
    const debugId = crypto.randomUUID();
    console.error('runtimeSync discard session failed', { debugId, userId, input }, error);
    return { ok: false, error: `操作失败 (debugId: ${debugId})` };
  }
}

export type RuntimeSessionHistoryRow = {
  id: number;
  status: string;
  sdkIdentity: string | null;
  env: string | null;
  startedAt: string;
  closedAt: string | null;
  summaryJson: string | null;
};

export async function listRuntimeSessionHistoryQuery(projectId: number): Promise<
  | { ok: true; data: RuntimeSessionHistoryRow[] }
  | { ok: false; error: string }
> {
  try {
    await getProjectPermissionChecker(projectId);
    if (!runtimeCaptureSessionV2) return { ok: true, data: [] };
    const rows = await runtimeCaptureSessionV2.findMany({
      where: { projectId, status: { in: ['closed', 'expired'] } },
      orderBy: { closedAt: 'desc' },
      take: 30,
      select: { id: true, status: true, sdkIdentity: true, env: true, startedAt: true, closedAt: true, summaryJson: true }
    });
    return {
      ok: true,
      data: rows.map((r: any) => ({
        id: r.id,
        status: r.status,
        sdkIdentity: r.sdkIdentity ?? null,
        env: r.env ?? null,
        startedAt: r.startedAt.toISOString(),
        closedAt: r.closedAt ? r.closedAt.toISOString() : null,
        summaryJson: r.summaryJson ?? null
      }))
    };
  } catch (error) {
    const debugId = crypto.randomUUID();
    console.error('runtimeSync list session history failed', { debugId, projectId }, error);
    return { ok: false, error: `请求失败 (debugId: ${debugId})` };
  }
}
