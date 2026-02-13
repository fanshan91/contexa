import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { requireProjectRuntimeToken } from '@/lib/runtime/auth';
import { fromUnknownError, validationError } from '@/lib/http/response';
import { ensureRuntimeCaptureV2Models, runtimeCaptureSessionV2 } from '@/lib/runtime/capture-v2';

export const runtime = 'nodejs';

const schema = z
  .object({
    projectId: z.coerce.number().int().positive(),
    sessionId: z.coerce.number().int().positive(),
    sdkIdentity: z.string().trim().max(200).optional(),
    reason: z.enum(['saved', 'discarded', 'forced']).default('forced')
  })
  .passthrough();

function sdkResponse(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status });
}

function mapCloseReason(reason: 'saved' | 'discarded' | 'forced') {
  if (reason === 'saved') return 'saved';
  if (reason === 'discarded') return 'discarded';
  return 'forced';
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

    if (parsed.data.sdkIdentity?.trim() && session.sdkIdentity !== parsed.data.sdkIdentity.trim()) {
      return sdkResponse(409, {
        code: 'SDK_CONFLICT',
        message: '会话已绑定其他 SDK 身份',
        sdkIdentity: session.sdkIdentity
      });
    }

    if (session.status === 'closed' || session.status === 'expired') {
      return sdkResponse(200, {
        ok: true,
        data: {
          sessionId: session.id,
          status: session.status,
          closeReason: session.closeReason ?? null,
          closedAt: session.closedAt ? new Date(session.closedAt).toISOString() : null
        }
      });
    }

    const now = new Date();
    const updated = await runtimeCaptureSessionV2.update({
      where: { id: session.id },
      data: {
        status: 'closed',
        closeReason: mapCloseReason(parsed.data.reason),
        closedAt: now,
        lastSeenAt: now
      }
    });

    return sdkResponse(200, {
      ok: true,
      data: {
        sessionId: updated.id,
        status: updated.status,
        closeReason: updated.closeReason,
        closedAt: updated.closedAt ? new Date(updated.closedAt).toISOString() : null
      }
    });
  } catch (err) {
    return fromUnknownError(err);
  }
}
