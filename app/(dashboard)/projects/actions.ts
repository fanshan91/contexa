'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { validatedActionWithUser } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';
import { getTranslations } from 'next-intl/server';

const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'validations.projectNameRequired')
    .max(100, 'validations.projectNameMax'),
  description: z.string().max(2000, 'validations.projectDescMax').optional(),
  sourceLocale: z
    .string()
    .min(2, 'validations.sourceLocaleRequired')
    .max(20, 'validations.sourceLocaleMax'),
  translationAdapter: z
    .string()
    .min(1, 'validations.translationAdapterRequired')
    .max(50, 'validations.translationAdapterMax')
});

export const createProject = validatedActionWithUser(
  createProjectSchema,
  async (data, _, user) => {
    const t = await getTranslations('actions');

    if (!user.isSystemAdmin) {
      return {
        ...data,
        error: t('onlySystemAdminCreateProject')
      };
    }

    try {
      const created = await prisma.project.create({
        data: {
          name: data.name,
          description: data.description?.trim() ? data.description.trim() : null,
          sourceLocale: data.sourceLocale,
          createdByUserId: user.id,
          translationAdapter: data.translationAdapter
        }
      });

      await prisma.projectLocale.create({
        data: { projectId: created.id, locale: created.sourceLocale }
      });

      await prisma.projectMember.create({
        data: {
          projectId: created.id,
          userId: user.id,
          role: 'admin',
          canReview: true
        }
      });

      redirect(`/projects/${created.id}`);
    } catch {
      return {
        ...data,
        error: t('createProjectFailed')
      };
    }
  }
);
