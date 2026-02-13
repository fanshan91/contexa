import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { requireProjectRuntimeToken } from '@/lib/runtime/auth';
import { fromUnknownError, validationError } from '@/lib/http/response';
import { ensureRuntimeCaptureV2Models, isSessionExpired, runtimeCaptureSessionV2 } from '@/lib/runtime/capture-v2';

export const runtime = 'nodejs';

const schema = z.object({
  projectId: z.coerce.number().int().positive(),
  sessionId: z.coerce.number().int().positive()
});

function sdkResponse(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status });
}

export async function GET(request: NextRequest) {
  try {
    ensureRuntimeCaptureV2Models();

    const url = new URL(request.url);
    const parsed = schema.safeParse({
      projectId: url.searchParams.get('projectId'),
      sessionId: url.searchParams.get('sessionId')
    });
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

    const session = await runtimeCaptureSessionV2.findFirst({
      where: { id: parsed.data.sessionId, projectId: parsed.data.projectId }
    });
    if (!session) {
      return sdkResponse(404, {
        code: 'SESSION_NOT_FOUND',
        message: '会话不存在'
      });
    }

    if (session.status === 'active') {
      const now = new Date();
      if (isSessionExpired(session.lastSeenAt, now)) {
        await runtimeCaptureSessionV2.update({
          where: { id: session.id },
          data: { status: 'expired', closeReason: 'timeout', closedAt: now }
        });
        return sdkResponse(200, {
          ok: true,
          data: {
            sessionId: session.id,
            status: 'expired',
            lastSeenAt: session.lastSeenAt?.toISOString?.() ?? null
          }
        });
      }
    }

    return sdkResponse(200, {
      ok: true,
      data: {
        sessionId: session.id,
        status: session.status,
        lastSeenAt: session.lastSeenAt ? new Date(session.lastSeenAt).toISOString() : null,
        closedAt: session.closedAt ? new Date(session.closedAt).toISOString() : null,
        closeReason: session.closeReason ?? null
      }
    });
  } catch (err) {
    return fromUnknownError(err);
  }
}
