import { z } from 'zod';
import { env } from '@/lib/env';
import { applyRuntimeDiffOperations } from '@/lib/runtime/apply-runtime-diff';
import { fromUnknownError, jsonOk, unauthorized, validationError } from '@/lib/http/response';

export const runtime = 'nodejs';

const schema = z
  .object({
    applyId: z.string().trim().min(1).max(100),
    projectId: z.coerce.number().int().positive(),
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
  })
  .passthrough();

function requireEnhancedInternalAuth(request: Request) {
  if (!env.ENHANCED_CORE_SECRET) return { ok: false as const, response: unauthorized('Enhanced core secret not configured') };
  const secret = request.headers.get('x-core-secret')?.trim();
  if (!secret || secret !== env.ENHANCED_CORE_SECRET) return { ok: false as const, response: unauthorized('Invalid internal secret') };
  return { ok: true as const };
}

export async function POST(request: Request) {
  try {
    const auth = requireEnhancedInternalAuth(request);
    if (!auth.ok) return auth.response;

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

    const res = await applyRuntimeDiffOperations({
      projectId: parsed.data.projectId,
      operations: parsed.data.operations
    });
    if (!res.ok) {
      return validationError(res.error);
    }

    return jsonOk({ applied: true, applyId: parsed.data.applyId, stats: res.stats });
  } catch (err) {
    return fromUnknownError(err);
  }
}
