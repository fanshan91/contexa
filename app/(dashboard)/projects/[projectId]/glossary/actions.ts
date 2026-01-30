'use server';

import crypto from 'node:crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db/prisma';
import { getUser } from '@/lib/db/queries';
import {
  getGlossaryAiConstraints,
  listGlossaryTerms,
  listNegativePrompts
} from '@/lib/glossary/repo';

const db = prisma as any;

const projectIdSchema = z.coerce.number().int().positive();

const localeSchema = z.string().trim().min(1).max(20);

const glossaryTypeSchema = z.enum(['recommended', 'forced']);
const glossaryStatusSchema = z.enum(['enabled', 'disabled']);

const listSchema = z.object({
  projectId: projectIdSchema,
  locale: localeSchema,
  query: z.string().trim().max(200).optional(),
  type: z.enum(['all', 'recommended', 'forced']).default('all'),
  status: z.enum(['all', 'enabled', 'disabled']).default('all'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

const listNegativeSchema = z.object({
  projectId: projectIdSchema,
  locale: localeSchema,
  query: z.string().trim().max(200).optional(),
  status: z.enum(['all', 'enabled', 'disabled']).default('all'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

const createTermSchema = z.object({
  projectId: projectIdSchema,
  locale: localeSchema,
  source: z.string().trim().min(1).max(200),
  target: z.string().trim().min(1).max(200),
  type: glossaryTypeSchema.default('recommended'),
  status: glossaryStatusSchema.default('enabled'),
  note: z.string().trim().max(500).optional()
});

const updateTermSchema = z.object({
  projectId: projectIdSchema,
  termId: z.coerce.number().int().positive(),
  locale: localeSchema,
  source: z.string().trim().min(1).max(200),
  target: z.string().trim().min(1).max(200),
  type: glossaryTypeSchema,
  status: glossaryStatusSchema,
  note: z.string().trim().max(500).optional()
});

const toggleTermStatusSchema = z.object({
  projectId: projectIdSchema,
  termId: z.coerce.number().int().positive(),
  nextStatus: glossaryStatusSchema
});

const deleteTermsSchema = z.object({
  projectId: projectIdSchema,
  termIds: z.array(z.coerce.number().int().positive()).min(1).max(200)
});

const createNegativeSchema = z.object({
  projectId: projectIdSchema,
  locale: localeSchema,
  phrase: z.string().trim().min(1).max(200),
  alternative: z.string().trim().max(200).optional(),
  note: z.string().trim().max(500).optional(),
  status: glossaryStatusSchema.default('enabled')
});

const updateNegativeSchema = z.object({
  projectId: projectIdSchema,
  promptId: z.coerce.number().int().positive(),
  locale: localeSchema,
  phrase: z.string().trim().min(1).max(200),
  alternative: z.string().trim().max(200).optional(),
  note: z.string().trim().max(500).optional(),
  status: glossaryStatusSchema
});

const toggleNegativeStatusSchema = z.object({
  projectId: projectIdSchema,
  promptId: z.coerce.number().int().positive(),
  nextStatus: glossaryStatusSchema
});

const deleteNegativeSchema = z.object({
  projectId: projectIdSchema,
  promptIds: z.array(z.coerce.number().int().positive()).min(1).max(200)
});

const aiConstraintsSchema = z.object({
  projectId: projectIdSchema,
  locale: localeSchema
});

export type GlossaryQueryResult<T> = { ok: true; data: T } | { ok: false; error: string };
export type GlossaryActionResult =
  | { ok: true; success: string }
  | { ok: false; error: string };

type AccessResult =
  | { ok: true; userId: number; canManage: boolean }
  | { ok: false; error: string };

async function getAccess(projectId: number): Promise<AccessResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: 'Unauthorized' };
  if (user.isSystemAdmin) return { ok: true, userId: user.id, canManage: true };

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
    select: { role: true }
  });
  if (!member) return { ok: false, error: 'No access to project' };

  return { ok: true, userId: user.id, canManage: member.role === 'admin' };
}

async function runQuery<TInput extends { projectId: number }, TResult>(
  schema: z.ZodSchema<TInput>,
  input: TInput,
  query: (data: TInput, access: { userId: number; canManage: boolean }) => Promise<TResult>
): Promise<GlossaryQueryResult<TResult>> {
  let userId: number | null = null;
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors[0].message };
    }

    const access = await getAccess(parsed.data.projectId);
    if (!access.ok) return { ok: false, error: access.error };
    userId = access.userId;

    const data = await query(parsed.data, { userId: access.userId, canManage: access.canManage });
    return { ok: true, data };
  } catch (error) {
    const debugId = crypto.randomUUID();
    console.error('projectGlossary query failed', { debugId, userId }, error);
    let message = 'Request failed';
    try {
      const t = await getTranslations('projectGlossary');
      message = t('toastFetchFailed');
    } catch {}
    if (process.env.NODE_ENV !== 'production') {
      message = `${message} (debugId: ${debugId})`;
    }
    return { ok: false, error: message };
  }
}

