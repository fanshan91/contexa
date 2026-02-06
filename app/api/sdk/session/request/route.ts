import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireProjectRuntimeToken } from '@/lib/runtime/auth';
import { fromUnknownError, jsonError, jsonOk, validationError } from '@/lib/http/response';

export const runtime = 'nodejs';

const schema = z
  .object({
    projectId: z.coerce.number().int().positive(),
    env: z.enum(['prod', 'staging', 'dev']).optional(),
    instanceId: z.string().trim().optional(),
    route: z.string().trim().optional()
  })
  .passthrough();

function sdkJsonError(input: { code: string; message: string; status: number; details?: unknown }) {
  return Response.json(
    {
      ok: false,
      error: {
        code: input.code,
        message: input.message,
        details: input.details
      }
    },
    { status: input.status }
  );
}

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

    const now = new Date();
    const incomingIdentity = parsed.data.instanceId?.trim() || null;
    const existing = await prisma.runtimeSession.findFirst({
      where: { projectId, status: 'active' }
    });

    if (existing && incomingIdentity && existing.sdkIdentity && existing.sdkIdentity !== incomingIdentity) {
      return sdkJsonError({
        status: 409,
        code: 'SESSION_CONFLICT',
        message: 'Active session already exists'
      });
    }

    const session = existing
      ? await prisma.runtimeSession.update({
          where: { id: existing.id },
          data: {
            lastSeenAt: now,
            sdkIdentity: incomingIdentity ?? existing.sdkIdentity,
            env: parsed.data.env ?? existing.env
          }
        })
      : await prisma.runtimeSession.create({
          data: {
            projectId,
            status: 'active',
            sdkIdentity: incomingIdentity,
            env: parsed.data.env ?? null,
            startedAt: now,
            lastSeenAt: now
          }
        });

    return jsonOk({ sessionId: String(session.id) });
  } catch (err) {
    return fromUnknownError(err);
  }
}
