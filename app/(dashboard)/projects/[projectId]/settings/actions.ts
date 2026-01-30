'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { validatedActionWithProject } from '@/lib/auth/middleware';
import {
  createProjectPermissionChecker,
  ProjectRoles
} from '@/lib/auth/project-permissions';
import { prisma } from '@/lib/db/prisma';

const projectIdSchema = z.coerce.number().int().positive();

async function getCreatorId(projectId: number) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { createdByUserId: true }
  });

  if (project?.createdByUserId) return project.createdByUserId;

  const firstAdmin = await prisma.projectMember.findFirst({
    where: { projectId, role: 'admin' },
    orderBy: { createdAt: 'asc' },
    select: { userId: true }
  });

  return firstAdmin?.userId ?? null;
}

async function getMember(projectId: number, userId: number) {
  return prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } }
  });
}

const updateBasicSchema = z.object({
  projectId: projectIdSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional()
});

export const updateProjectBasicAction = validatedActionWithProject(
  updateBasicSchema,
  async (data, _, user) => {
    const t = await getTranslations('projectSettings');
    const member = await getMember(data.projectId, user.id);
    const { can } = createProjectPermissionChecker({ user, member });
    if (!can([ProjectRoles.admin])) return { error: t('noPermission') };

    await prisma.project.update({
      where: { id: data.projectId },
      data: {
        name: data.name.trim(),
        description: data.description?.trim() ? data.description.trim() : null
      }
    });

    redirect(`/projects/${data.projectId}/settings/basic`);
  }
);

const addLocalesSchema = z.object({
  projectId: projectIdSchema,
  localesText: z.string().min(1).max(500)
});

export const addProjectLocalesAction = validatedActionWithProject(
  addLocalesSchema,
  async (data, _, user) => {
    const t = await getTranslations('projectSettings');
    const member = await getMember(data.projectId, user.id);
    const { can } = createProjectPermissionChecker({ user, member });
    if (!can([ProjectRoles.admin])) return { error: t('noPermission') };

    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { sourceLocale: true }
    });
    if (!project) {
      return { error: t('projectNotFound') };
    }

    const incoming = data.localesText
      .split(/[\s,，]+/g)
      .map((s) => s.trim())
      .filter(Boolean);

    const unique = Array.from(new Set(incoming)).filter(
      (locale) => locale !== project.sourceLocale
    );

    if (unique.length === 0) {
      return { error: t('noValidLocales') };
    }

    await prisma.$transaction(
      unique.map((locale) =>
        prisma.projectLocale.upsert({
          where: { projectId_locale: { projectId: data.projectId, locale } },
          update: {},
          create: { projectId: data.projectId, locale }
        })
      )
    );

    redirect(`/projects/${data.projectId}/settings/locales`);
  }
);

const updateQualitySchema = z.object({
  projectId: projectIdSchema,
  qualityMode: z.string().min(1).max(20),
  translationAdapter: z.string().min(1).max(50)
});

export const updateProjectQualityAction = validatedActionWithProject(
  updateQualitySchema,
  async (data, _, user) => {
    const t = await getTranslations('projectSettings');
    const member = await getMember(data.projectId, user.id);
    const { can } = createProjectPermissionChecker({ user, member });
    if (!can([ProjectRoles.admin])) return { error: t('noPermission') };

    await prisma.project.update({
      where: { id: data.projectId },
      data: {
        qualityMode: data.qualityMode,
        translationAdapter: data.translationAdapter
      }
    });

    redirect(`/projects/${data.projectId}/settings/quality`);
  }
);

const savePreferencesSchema = z.object({
  projectId: projectIdSchema,
  localesJson: z.string().min(2).max(2000)
});

