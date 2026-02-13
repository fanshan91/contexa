import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireProjectRuntimeToken } from '@/lib/runtime/auth';
import { fromUnknownError, jsonOk, validationError } from '@/lib/http/response';

export const runtime = 'nodejs';

const pairSchema = z
  .object({
    route: z.string().trim().min(1).max(200),
    keys: z.array(z.string().trim().min(1).max(200)).min(1).max(2000)
  })
  .passthrough();

const schema = z
  .object({
    projectId: z.coerce.number().int().positive(),
    pairs: z.array(pairSchema).min(1).max(50)
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

    const runtimeKeyAggregate = (prisma as any).runtimeKeyAggregate as
      | { findMany: (args: any) => Promise<Array<{ key: string }>> }
      | undefined;
    if (!runtimeKeyAggregate) {
      return jsonOk({ existing: {} });
    }

    const existing: Record<string, string[]> = {};
    await Promise.all(
      parsed.data.pairs.map(async (pair) => {
        const keys = Array.from(new Set(pair.keys.map((k) => k.trim()).filter(Boolean))).slice(0, 2000);
        if (keys.length === 0) return;
        const rows = await runtimeKeyAggregate.findMany({
          where: { projectId, route: pair.route, key: { in: keys } },
          select: { key: true }
        });
        existing[pair.route] = rows.map((r) => String(r.key)).filter(Boolean);
      })
    );

    return jsonOk({ existing });
  } catch (err) {
    return fromUnknownError(err);
  }
}