async function runAction<TInput extends { projectId: number }>(
  schema: z.ZodSchema<TInput>,
  input: TInput,
  action: (data: TInput, access: { userId: number; canManage: boolean }) => Promise<GlossaryActionResult>
): Promise<GlossaryActionResult> {
  let userId: number | null = null;
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors[0].message };
    }

    const access = await getAccess(parsed.data.projectId);
    if (!access.ok) return { ok: false, error: access.error };
    userId = access.userId;

    return await action(parsed.data, { userId: access.userId, canManage: access.canManage });
  } catch (error) {
    const debugId = crypto.randomUUID();
    console.error('projectGlossary action failed', { debugId, userId }, error);
    let message = 'Request failed';
    try {
      const t = await getTranslations('projectGlossary');
      message = t('toastActionFailed');
    } catch {}
    if (process.env.NODE_ENV !== 'production') {
      message = `${message} (debugId: ${debugId})`;
    }
    return { ok: false, error: message };
  }
}

export type GlossaryBootstrap = {
  targetLocales: string[];
  canManage: boolean;
};

export async function getGlossaryBootstrapQuery(projectId: number) {
  return runQuery(
    z.object({ projectId: projectIdSchema }),
    { projectId },
    async (data, access) => {
      const project = await prisma.project.findUnique({
        where: { id: data.projectId },
        select: { sourceLocale: true }
      });
      const locales = await prisma.projectLocale.findMany({
        where: { projectId: data.projectId },
        orderBy: { createdAt: 'asc' },
        select: { locale: true }
      });

      const targetLocales = locales
        .map((l) => l.locale)
        .filter((l) => (project?.sourceLocale ? l !== project.sourceLocale : true));

      return { targetLocales, canManage: access.canManage } satisfies GlossaryBootstrap;
    }
  );
}

export type GlossaryTermListItem = {
  id: number;
  source: string;
  target: string;
  type: 'recommended' | 'forced';
  status: 'enabled' | 'disabled';
  note: string;
  updatedAt: string;
  updatedBy: string;
};

