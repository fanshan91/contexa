'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { validatedActionWithUser } from '@/lib/auth/middleware';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db/prisma';
import { savePlatformApiConfig } from '@/lib/enhanced/client';

const apiConfigSchema = z.object({
  llmProvider: z.string().optional(),
  llmBaseUrl: z.string().optional(),
  llmApiKey: z.string().optional(),
  llmModel: z.string().optional(),
  mtProvider: z.string().optional(),
  mtBaseUrl: z.string().optional(),
  mtApiKey: z.string().optional()
});

export const savePlatformApiConfigAction = validatedActionWithUser(
  apiConfigSchema,
  async (data, _, user) => {
    const t = await getTranslations('platformApi');

    const isProjectAdmin = !!(await prisma.projectMember.findFirst({
      where: { userId: user.id, role: 'admin' },
      select: { id: true }
    }));
    if (!user.isSystemAdmin && !isProjectAdmin) {
      return { error: t('noPermission') };
    }

    const res = await savePlatformApiConfig(data);
    if (!res.connected) {
      return { error: t('enhancedNotConnected') };
    }

    redirect('/dashboard');
  }
);

