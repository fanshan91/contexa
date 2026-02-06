import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { hashRuntimeToken } from '@/lib/runtime/token';
import { unauthorized } from '@/lib/http/response';

function getBearerToken(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  const [kind, token] = header.split(' ');
  if (kind?.toLowerCase() === 'bearer' && token?.trim()) {
    return token.trim();
  }
  const legacy = request.headers.get('x-runtime-token');
  return legacy?.trim() ? legacy.trim() : null;
}

export async function requireProjectRuntimeToken(request: Request, projectId: number) {
  const token = getBearerToken(request);
  if (!token) {
    return { ok: false as const, response: unauthorized('Missing runtime token') };
  }
  const record = await prisma.projectRuntimeToken.findUnique({
    where: { projectId }
  });
  if (!record || record.enabled !== true) {
    return { ok: false as const, response: unauthorized('Invalid runtime token') };
  }
  if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
    return { ok: false as const, response: unauthorized('Runtime token expired') };
  }
  const hash = hashRuntimeToken(token);
  if (hash !== record.tokenHash) {
    return { ok: false as const, response: unauthorized('Invalid runtime token') };
  }

  await prisma.projectRuntimeToken
    .update({
      where: { projectId },
      data: { lastUsedAt: new Date() }
    })
    .catch(() => null);

  return { ok: true as const, token, record };
}
