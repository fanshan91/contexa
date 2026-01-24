'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { validatedActionWithProject } from '@/lib/auth/middleware';
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
    if (!member || member.role !== 'admin') {
      return { error: t('noPermission') };
    }

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
    if (!member || member.role !== 'admin') {
      return { error: t('noPermission') };
    }

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
    if (!member || member.role !== 'admin') {
      return { error: t('noPermission') };
    }

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
  email: z.string().email().max(200),
  role: z.string().min(1).max(20),
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
    if (!user.isSystemAdmin && (!member || member.role !== 'admin')) {
      return { error: t('noPermission') };
    }

    const normalizedEmail = data.email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true }
    });

    const creatorId = await getCreatorId(data.projectId);
    const nextRole = data.role;

    if (nextRole === 'admin') {
      if (!creatorId || user.id !== creatorId) {
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

    if (!existingUser) {
      await prisma.projectInvitation.upsert({
        where: { projectId_email: { projectId: data.projectId, email: normalizedEmail } },
        update: { role: nextRole, canReview, invitedBy: user.id, status: 'pending' },
        create: {
          projectId: data.projectId,
          email: normalizedEmail,
          role: nextRole,
          canReview,
          invitedBy: user.id
        }
      });

      redirect(`/projects/${data.projectId}/settings/members`);
    }

    const existingMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: data.projectId, userId: existingUser.id } },
      select: { id: true }
    });
    if (existingMember) {
      return { error: t('memberAlreadyExists') };
    }

    await prisma.projectMember.create({
      data: {
        projectId: data.projectId,
        userId: existingUser.id,
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
    if (!user.isSystemAdmin && (!member || member.role !== 'admin')) {
      return { error: t('noPermission') };
    }

    const target = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: data.projectId, userId: data.userId } }
    });
    if (!target) {
      return { error: t('memberNotFound') };
    }

    const creatorId = await getCreatorId(data.projectId);
    const nextRole = data.role;
    const roleChangedAcrossAdmin =
      (target.role === 'admin' && nextRole !== 'admin') ||
      (target.role !== 'admin' && nextRole === 'admin');

    if (roleChangedAcrossAdmin) {
      if (!creatorId || user.id !== creatorId) {
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

    if (user.isSystemAdmin && !creatorId) {
      return { error: t('creatorNotSet') };
    }

    if (user.isSystemAdmin && nextRole === 'admin' && user.id !== creatorId) {
      return { error: t('onlyCreatorCanManageAdmins') };
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
    if (!user.isSystemAdmin && (!member || member.role !== 'admin')) {
      return { error: t('noPermission') };
    }

    const creatorId = await getCreatorId(data.projectId);
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

