import { z } from 'zod';
import { comparePasswords, hashPassword, verifyToken } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { getUserWithTeam } from '@/lib/db/queries';
import { ActivityType } from '@/lib/db/types';
import { fromUnknownError, jsonOk, unauthorized, validationError } from '@/lib/http/response';

function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

async function getUserFromSessionCookie(cookieHeader: string | null) {
  const session = getCookieValue(cookieHeader, 'session');
  if (!session) return null;

  let sessionData: Awaited<ReturnType<typeof verifyToken>> | null = null;
  try {
    sessionData = await verifyToken(session);
  } catch {
    return null;
  }

  if (!sessionData?.user || typeof sessionData.user.id !== 'number') {
    return null;
  }

  if (new Date(sessionData.expires) < new Date()) {
    return null;
  }

  return await prisma.user.findFirst({
    where: { id: sessionData.user.id, deletedAt: null }
  });
}

const accountPattern = /^[A-Za-z0-9.@]+$/;
const passwordSchema = z
  .string()
  .min(6, '密码至少 6 位')
  .max(100, '密码最多 100 位')
  .regex(accountPattern, '密码仅支持字母、数字、.、@');

const changePasswordSchema = z.object({
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
  confirmPassword: passwordSchema
});

export async function POST(request: Request) {
  try {
    const user = await getUserFromSessionCookie(request.headers.get('cookie'));
    if (!user) {
      return unauthorized();
    }

    const body = await request.json().catch(() => null);
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return validationError('Validation error', fieldErrors);
    }

    const { currentPassword, newPassword, confirmPassword } = parsed.data;

    if (confirmPassword !== newPassword) {
      return validationError('Validation error', {
        confirmPassword: ['两次输入的新密码不一致']
      });
    }

    if (currentPassword === newPassword) {
      return validationError('Validation error', {
        newPassword: ['新密码不能与当前密码相同']
      });
    }

    const isPasswordValid = await comparePasswords(
      currentPassword,
      user.passwordHash
    );
    if (!isPasswordValid) {
      return validationError('Validation error', {
        currentPassword: ['当前密码不正确']
      });
    }

    const newPasswordHash = await hashPassword(newPassword);
    const userWithTeam = await getUserWithTeam(user.id);

    await Promise.all([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash }
      }),
      userWithTeam?.teamId
        ? prisma.activityLog.create({
            data: {
              teamId: userWithTeam.teamId,
              userId: user.id,
              action: ActivityType.UPDATE_PASSWORD,
              ipAddress: null
            }
          })
        : Promise.resolve()
    ]);

    return jsonOk({ success: true });
  } catch (err) {
    return fromUnknownError(err);
  }
}

