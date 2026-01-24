import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { getUser } from '@/lib/db/queries';
import { unauthorized } from '@/lib/http/response';

export class AuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requireUser() {
  const user = await getUser();
  if (!user) {
    redirect('/sign-in');
  }
  return user;
}

export async function requireSystemAdmin() {
  const user = await requireUser();
  if (!user.isSystemAdmin) {
    redirect('/dashboard');
  }
  return user;
}

export async function requireProjectAccess(projectId: number) {
  const user = await requireUser();
  if (user.isSystemAdmin) {
    return { user, member: null };
  }

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } }
  });

  if (!member) {
    redirect('/dashboard');
  }

  return { user, member };
}

export async function requireApiUser() {
  const user = await getUser();
  if (!user) {
    throw new AuthError('Unauthorized', 401);
  }
  return user;
}

export function toAuthResponse(err: unknown) {
  if (err instanceof AuthError) {
    if (err.status === 401) return unauthorized();
  }
  throw err;
}