export type GlossaryListResult = {
  items: GlossaryTermListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export async function listGlossaryTermsQuery(input: z.infer<typeof listSchema>) {
  return runQuery(listSchema, input, async (data) => {
    const page = data.page ?? 1;
    const pageSize = data.pageSize ?? 20;
    return await listGlossaryTerms(db, {
      projectId: data.projectId,
      locale: data.locale,
      query: data.query,
      type: data.type,
      status: data.status,
      page,
      pageSize
    });
  });
}

export type GlossaryAiConstraints = {
  locale: string;
  terms: Array<{ source: string; target: string; type: 'recommended' | 'forced' }>;
  negativePrompts: Array<{ phrase: string; alternative: string }>;
};

export async function getGlossaryAiConstraintsQuery(input: z.infer<typeof aiConstraintsSchema>) {
  return runQuery(aiConstraintsSchema, input, async (data) => {
    return await getGlossaryAiConstraints(db, { projectId: data.projectId, locale: data.locale });
  });
}

export async function createGlossaryTermAction(input: z.infer<typeof createTermSchema>) {
  return runAction(createTermSchema, input, async (data, access) => {
    const t = await getTranslations('projectGlossary');
    if (!access.canManage) return { ok: false, error: t('noPermission') };

    try {
      await db.projectGlossaryTerm.create({
        data: {
          projectId: data.projectId,
          locale: data.locale,
          source: data.source.trim(),
          target: data.target.trim(),
          type: data.type,
          status: data.status,
          note: data.note?.trim() ? data.note.trim() : null,
          createdByUserId: access.userId,
          updatedByUserId: access.userId
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') return { ok: false, error: t('formConflictErrorSimple') };
        if (error.code === 'P2003') return { ok: false, error: t('projectNotFound') };
        if (error.code === 'P2021' || error.code === 'P2022') {
          return { ok: false, error: t('databaseNotReady') };
        }
      }
      return { ok: false, error: t('toastActionFailed') };
    }

    revalidatePath(`/projects/${data.projectId}/glossary`);
    return { ok: true, success: t('toastCreatedMessage') };
  });
}

export async function updateGlossaryTermAction(input: z.infer<typeof updateTermSchema>) {
  return runAction(updateTermSchema, input, async (data, access) => {
    const t = await getTranslations('projectGlossary');
    if (!access.canManage) return { ok: false, error: t('noPermission') };

    try {
      const updated = await db.projectGlossaryTerm.updateMany({
        where: { id: data.termId, projectId: data.projectId },
        data: {
          locale: data.locale,
          source: data.source.trim(),
          target: data.target.trim(),
          type: data.type,
          status: data.status,
          note: data.note?.trim() ? data.note.trim() : null,
          updatedByUserId: access.userId
        }
      });
      if (updated.count === 0) return { ok: false, error: t('termNotFound') };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') return { ok: false, error: t('formConflictErrorSimple') };
      }
      return { ok: false, error: t('toastActionFailed') };
    }

    revalidatePath(`/projects/${data.projectId}/glossary`);
    return { ok: true, success: t('toastSavedMessage') };
  });
}

export async function toggleGlossaryTermStatusAction(
  input: z.infer<typeof toggleTermStatusSchema>
) {
  return runAction(toggleTermStatusSchema, input, async (data, access) => {
    const t = await getTranslations('projectGlossary');
    if (!access.canManage) return { ok: false, error: t('noPermission') };

    const updated = await db.projectGlossaryTerm.updateMany({
      where: { id: data.termId, projectId: data.projectId },
      data: { status: data.nextStatus, updatedByUserId: access.userId }
    });
    if (updated.count === 0) return { ok: false, error: t('termNotFound') };

    revalidatePath(`/projects/${data.projectId}/glossary`);
    return { ok: true, success: t('toastSavedMessage') };
  });
}

export async function deleteGlossaryTermsAction(input: z.infer<typeof deleteTermsSchema>) {
  return runAction(deleteTermsSchema, input, async (data, access) => {
    const t = await getTranslations('projectGlossary');
    if (!access.canManage) return { ok: false, error: t('noPermission') };

    await db.projectGlossaryTerm.deleteMany({
      where: { projectId: data.projectId, id: { in: data.termIds } }
    });

    revalidatePath(`/projects/${data.projectId}/glossary`);
    return { ok: true, success: t('toastDeletedMessage') };
  });
}

export type NegativePromptListItem = {
  id: number;
  phrase: string;
  alternative: string;
  note: string;
  status: 'enabled' | 'disabled';
  updatedAt: string;
  updatedBy: string;
};

export type NegativePromptListResult = {
  items: NegativePromptListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export async function listNegativePromptsQuery(input: z.infer<typeof listNegativeSchema>) {
  return runQuery(listNegativeSchema, input, async (data) => {
    const page = data.page ?? 1;
    const pageSize = data.pageSize ?? 20;
    return await listNegativePrompts(db, {
      projectId: data.projectId,
      locale: data.locale,
      query: data.query,
      status: data.status,
      page,
      pageSize
    });
  });
}

export async function createNegativePromptAction(input: z.infer<typeof createNegativeSchema>) {
  return runAction(createNegativeSchema, input, async (data, access) => {
    const t = await getTranslations('projectGlossary');
    if (!access.canManage) return { ok: false, error: t('noPermission') };

    try {
      await db.projectNegativePrompt.create({
        data: {
          projectId: data.projectId,
          locale: data.locale,
          phrase: data.phrase.trim(),
          alternative: data.alternative?.trim() ? data.alternative.trim() : null,
          note: data.note?.trim() ? data.note.trim() : null,
          status: data.status,
          createdByUserId: access.userId,
          updatedByUserId: access.userId
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') return { ok: false, error: t('negativeConflictError') };
      }
      return { ok: false, error: t('toastActionFailed') };
    }

    revalidatePath(`/projects/${data.projectId}/glossary`);
    return { ok: true, success: t('negativeToastCreated') };
  });
}

export async function updateNegativePromptAction(input: z.infer<typeof updateNegativeSchema>) {
  return runAction(updateNegativeSchema, input, async (data, access) => {
    const t = await getTranslations('projectGlossary');
    if (!access.canManage) return { ok: false, error: t('noPermission') };

    try {
      const updated = await db.projectNegativePrompt.updateMany({
        where: { id: data.promptId, projectId: data.projectId },
        data: {
          locale: data.locale,
          phrase: data.phrase.trim(),
          alternative: data.alternative?.trim() ? data.alternative.trim() : null,
          note: data.note?.trim() ? data.note.trim() : null,
          status: data.status,
          updatedByUserId: access.userId
        }
      });
      if (updated.count === 0) return { ok: false, error: t('negativeNotFound') };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') return { ok: false, error: t('negativeConflictError') };
      }
      return { ok: false, error: t('toastActionFailed') };
    }

    revalidatePath(`/projects/${data.projectId}/glossary`);
    return { ok: true, success: t('negativeToastSaved') };
  });
}

export async function toggleNegativePromptStatusAction(
  input: z.infer<typeof toggleNegativeStatusSchema>
) {
  return runAction(toggleNegativeStatusSchema, input, async (data, access) => {
    const t = await getTranslations('projectGlossary');
    if (!access.canManage) return { ok: false, error: t('noPermission') };

    const updated = await db.projectNegativePrompt.updateMany({
      where: { id: data.promptId, projectId: data.projectId },
      data: { status: data.nextStatus, updatedByUserId: access.userId }
    });
    if (updated.count === 0) return { ok: false, error: t('negativeNotFound') };

    revalidatePath(`/projects/${data.projectId}/glossary`);
    return { ok: true, success: t('negativeToastSaved') };
  });
}

export async function deleteNegativePromptsAction(input: z.infer<typeof deleteNegativeSchema>) {
  return runAction(deleteNegativeSchema, input, async (data, access) => {
    const t = await getTranslations('projectGlossary');
    if (!access.canManage) return { ok: false, error: t('noPermission') };

    await db.projectNegativePrompt.deleteMany({
      where: { projectId: data.projectId, id: { in: data.promptIds } }
    });

    revalidatePath(`/projects/${data.projectId}/glossary`);
    return { ok: true, success: t('negativeToastDeleted') };
  });
}
