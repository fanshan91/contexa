import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireProjectRuntimeToken } from '@/lib/runtime/auth';
import { fromUnknownError, jsonOk, validationError } from '@/lib/http/response';

export const runtime = 'nodejs';

const eventSchema = z
  .object({
    key: z.string().trim().min(1).max(200),
    sourceText: z.string().trim().min(1).max(5000),
    timestamp: z.number().int().positive(),
    route: z.string().trim().min(1).max(200).optional(),
    env: z.string().trim().optional(),
    instanceId: z.string().trim().optional(),
    locale: z.string().trim().optional(),
    idempotencyKey: z.string().trim().optional(),
    meta: z.unknown().optional()
  })
  .passthrough();

const schema = z
  .object({
    projectId: z.coerce.number().int().positive(),
    sessionId: z.string().trim().optional(),
    batchId: z.string().trim().min(1).max(100),
    events: z.array(eventSchema).min(1).max(500)
  })
  .passthrough();

export async function POST(request: NextRequest) {
  try {
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

    const projectId = parsed.data.projectId;
    const tokenAuth = await requireProjectRuntimeToken(request, projectId);
    if (!tokenAuth.ok) return tokenAuth.response;

    const sessionIdNumber = parsed.data.sessionId ? Number(parsed.data.sessionId) : NaN;
    const sessionId = Number.isFinite(sessionIdNumber) ? sessionIdNumber : null;

    const normalizedEvents = parsed.data.events.map((event) => {
      const occurredAt = new Date(event.timestamp);
      const metaPayload =
        event.meta ??
        (event.env || event.instanceId || event.locale || event.idempotencyKey
          ? {
              env: event.env,
              instanceId: event.instanceId,
              locale: event.locale,
              idempotencyKey: event.idempotencyKey
            }
          : undefined);

      return {
        route: event.route ?? 'unknown',
        key: event.key,
        sourceText: event.sourceText,
        occurredAt,
        metaJson: metaPayload === undefined ? null : JSON.stringify(metaPayload)
      };
    });

    const aggregateGroups = new Map<
      string,
      { projectId: number; route: string; key: string; sourceText: string; count: number; lastSeenAt: Date; lastSessionId: number | null }
    >();
    for (const event of normalizedEvents) {
      const groupKey = `${event.route}\n${event.key}`;
      const existing = aggregateGroups.get(groupKey);
      if (!existing) {
        aggregateGroups.set(groupKey, {
          projectId,
          route: event.route,
          key: event.key,
          sourceText: event.sourceText,
          count: 1,
          lastSeenAt: event.occurredAt,
          lastSessionId: sessionId
        });
        continue;
      }
      existing.count += 1;
      if (event.occurredAt.getTime() >= existing.lastSeenAt.getTime()) {
        existing.lastSeenAt = event.occurredAt;
        existing.sourceText = event.sourceText;
        existing.lastSessionId = sessionId;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.runtimeEvent.createMany({
        data: normalizedEvents.map((event) => ({
          projectId,
          sessionId,
          route: event.route,
          key: event.key,
          sourceText: event.sourceText,
          occurredAt: event.occurredAt,
          metaJson: event.metaJson
        }))
      });

      for (const agg of aggregateGroups.values()) {
        await tx.runtimeKeyAggregate.upsert({
          where: {
            projectId_route_key: {
              projectId: agg.projectId,
              route: agg.route,
              key: agg.key
            }
          },
          create: {
            projectId: agg.projectId,
            route: agg.route,
            key: agg.key,
            sourceText: agg.sourceText,
            count: agg.count,
            lastSeenAt: agg.lastSeenAt,
            lastSessionId: agg.lastSessionId
          },
          update: {
            sourceText: agg.sourceText,
            count: { increment: agg.count },
            lastSeenAt: agg.lastSeenAt,
            lastSessionId: agg.lastSessionId
          }
        });
      }

      if (sessionId) {
        await tx.runtimeSession.updateMany({
          where: { id: sessionId, projectId },
          data: { lastSeenAt: new Date() }
        });
      }
    });

    return jsonOk({ saved: true, received: parsed.data.events.length });
  } catch (err) {
    return fromUnknownError(err);
  }
}
