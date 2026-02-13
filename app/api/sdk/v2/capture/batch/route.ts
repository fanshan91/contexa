import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireProjectRuntimeToken } from '@/lib/runtime/auth';
import { fromUnknownError, validationError } from '@/lib/http/response';
import {
  computeDiffType,
  ensureRuntimeCaptureV2Models,
  hashSourceText,
  isSessionExpired,
  parsePositiveInt,
  runtimeCaptureBatchV2,
  runtimeCaptureItemV2,
  runtimeCaptureRouteStatV2,
  runtimeCaptureSessionV2
} from '@/lib/runtime/capture-v2';

export const runtime = 'nodejs';

const eventSchema = z
  .object({
    key: z.string().trim().min(1).max(200),
    sourceText: z.string().trim().min(1).max(5000),
    timestamp: z.number().int().positive(),
    route: z.string().trim().min(1).max(200),
    locale: z.string().trim().max(20).optional(),
    idempotencyKey: z.string().trim().max(200).optional(),
    meta: z.unknown().optional()
  })
  .passthrough();

const schema = z
  .object({
    projectId: z.coerce.number().int().positive(),
    sessionId: z.coerce.number().int().positive(),
    sdkIdentity: z.string().trim().min(1).max(200),
    batchId: z.string().trim().min(1).max(120),
    events: z.array(eventSchema).min(1).max(500)
  })
  .passthrough();

function sdkResponse(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status });
}

function isUniqueConflict(error: unknown) {
  return Boolean(error && typeof error === 'object' && (error as any).code === 'P2002');
}

