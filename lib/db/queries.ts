import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export async function getUser() {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  let sessionData: Awaited<ReturnType<typeof verifyToken>> | null = null;
  try {
    sessionData = await verifyToken(sessionCookie.value);
  } catch {
    return null;
  }
  if (
    !sessionData ||
    !sessionData.user ||
    typeof sessionData.user.id !== 'number'
  ) {
    return null;
  }

  if (new Date(sessionData.expires) < new Date()) {
    return null;
  }

  return await prisma.user.findFirst({
    where: { id: sessionData.user.id, deletedAt: null }
  });
}

export async function getTeamByStripeCustomerId(customerId: string) {
  return await prisma.team.findUnique({
    where: { stripeCustomerId: customerId }
  });
}

export async function updateTeamSubscription(
  teamId: number,
  subscriptionData: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    planName: string | null;
    subscriptionStatus: string;
  }
) {
  await prisma.team.update({
    where: { id: teamId },
    data: {
      ...subscriptionData
    }
  });
}

export async function getUserWithTeam(userId: number) {
  const teamMember = await prisma.teamMember.findFirst({
    where: { userId },
    select: { teamId: true }
  });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user ? { user, teamId: teamMember?.teamId ?? null } : null;
}

export async function getActivityLogs() {
  const user = await getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const logs = await prisma.activityLog.findMany({
    where: { userId: user.id },
    orderBy: { timestamp: 'desc' },
    take: 10,
    include: {
      user: { select: { name: true } }
    }
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    timestamp: log.timestamp,
    ipAddress: log.ipAddress,
    userName: log.user?.name ?? null
  }));
}

export async function getTeamForUser() {
  const user = await getUser();
  if (!user) {
    return null;
  }

  const result = await prisma.teamMember.findFirst({
    where: { userId: user.id },
    include: {
      team: {
        include: {
          teamMembers: {
            include: {
              user: { select: { id: true, name: true, email: true } }
            }
          }
        }
      }
    }
  });

  return result?.team ?? null;
}