export const saveProjectLocalePreferencesAction = validatedActionWithProject(
  savePreferencesSchema,
  async (data, _, user) => {
    const t = await getTranslations('projectSettings');
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { sourceLocale: true }
    });
    if (!project) {
      return { error: t('projectNotFound') };
    }

    let locales: unknown;
    try {
      locales = JSON.parse(data.localesJson);
    } catch {
      return { error: t('invalidLocales') };
    }

    if (!Array.isArray(locales) || locales.some((l) => typeof l !== 'string')) {
      return { error: t('invalidLocales') };
    }

    const selected = Array.from(new Set(locales.map((l) => String(l).trim()))).filter(
      Boolean
    );
    if (selected.length > 3) {
      return { error: t('preferencesMax3') };
    }

    const projectLocales = await prisma.projectLocale.findMany({
      where: { projectId: data.projectId },
      select: { locale: true }
    });
    const allowed = new Set(
      projectLocales.map((l) => l.locale).filter((l) => l !== project.sourceLocale)
    );

    if (selected.some((l) => !allowed.has(l))) {
      return { error: t('invalidLocales') };
    }

    await prisma.$transaction([
      prisma.userProjectLocalePreference.deleteMany({
        where: { projectId: data.projectId, userId: user.id }
      }),
      ...selected.map((locale) =>
        prisma.userProjectLocalePreference.create({
          data: { projectId: data.projectId, userId: user.id, locale }
        })
      )
    ]);

    redirect(`/projects/${data.projectId}/settings/personalization`);
  }
);

const addMemberSchema = z.object({
  projectId: projectIdSchema,
  userId: z.coerce.number().int().positive(),
  role: z.enum([ProjectRoles.internal, ProjectRoles.translator, ProjectRoles.admin]),
  canReview: z.string().optional()
});

export const addProjectMemberAction = validatedActionWithProject(
  addMemberSchema,
  async (data, _, user) => {
    const t = await getTranslations('projectSettings');

    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { id: true }
    });
    if (!project) {
      return { error: t('projectNotFound') };
    }

    const member = await getMember(data.projectId, user.id);
    const creatorId = await getCreatorId(data.projectId);
    const { can } = createProjectPermissionChecker({ user, member, creatorId });
    if (!can([ProjectRoles.admin])) return { error: t('noPermission') };

    const targetUser = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true, isSystemAdmin: true, deletedAt: true }
    });
    if (!targetUser || targetUser.deletedAt) {
      return { error: t('userNotFound') };
    }
    if (targetUser.isSystemAdmin) {
      return { error: t('cannotAddSystemAdmin') };
    }

    const nextRole = data.role;

    if (nextRole === 'admin') {
      if (!can(['creator'])) {
        return { error: t('onlyCreatorCanManageAdmins') };
      }
      const adminCount = await prisma.projectMember.count({
        where: { projectId: data.projectId, role: 'admin' }
      });
      if (adminCount >= 3) {
        return { error: t('adminLimitReached') };
      }
    }

    const canReview = nextRole === 'translator' ? data.canReview === 'on' : false;

    const existingMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: data.projectId, userId: targetUser.id } },
      select: { id: true }
    });
    if (existingMember) {
      return { error: t('memberAlreadyExists') };
    }

    await prisma.projectMember.create({
      data: {
        projectId: data.projectId,
        userId: targetUser.id,
        role: nextRole,
        canReview
      }
    });

    redirect(`/projects/${data.projectId}/settings/members`);
  }
);

const updateMemberSchema = z.object({
  projectId: projectIdSchema,
  userId: z.coerce.number().int().positive(),
  role: z.string().min(1).max(20),
  canReview: z.string().optional()
});

export const updateProjectMemberAction = validatedActionWithProject(
  updateMemberSchema,
  async (data, _, user) => {
    const t = await getTranslations('projectSettings');

    const member = await getMember(data.projectId, user.id);
    const creatorId = await getCreatorId(data.projectId);
    const { can } = createProjectPermissionChecker({ user, member, creatorId });
    if (!can([ProjectRoles.admin])) return { error: t('noPermission') };

    const target = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: data.projectId, userId: data.userId } }
    });
    if (!target) {
      return { error: t('memberNotFound') };
    }

    const nextRole = data.role;
    const roleChangedAcrossAdmin =
      (target.role === 'admin' && nextRole !== 'admin') ||
      (target.role !== 'admin' && nextRole === 'admin');

    if (roleChangedAcrossAdmin) {
      if (!can(['creator'])) {
        return { error: t('onlyCreatorCanManageAdmins') };
      }
    }

    if (creatorId && data.userId === creatorId && nextRole !== 'admin') {
      return { error: t('creatorMustStayAdmin') };
    }

    if (nextRole === 'admin' && target.role !== 'admin') {
      const adminCount = await prisma.projectMember.count({
        where: { projectId: data.projectId, role: 'admin' }
      });
      if (adminCount >= 3) {
        return { error: t('adminLimitReached') };
      }
    }

    const canReview = nextRole === 'translator' ? data.canReview === 'on' : false;

    await prisma.projectMember.update({
      where: { projectId_userId: { projectId: data.projectId, userId: data.userId } },
      data: { role: nextRole, canReview }
    });

    redirect(`/projects/${data.projectId}/settings/members`);
  }
);