export async function POST(request: NextRequest) {
  try {
    ensureRuntimeCaptureV2Models();
    const warnUniqueKeys = parsePositiveInt(process.env.RUNTIME_CAPTURE_SESSION_WARN_UNIQUE_KEYS, 8000);
    const hardUniqueKeys = parsePositiveInt(process.env.RUNTIME_CAPTURE_SESSION_HARD_UNIQUE_KEYS, 10000);

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body ?? {});
    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      const fieldErrors: Record<string, string[]> = Object.fromEntries(
        Object.entries(flattened)
          .filter(([, v]) => Array.isArray(v) && v.length > 0)
          .map(([k, v]) => [k, v as string[]])
      );
      return validationError('Validation error', fieldErrors);
    }

    const tokenAuth = await requireProjectRuntimeToken(request, parsed.data.projectId);
    if (!tokenAuth.ok) return tokenAuth.response;

    const now = new Date();
    const session = await runtimeCaptureSessionV2.findFirst({
      where: { id: parsed.data.sessionId, projectId: parsed.data.projectId }
    });
    if (!session) {
      return sdkResponse(404, {
        code: 'SESSION_NOT_FOUND',
        message: '会话不存在'
      });
    }

    if (session.status !== 'active') {
      return sdkResponse(409, {
        code: 'SESSION_NOT_ACTIVE',
        message: '会话未处于 active 状态',
        status: session.status
      });
    }

    if (session.sdkIdentity !== parsed.data.sdkIdentity) {
      return sdkResponse(409, {
        code: 'SDK_CONFLICT',
        message: '会话已绑定其他 SDK 身份',
        sdkIdentity: session.sdkIdentity
      });
    }

    if (isSessionExpired(session.lastSeenAt, now)) {
      await runtimeCaptureSessionV2.update({
        where: { id: session.id },
        data: {
          status: 'expired',
          closeReason: 'timeout',
          closedAt: now
        }
      });
      return sdkResponse(409, {
        code: 'SESSION_EXPIRED',
        message: '会话已过期，请重新打开会话',
        sessionId: session.id
      });
    }

    const grouped = new Map<
      string,
      {
        route: string;
        key: string;
        sourceText: string;
        sourceTextHash: string;
        seenCount: number;
        firstSeenAt: Date;
        lastSeenAt: Date;
      }
    >();

    for (const e of parsed.data.events) {
      const route = e.route.trim() || 'unknown';
      const key = e.key.trim();
      const sourceText = e.sourceText;
      const occurredAt = new Date(e.timestamp);
      const mapKey = `${route}\n${key}`;
      const prev = grouped.get(mapKey);
      if (!prev) {
        grouped.set(mapKey, {
          route,
          key,
          sourceText,
          sourceTextHash: hashSourceText(sourceText),
          seenCount: 1,
          firstSeenAt: occurredAt,
          lastSeenAt: occurredAt
        });
        continue;
      }
      prev.seenCount += 1;
      if (occurredAt.getTime() < prev.firstSeenAt.getTime()) prev.firstSeenAt = occurredAt;
      if (occurredAt.getTime() >= prev.lastSeenAt.getTime()) {
        prev.lastSeenAt = occurredAt;
        prev.sourceText = sourceText;
        prev.sourceTextHash = hashSourceText(sourceText);
      }
    }

    const pairList = Array.from(grouped.values()).map((i) => ({ route: i.route, key: i.key }));
    const routes = Array.from(new Set(pairList.map((p) => p.route)));
    const keys = Array.from(new Set(pairList.map((p) => p.key)));

    let sessionCollectedUniqueKeys = 0;
    let sessionNearLimit = false;
    if (hardUniqueKeys > 0) {
      const [currentCount, existingPairs] = await Promise.all([
        runtimeCaptureItemV2.count({ where: { projectId: parsed.data.projectId, sessionId: session.id } }),
        routes.length && keys.length
          ? runtimeCaptureItemV2.findMany({
              where: { projectId: parsed.data.projectId, sessionId: session.id, route: { in: routes }, key: { in: keys } },
              select: { route: true, key: true }
            })
          : Promise.resolve([])
      ]);
      const existing = new Set(existingPairs.map((r: any) => `${r.route}\n${r.key}`));
      let newPairs = 0;
      for (const p of pairList) {
        if (!existing.has(`${p.route}\n${p.key}`)) newPairs += 1;
      }
      sessionCollectedUniqueKeys = currentCount + newPairs;
      if (sessionCollectedUniqueKeys > hardUniqueKeys) {
        return sdkResponse(429, {
          code: 'SESSION_OVER_LIMIT',
          message: '已采集的数据量过多，请先保存结束会话后再采集新的内容',
          sessionId: session.id,
          collectedUniqueKeys: currentCount,
          warnUniqueKeys,
          hardUniqueKeys
        });
      }
      if (warnUniqueKeys > 0 && sessionCollectedUniqueKeys >= warnUniqueKeys) {
        sessionNearLimit = true;
      }
    }

    try {
      await prisma.$transaction(async (tx) => {
        const trx = tx as any;
        await trx.runtimeCaptureBatchV2.create({
          data: {
            projectId: parsed.data.projectId,
            sessionId: session.id,
            sdkIdentity: parsed.data.sdkIdentity,
            batchId: parsed.data.batchId,
            receivedCount: parsed.data.events.length
          }
        });

        for (const item of grouped.values()) {
          await trx.runtimeCaptureItemV2.upsert({
            where: {
              sessionId_route_key: {
                sessionId: session.id,
                route: item.route,
                key: item.key
              }
            },
            create: {
              projectId: parsed.data.projectId,
              sessionId: session.id,
              route: item.route,
              key: item.key,
              lastSourceText: item.sourceText,
              sourceTextHash: item.sourceTextHash,
              seenCount: item.seenCount,
              firstSeenAt: item.firstSeenAt,
              lastSeenAt: item.lastSeenAt
            },
            update: {
              lastSourceText: item.sourceText,
              sourceTextHash: item.sourceTextHash,
              seenCount: { increment: item.seenCount },
              lastSeenAt: item.lastSeenAt
            }
          });
        }

        await trx.runtimeCaptureSessionV2.update({
          where: { id: session.id },
          data: { lastSeenAt: now }
        });
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        return sdkResponse(200, {
          ok: true,
          data: {
            saved: true,
            deduped: true,
            received: parsed.data.events.length,
            session: {
              collectedUniqueKeys: sessionCollectedUniqueKeys,
              nearLimit: sessionNearLimit,
              warnUniqueKeys,
              hardUniqueKeys
            }
          }
        });
      }
      throw error;
    }

    const requiredSyncBreakdown = {
      newKey: 0,
      textChanged: 0
    };
    let requiredSyncCount = 0;

    for (const route of routes) {
      const items = await runtimeCaptureItemV2.findMany({
        where: { projectId: parsed.data.projectId, sessionId: session.id, route },
        select: { key: true, lastSourceText: true, lastSeenAt: true }
      });
      const routeKeys = items.map((it: any) => String(it.key)).filter(Boolean);
      const entries = routeKeys.length
        ? await prisma.entry.findMany({
            where: { projectId: parsed.data.projectId, key: { in: routeKeys } },
            select: { key: true, sourceText: true }
          })
        : [];
      const entryMap = new Map(entries.map((e) => [e.key, e.sourceText ?? ''] as const));

      let newKeysCount = 0;
      let textChangedCount = 0;
      let maxLastSeenAt = new Date(0);
      for (const item of items) {
        const diff = computeDiffType(String(item.lastSourceText ?? ''), entryMap.has(item.key) ? entryMap.get(item.key)! : null);
        if (diff === 'new_key') {
          newKeysCount += 1;
          requiredSyncBreakdown.newKey += 1;
          requiredSyncCount += 1;
        } else if (diff === 'text_changed') {
          textChangedCount += 1;
          requiredSyncBreakdown.textChanged += 1;
          requiredSyncCount += 1;
        }
        const seen = new Date(item.lastSeenAt);
        if (seen.getTime() > maxLastSeenAt.getTime()) maxLastSeenAt = seen;
      }

      await runtimeCaptureRouteStatV2.upsert({
        where: { sessionId_route: { sessionId: session.id, route } },
        create: {
          projectId: parsed.data.projectId,
          sessionId: session.id,
          route,
          keysTotal: items.length,
          newKeysCount,
          textChangedCount,
          lastSeenAt: maxLastSeenAt.getTime() > 0 ? maxLastSeenAt : now
        },
        update: {
          keysTotal: items.length,
          newKeysCount,
          textChangedCount,
          lastSeenAt: maxLastSeenAt.getTime() > 0 ? maxLastSeenAt : now
        }
      });
    }

    return sdkResponse(200, {
      ok: true,
      data: {
        saved: true,
        deduped: false,
        received: parsed.data.events.length,
        requiredSyncCount,
        requiredSyncBreakdown,
        session: {
          collectedUniqueKeys: sessionCollectedUniqueKeys,
          nearLimit: sessionNearLimit,
          warnUniqueKeys,
          hardUniqueKeys
        }
      }
    });
  } catch (err) {
    return fromUnknownError(err);
  }
}
