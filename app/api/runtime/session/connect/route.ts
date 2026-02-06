import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { connectRuntimeSession } from '@/lib/enhanced/client';
import { requireProjectRuntimeToken } from '@/lib/runtime/auth';
import { fromUnknownError, jsonError, jsonOk, validationError } from '@/lib/http/response';

export const runtime = 'nodejs';

const schema = z
  .object({
    projectId: z.number().int().positive().optional(),
    sdkIdentity: z.string().trim().min(1).max(200).optional(),
    env: z.enum(['prod', 'staging', 'dev']).optional()
  })
  .passthrough();

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const projectIdParam = Number(url.searchParams.get('projectId'));
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

    const projectId =
      typeof parsed.data.projectId === 'number'
        ? parsed.data.projectId
        : Number.isFinite(projectIdParam) && projectIdParam > 0
          ? projectIdParam
          : NaN;
    if (!Number.isFinite(projectId) || projectId <= 0) {
      return validationError('Validation error', { projectId: ['projectId is required'] });
    }

    const tokenAuth = await requireProjectRuntimeToken(request, projectId);
    if (!tokenAuth.ok) return tokenAuth.response;

    const res = await connectRuntimeSession({
      projectId,
      sdkIdentity: parsed.data.sdkIdentity,
      env: parsed.data.env
    });
    if (!res.connected) {
      return jsonError(
        {
          code: 'INTERNAL_ERROR',
          message: `Enhanced unavailable: ${res.reason}`
        },
        { status: 503 }
      );
    }

    return jsonOk({ sessionId: res.sessionId ?? null });
  } catch (err) {
    return fromUnknownError(err);
  }
}
