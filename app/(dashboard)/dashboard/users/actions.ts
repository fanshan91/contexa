'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { validatedActionWithUser } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/session';
import { getTranslations } from 'next-intl/server';

const SUPER_ADMIN_ACCOUNTS = new Set(['admin', 'admin@contexa.local']);
const accountPattern = /^[A-Za-z0-9.@]+$/;
const passwordSchema = z
  .string()
  .min(6, 'validations.passwordMin')
  .max(100, 'validations.passwordMax')
  .regex(accountPattern, 'validations.passwordPattern');

const promoteSchema = z.object({
  userId: z.coerce.number()
});

export const promoteSystemAdmin = validatedActionWithUser(
  promoteSchema,
  async (data, _, user) => {
    const t = await getTranslations('actions');

    if (!user.isSystemAdmin) {
      return { error: t('noPermission') };
    }
    if (!SUPER_ADMIN_ACCOUNTS.has(user.email)) {
      return { error: t('onlySuperAdmin') };
    }

    const target = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!target || target.deletedAt) {
      return { error: t('userNotFound') };
    }
    if (target.isSystemAdmin) {
      return { error: t('alreadyAdmin') };
    }

    const promotedCount = await prisma.user.count({
      where: {
        deletedAt: null,
        isSystemAdmin: true,
        email: { notIn: Array.from(SUPER_ADMIN_ACCOUNTS) }
      }
    });
    if (promotedCount >= 5) {
      return { error: t('adminLimitReached') };
    }

    await prisma.user.update({
      where: { id: target.id },
      data: { isSystemAdmin: true }
    });

    redirect('/dashboard/users');
  }
);

const demoteSchema = z.object({
  userId: z.coerce.number()
});

export const demoteSystemAdmin = validatedActionWithUser(
  demoteSchema,
  async (data, _, user) => {
    const t = await getTranslations('actions');

    if (!user.isSystemAdmin) {
      return { error: t('noPermission') };
    }
    if (!SUPER_ADMIN_ACCOUNTS.has(user.email)) {
      return { error: t('onlySuperAdmin') };
    }

    const target = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!target || target.deletedAt) {
      return { error: t('userNotFound') };
    }
    if (!target.isSystemAdmin) {
      return { error: t('notSystemAdmin') };
    }
    if (SUPER_ADMIN_ACCOUNTS.has(target.email)) {
      return { error: t('cannotDemoteSuperAdmin') };
    }

    await prisma.user.update({
      where: { id: target.id },
      data: { isSystemAdmin: false }
    });

    redirect('/dashboard/users');
  }
);

const resetPasswordSchema = z.object({
  userId: z.coerce.number(),
  password: passwordSchema
});

export const resetUserPassword = validatedActionWithUser(
  resetPasswordSchema,
  async (data, _, user) => {
    const t = await getTranslations('actions');

    if (!user.isSystemAdmin) {
      return { error: t('noPermission') };
    }

    const target = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!target || target.deletedAt) {
      return { error: t('userNotFound') };
    }

    const passwordHash = await hashPassword(data.password);
    await prisma.user.update({
      where: { id: target.id },
      data: { passwordHash }
    });

    redirect('/dashboard/users');
  }
);