const removeMemberSchema = z.object({
  projectId: projectIdSchema,
  userId: z.coerce.number().int().positive()
});

export const removeProjectMemberAction = validatedActionWithProject(
  removeMemberSchema,
  async (data, _, user) => {
    const t = await getTranslations('projectSettings');

    const member = await getMember(data.projectId, user.id);
    const creatorId = await getCreatorId(data.projectId);
    const { can } = createProjectPermissionChecker({ user, member, creatorId });
    if (!can([ProjectRoles.admin])) return { error: t('noPermission') };
    if (creatorId && data.userId === creatorId) {
      return { error: t('cannotRemoveCreator') };
    }

    const target = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: data.projectId, userId: data.userId } }
    });
    if (!target) {
      return { error: t('memberNotFound') };
    }

    if (target.role === 'admin') {
      const adminCount = await prisma.projectMember.count({
        where: { projectId: data.projectId, role: 'admin' }
      });
      if (adminCount <= 1) {
        return { error: t('cannotRemoveLastAdmin') };
      }
    }

    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId: data.projectId, userId: data.userId } }
    });

    redirect(`/projects/${data.projectId}/settings/members`);
  }
);

const deleteProjectSchema = z.object({
  projectId: projectIdSchema,
  confirmName: z
    .string()
    .min(1, 'validations.projectNameRequired')
    .max(100, 'validations.projectNameMax')
});

export const deleteProjectAction = validatedActionWithProject(
  deleteProjectSchema,
  async (data, _, user) => {
    const t = await getTranslations('projectSettings');

    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { id: true, name: true }
    });
    if (!project) {
      return { error: t('projectNotFound') };
    }

    if (data.confirmName !== project.name) {
      return { error: t('deleteProjectNameMismatch') };
    }

    const creatorId = await getCreatorId(data.projectId);
    const { can } = createProjectPermissionChecker({
      user,
      member: null,
      creatorId
    });
    if (!user.isSystemAdmin && !creatorId) return { error: t('creatorNotSet') };
    if (!can(['creator'])) return { error: t('deleteProjectOnlyCreator') };

    try {
      await prisma.$transaction(async (tx) => {
        const pages = await tx.page.findMany({
          where: { projectId: data.projectId },
          select: { id: true }
        });
        const pageIds = pages.map((p) => p.id);

        await tx.translationPageLock.deleteMany({
          where: { projectId: data.projectId }
        });

        if (pageIds.length > 0) {
          await tx.entryPlacement.deleteMany({
            where: { pageId: { in: pageIds } }
          });
          await tx.module.deleteMany({
            where: { pageId: { in: pageIds } }
          });
          await tx.page.deleteMany({
            where: { id: { in: pageIds } }
          });
        } else {
          await tx.page.deleteMany({
            where: { projectId: data.projectId }
          });
        }

        await tx.translation.deleteMany({
          where: { projectId: data.projectId }
        });
        await tx.entry.deleteMany({
          where: { projectId: data.projectId }
        });

        await tx.projectGlossaryTerm.deleteMany({
          where: { projectId: data.projectId }
        });
        await tx.projectNegativePrompt.deleteMany({
          where: { projectId: data.projectId }
        });
        await tx.userProjectLocalePreference.deleteMany({
          where: { projectId: data.projectId }
        });
        await tx.projectInvitation.deleteMany({
          where: { projectId: data.projectId }
        });
        await tx.projectMember.deleteMany({
          where: { projectId: data.projectId }
        });
        await tx.projectLocale.deleteMany({
          where: { projectId: data.projectId }
        });

        await tx.project.delete({
          where: { id: data.projectId }
        });
      });
    } catch {
      return { error: t('deleteProjectFailed') };
    }

    redirect('/dashboard');
  }
);
