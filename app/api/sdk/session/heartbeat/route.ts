import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireProjectRuntimeToken } from '@/lib/runtime/auth';
import { fromUnknownError, jsonOk, validationError } from '@/lib/http/response';

export const runtime = 'nodejs';

const schema = z
  .object({
    projectId: z.coerce.number().int().positive(),
    sessionId: z.string().trim().min(1),
    route: z.string().trim().optional()
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

    const sessionIdNumber = Number(parsed.data.sessionId);
    if (Number.isFinite(sessionIdNumber)) {
      await prisma.runtimeSession
        .updateMany({
          where: { id: sessionIdNumber, projectId, status: 'active' },
          data: { lastSeenAt: new Date() }
        })
        .catch(() => null);
    }

    return jsonOk({ serverTime: Date.now() });
  } catch (err) {
    return fromUnknownError(err);
  }
}
