import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireProjectRuntimeToken } from '@/lib/runtime/auth';
import { RUNTIME_SESSION_STALE_MS } from '@/lib/runtime/session';
import { fromUnknownError, validationError } from '@/lib/http/response';
import { ensureRuntimeCaptureV2Models, runtimeCaptureSessionV2 } from '@/lib/runtime/capture-v2';

export const runtime = 'nodejs';

const schema = z
  .object({
    projectId: z.coerce.number().int().positive(),
    sdkIdentity: z.string().trim().min(1).max(200),
    env: z.string().trim().max(100).optional(),
    route: z.string().trim().max(200).optional(),
    locale: z.string().trim().max(20).optional(),
    userAgent: z.string().trim().max(500).optional()
  })
  .passthrough();

function sdkResponse(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status });
}

export async function POST(request: NextRequest) {
  try {
    ensureRuntimeCaptureV2Models();

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

    const now = new Date();
    const staleBefore = new Date(now.getTime() - RUNTIME_SESSION_STALE_MS);
    await runtimeCaptureSessionV2.updateMany({
      where: { projectId, status: 'active', lastSeenAt: { lt: staleBefore } },
      data: { status: 'expired', closeReason: 'timeout', closedAt: now }
    });

    const existing = await runtimeCaptureSessionV2.findFirst({
      where: { projectId, status: 'active' },
      orderBy: { startedAt: 'desc' }
    });

    if (existing && String(existing.sdkIdentity) !== parsed.data.sdkIdentity) {
      return sdkResponse(409, {
        code: 'SESSION_CONFLICT',
        message: '项目已存在其他活跃采集会话',
        sessionId: existing.id,
        sdkIdentity: existing.sdkIdentity
      });
    }

    const session = existing
      ? await runtimeCaptureSessionV2.update({
          where: { id: existing.id },
          data: {
            lastSeenAt: now,
            env: parsed.data.env || existing.env,
            summaryJson: JSON.stringify({
              route: parsed.data.route ?? null,
              locale: parsed.data.locale ?? null,
              userAgent: parsed.data.userAgent ?? null
            })
          }
        })
      : await runtimeCaptureSessionV2.create({
          data: {
            projectId,
            sdkIdentity: parsed.data.sdkIdentity,
            env: parsed.data.env || null,
            status: 'active',
            startedAt: now,
            lastSeenAt: now,
            summaryJson: JSON.stringify({
              route: parsed.data.route ?? null,
              locale: parsed.data.locale ?? null,
              userAgent: parsed.data.userAgent ?? null
            })
          }
        });

    return sdkResponse(200, {
      ok: true,
      data: {
        sessionId: session.id,
        status: session.status,
        startedAt: session.startedAt.toISOString(),
        lastSeenAt: session.lastSeenAt.toISOString()
      }
    });
  } catch (err) {
    return fromUnknownError(err);
  }
}
