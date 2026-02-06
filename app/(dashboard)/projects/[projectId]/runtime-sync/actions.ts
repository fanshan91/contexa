'use server';

import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { getProjectPermissionChecker } from '@/lib/auth/project-permissions-server';
import { env } from '@/lib/env';
import { applyRuntimeDiffViaEnhanced, getEnhancedSystemStatus, heartbeatEnhanced } from '@/lib/enhanced/client';
import { decryptRuntimeToken, encryptRuntimeToken, generateRuntimeToken, hashRuntimeToken } from '@/lib/runtime/token';

const ROOT_MODULE_NAME = '__root__';
const db = prisma as any;
const runtimeKeyAggregate = (prisma as any).runtimeKeyAggregate;

function ensureRuntimeAggregate() {
  if (!runtimeKeyAggregate) {
    throw new Error('runtime_aggregate_unavailable');
  }
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
  count: number;
  lastSeenAt: string;
  attention: boolean;
  attentionReason: 'missing_page' | 'unregistered' | 'unbound' | 'ok';
  pageId: number | null;
  pageTitle: string | null;
  moduleId: number | null;
  moduleName: string | null;
  entryId: number | null;
  translationStatus:
    | 'pending'
    | 'needs_update'
    | 'needs_review'
    | 'ready'
    | 'approved'
    | null;
};

export type RuntimeEventsPage = {
  page: number;
  pageSize: number;
  total: number;
  items: RuntimeEventRow[];
  lastReportedAt: string | null;
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
  targetLocale: string | null;
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
            placements: {
              select: {
                moduleId: true,
                module: { select: { name: true, pageId: true, page: { select: { route: true } } } }
              }
            },
            translations: input.targetLocale
              ? {
                  where: { locale: input.targetLocale },
                  select: { status: true }
                }
              : undefined
          }
        })
      : Promise.resolve([])
  ]);

  const pageByRoute = new Map(pages.map((p) => [p.route, p] as const));
  const entryByKey = new Map(entries.map((e) => [e.key, e] as const));

  const out: RuntimeEventRow[] = input.enhancedItems.map((it) => {
    const page = pageByRoute.get(it.route) ?? null;
    const entry = entryByKey.get(it.key) ?? null;
    const translationStatus = input.targetLocale ? (entry?.translations?.[0]?.status ?? null) : null;

    const placementOnPage =
      page && entry
        ? entry.placements.find((p) => p.module.pageId === page.id) ?? null
        : null;

    const attentionReason: RuntimeEventRow['attentionReason'] = !page
      ? 'missing_page'
      : !entry
        ? 'unregistered'
        : !placementOnPage
          ? 'unbound'
          : 'ok';

    return {
      route: it.route,
      key: it.key,
      sourceText: it.sourceText,
      count: it.count,
      lastSeenAt: it.lastSeenAt,
      attention: attentionReason !== 'ok',
      attentionReason,
      pageId: page?.id ?? null,
      pageTitle: page?.title ?? null,
      moduleId: placementOnPage?.moduleId ?? null,
      moduleName: placementOnPage?.module?.name ?? null,
      entryId: entry?.id ?? null,
      translationStatus: translationStatus as any
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
    let topStatus = resolveTopStatus({
      enhancedConnected,
      licenseStatus: enhanced.licenseStatus
    });

    const token = await getRuntimeTokenInfo(projectId);

    ensureRuntimeAggregate();
    const aggregates = (await runtimeKeyAggregate.findMany({
      where: { projectId },
      orderBy: { lastSeenAt: 'desc' },
      take: 20
    })) as Array<{ route: string; key: string; sourceText: string; count: number; lastSeenAt: Date; lastSessionId: number | null }>;
    const total = (await runtimeKeyAggregate.count({
      where: { projectId }
    })) as number;
    const enhancedItems: EnhancedRuntimeAggRow[] = aggregates.map((row: any) => ({
      route: String(row.route),
      key: String(row.key),
      sourceText: String(row.sourceText),
      count: Number(row.count),
      lastSeenAt: new Date(row.lastSeenAt).toISOString(),
      lastSessionId: typeof row.lastSessionId === 'number' ? row.lastSessionId : null
    }));
    const hydrated = await hydrateRuntimeEvents({
      projectId,
      targetLocale: defaultTargetLocale,
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
    const debugId = crypto.randomUUID();
    console.error('runtimeSync bootstrap failed', { debugId, projectId }, error);
    if (error instanceof Error && error.message === 'runtime_aggregate_unavailable') {
      return { ok: false, error: '运行时同步数据未初始化，请先执行数据库迁移' };
    }
    return { ok: false, error: `请求失败 (debugId: ${debugId})` };
  }
}

const listSchema = z.object({
  projectId: z.number().int().positive(),
  targetLocale: z.string().trim().min(1).max(20).nullable().optional(),
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

    const where: any = {
      projectId: parsed.data.projectId
    };
    if (parsed.data.route?.trim()) {
      where.route = parsed.data.route.trim();
    }
    if (parsed.data.search?.trim()) {
      const q = parsed.data.search.trim();
      where.OR = [{ key: { contains: q } }, { sourceText: { contains: q } }];
    }

    ensureRuntimeAggregate();
    const rows = (await runtimeKeyAggregate.findMany({
      where,
      orderBy: { lastSeenAt: 'desc' },
      skip: (parsed.data.page - 1) * parsed.data.pageSize,
      take: parsed.data.pageSize
    })) as Array<{ route: string; key: string; sourceText: string; count: number; lastSeenAt: Date; lastSessionId: number | null }>;
    const total = (await runtimeKeyAggregate.count({ where })) as number;

    const enhancedItems: EnhancedRuntimeAggRow[] = rows.map((row: any) => ({
      route: String(row.route),
      key: String(row.key),
      sourceText: String(row.sourceText),
      count: Number(row.count),
      lastSeenAt: new Date(row.lastSeenAt).toISOString(),
      lastSessionId: typeof row.lastSessionId === 'number' ? row.lastSessionId : null
    }));

    const hydrated = await hydrateRuntimeEvents({
      projectId: parsed.data.projectId,
      targetLocale: parsed.data.targetLocale ?? null,
      enhancedItems
    });

    const items = parsed.data.onlyDiff ? hydrated.items.filter((it) => it.attention) : hydrated.items;

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
    console.error('runtimeSync list events failed', { debugId, input }, error);
    if (error instanceof Error && error.message === 'runtime_aggregate_unavailable') {
      return { ok: false, error: '运行时同步数据未初始化，请先执行数据库迁移' };
    }
    return { ok: false, error: `请求失败 (debugId: ${debugId})` };
  }
}

export async function manualReconnectEnhancedAction(projectId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await getProjectPermissionChecker(projectId);
    await heartbeatEnhanced();
    return { ok: true };
  } catch (error) {
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
