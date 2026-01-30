'use server';

import crypto from 'node:crypto';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getUser } from '@/lib/db/queries';
import type { ContextEntry, ContextPage } from './context-model';

const projectIdSchema = z.coerce.number().int().positive();

export type ContextActionResult =
  | { ok: true; success: string }
  | { ok: false; error: string };

export type ContextQueryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const createPageSchema = z.object({
  projectId: projectIdSchema,
  route: z.string().trim().min(1),
  title: z.string().trim().optional(),
  description: z.string().trim().optional()
});

const updatePageSchema = z.object({
  projectId: projectIdSchema,
  pageId: z.coerce.number().int().positive(),
  description: z.string().trim().optional()
});

const deletePageSchema = z.object({
  projectId: projectIdSchema,
  pageId: z.coerce.number().int().positive()
});

const createModuleSchema = z.object({
  projectId: projectIdSchema,
  pageId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1),
  description: z.string().trim().optional()
});

const updateModuleSchema = z.object({
  projectId: projectIdSchema,
  moduleId: z.coerce.number().int().positive(),
  description: z.string().trim().optional()
});

const deleteModuleSchema = z.object({
  projectId: projectIdSchema,
  moduleId: z.coerce.number().int().positive()
});

const bindEntriesSchema = z.object({
  projectId: projectIdSchema,
  pageId: z.coerce.number().int().positive(),
  moduleId: z.coerce.number().int().positive().optional(),
  entryIds: z.array(z.coerce.number().int().positive())
});

const unbindEntriesSchema = z.object({
  projectId: projectIdSchema,
  pageId: z.coerce.number().int().positive(),
  moduleId: z.coerce.number().int().positive().optional(),
  entryIds: z.array(z.coerce.number().int().positive())
});

const getBoundEntriesSchema = z.object({
  projectId: projectIdSchema,
  pageId: z.coerce.number().int().positive(),
  moduleId: z.coerce.number().int().positive().optional()
});

const searchEntriesSchema = z.object({
  projectId: projectIdSchema,
  query: z.string().trim().max(200),
  limit: z.coerce.number().int().positive().max(200).optional()
});

function toIsoString(date: Date) {
  return date.toISOString();
}

function nullableId(id?: number) {
  return typeof id === 'number' ? id : null;
}

async function checkProjectAccess(projectId: number) {
  const user = await getUser();
  if (!user) return { ok: false as const, error: 'Unauthorized' };
  if (user.isSystemAdmin) return { ok: true as const, user };

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } }
  });
  if (!member) return { ok: false as const, error: 'No access to project' };

  return { ok: true as const, user };
}

async function runProjectAction<TInput extends { projectId: number }>(
  schema: z.ZodSchema<TInput>,
  input: TInput,
  action: (data: TInput) => Promise<ContextActionResult>
): Promise<ContextActionResult> {
  let userId: number | null = null;
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors[0].message };
    }

    const access = await checkProjectAccess(parsed.data.projectId);
    if (!access.ok) return { ok: false, error: access.error };
    userId = access.user.id;

    return await action(parsed.data);
  } catch (error) {
    const debugId = crypto.randomUUID();
    console.error('projectContext action failed', { debugId, userId }, error);
    let message = 'Request failed';
    try {
      const t = await getTranslations('projectContext');
      message = t('toast.createFailed');
    } catch {}
    if (process.env.NODE_ENV !== 'production') {
      message = `${message} (debugId: ${debugId})`;
    }
    return { ok: false, error: message };
  }
}

async function runProjectQuery<TInput extends { projectId: number }, TResult>(
  schema: z.ZodSchema<TInput>,
  input: TInput,
  query: (data: TInput) => Promise<TResult>
): Promise<ContextQueryResult<TResult>> {
  let userId: number | null = null;
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors[0].message };
    }

    const access = await checkProjectAccess(parsed.data.projectId);
    if (!access.ok) return { ok: false, error: access.error };
    userId = access.user.id;

    const data = await query(parsed.data);
    return { ok: true, data };
  } catch (error) {
    const debugId = crypto.randomUUID();
    console.error('projectContext query failed', { debugId, userId }, error);
    let message = 'Request failed';
    try {
      const t = await getTranslations('projectContext');
      message = t('toast.fetchFailed');
    } catch {}
    if (process.env.NODE_ENV !== 'production') {
      message = `${message} (debugId: ${debugId})`;
    }
    return { ok: false, error: message };
  }
}

export async function createPageAction(input: z.infer<typeof createPageSchema>) {
  return runProjectAction(createPageSchema, input, async (data) => {
    const t = await getTranslations('projectContext');
    try {
      await prisma.page.create({
        data: {
          projectId: data.projectId,
          route: data.route,
          title: data.title,
          description: data.description
        }
      });
      revalidatePath(`/projects/${data.projectId}/context`);
      return { ok: true, success: t('toast.pageCreated') };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          return { ok: false, error: t('toast.pageRouteExists') };
        }
        if (error.code === 'P2003') {
          return { ok: false, error: t('toast.projectNotFound') };
        }
        if (error.code === 'P2021' || error.code === 'P2022') {
          return { ok: false, error: t('toast.databaseNotReady') };
        }
      }
      return { ok: false, error: t('toast.createFailed') };
    }
  });
}

export async function updatePageAction(input: z.infer<typeof updatePageSchema>) {
  return runProjectAction(updatePageSchema, input, async (data) => {
    const t = await getTranslations('projectContext');
    const updated = await prisma.page.updateMany({
      where: { id: data.pageId, projectId: data.projectId },
      data: { description: data.description }
    });
    if (updated.count === 0) {
      return { ok: false, error: t('toast.pageNotFound') };
    }

    revalidatePath(`/projects/${data.projectId}/context`);
    return { ok: true, success: t('toast.descriptionSaved') };
  });
}

export async function deletePageAction(input: z.infer<typeof deletePageSchema>) {
  return runProjectAction(deletePageSchema, input, async (data) => {
    const t = await getTranslations('projectContext');

    const exists = await prisma.page.findFirst({
      where: { id: data.pageId, projectId: data.projectId },
      select: { id: true }
    });
    if (!exists) {
      return { ok: false, error: t('toast.pageNotFound') };
    }

    await prisma.$transaction(async (tx) => {
      await tx.module.deleteMany({ where: { pageId: data.pageId } });
      await tx.entryPlacement.deleteMany({ where: { pageId: data.pageId } });
      await tx.page.delete({ where: { id: data.pageId } });
    });

    revalidatePath(`/projects/${data.projectId}/context`);
    return { ok: true, success: t('toast.pageDeleted') };
  });
}

export async function createModuleAction(input: z.infer<typeof createModuleSchema>) {
  return runProjectAction(createModuleSchema, input, async (data) => {
    const t = await getTranslations('projectContext');

    const page = await prisma.page.findFirst({
      where: { id: data.pageId, projectId: data.projectId },
      select: { id: true }
    });
    if (!page) {
      return { ok: false, error: t('toast.pageNotFound') };
    }

    try {
      await prisma.module.create({
        data: {
          pageId: data.pageId,
          name: data.name,
          description: data.description
        }
      });
      revalidatePath(`/projects/${data.projectId}/context`);
      return { ok: true, success: t('toast.moduleCreated') };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          return { ok: false, error: t('toast.pageNotFound') };
        }
        if (error.code === 'P2021' || error.code === 'P2022') {
          return { ok: false, error: t('toast.databaseNotReady') };
        }
      }
      return { ok: false, error: t('toast.createFailed') };
    }
  });
}

export async function updateModuleAction(input: z.infer<typeof updateModuleSchema>) {
  return runProjectAction(updateModuleSchema, input, async (data) => {
    const t = await getTranslations('projectContext');

    const updated = await prisma.module.updateMany({
      where: { id: data.moduleId, page: { projectId: data.projectId } },
      data: { description: data.description }
    });
    if (updated.count === 0) {
      return { ok: false, error: t('toast.updateFailed') };
    }

    revalidatePath(`/projects/${data.projectId}/context`);
    return { ok: true, success: t('toast.descriptionSaved') };
  });
}

export async function deleteModuleAction(input: z.infer<typeof deleteModuleSchema>) {
  return runProjectAction(deleteModuleSchema, input, async (data) => {
    const t = await getTranslations('projectContext');

    const mod = await prisma.module.findFirst({
      where: { id: data.moduleId, page: { projectId: data.projectId } },
      select: { id: true }
    });
    if (!mod) {
      return { ok: false, error: t('toast.deleteFailed') };
    }

    await prisma.$transaction(async (tx) => {
      await tx.entryPlacement.deleteMany({ where: { moduleId: data.moduleId } });
      await tx.module.delete({ where: { id: data.moduleId } });
    });

    revalidatePath(`/projects/${data.projectId}/context`);
    return { ok: true, success: t('toast.moduleDeleted') };
  });
}

export async function bindEntriesAction(input: z.infer<typeof bindEntriesSchema>) {
  return runProjectAction(bindEntriesSchema, input, async (data) => {
    const t = await getTranslations('projectContext');

    const page = await prisma.page.findFirst({
      where: { id: data.pageId, projectId: data.projectId },
      select: { id: true }
    });
    if (!page) {
      return { ok: false, error: t('toast.pageNotFound') };
    }

    if (typeof data.moduleId === 'number') {
      const mod = await prisma.module.findFirst({
        where: { id: data.moduleId, pageId: data.pageId },
        select: { id: true }
      });
      if (!mod) {
        return { ok: false, error: t('toast.bindFailed') };
      }
    }

    const entryIds = Array.from(new Set(data.entryIds));
    const validEntries = await prisma.entry.count({
      where: { projectId: data.projectId, id: { in: entryIds } }
    });
    if (validEntries !== entryIds.length) {
      return { ok: false, error: t('toast.bindFailed') };
    }

    if (typeof data.moduleId === 'number') {
      const moduleId = data.moduleId;
      await prisma.$transaction(
        entryIds.map((entryId) =>
          prisma.entryPlacement.upsert({
            where: {
              entryId_pageId_moduleId: {
                entryId,
                pageId: data.pageId,
                moduleId
              }
            },
            update: {},
            create: {
              entryId,
              pageId: data.pageId,
              moduleId
            }
          })
        )
      );
    } else {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.entryPlacement.findMany({
          where: {
            pageId: data.pageId,
            moduleId: null,
            entryId: { in: entryIds }
          },
          select: { entryId: true }
        });

        const existingIds = new Set(existing.map((p) => p.entryId));
        const missingEntryIds = entryIds.filter((id) => !existingIds.has(id));
        if (missingEntryIds.length === 0) return;

        await tx.entryPlacement.createMany({
          data: missingEntryIds.map((entryId) => ({
            entryId,
            pageId: data.pageId,
            moduleId: null
          }))
        });
      });
    }

    revalidatePath(`/projects/${data.projectId}/context`);
    return { ok: true, success: t('toast.bound', { count: entryIds.length }) };
  });
}

export async function unbindEntriesAction(input: z.infer<typeof unbindEntriesSchema>) {
  return runProjectAction(unbindEntriesSchema, input, async (data) => {
    const t = await getTranslations('projectContext');

    const page = await prisma.page.findFirst({
      where: { id: data.pageId, projectId: data.projectId },
      select: { id: true }
    });
    if (!page) {
      return { ok: false, error: t('toast.pageNotFound') };
    }

    if (typeof data.moduleId === 'number') {
      const mod = await prisma.module.findFirst({
        where: { id: data.moduleId, pageId: data.pageId },
        select: { id: true }
      });
      if (!mod) {
        return { ok: false, error: t('toast.unbindFailed') };
      }
    }

    const entryIds = Array.from(new Set(data.entryIds));
    await prisma.entryPlacement.deleteMany({
      where: {
        pageId: data.pageId,
        moduleId: nullableId(data.moduleId),
        entryId: { in: entryIds }
      }
    });

    revalidatePath(`/projects/${data.projectId}/context`);
    return { ok: true, success: t('toast.unbound', { count: entryIds.length }) };
  });
}

export async function getProjectContextTree(projectId: number): Promise<ContextPage[]> {
  const [pages, placements] = await Promise.all([
    prisma.page.findMany({
      where: { projectId },
      orderBy: { route: 'asc' },
      select: {
        id: true,
        projectId: true,
        route: true,
        title: true,
        description: true,
        updatedAt: true,
        modules: {
          orderBy: { name: 'asc' },
          select: {
            id: true,
            pageId: true,
            name: true,
            description: true,
            updatedAt: true
          }
        }
      }
    }),
    prisma.entryPlacement.findMany({
      where: { page: { projectId } },
      select: { pageId: true, moduleId: true, entryId: true }
    })
  ]);

  const pageEntryIds = new Map<number, Set<number>>();
  const moduleEntryIds = new Map<number, Set<number>>();

  for (const placement of placements) {
    const pageSet = pageEntryIds.get(placement.pageId) ?? new Set<number>();
    pageSet.add(placement.entryId);
    pageEntryIds.set(placement.pageId, pageSet);

    if (typeof placement.moduleId === 'number') {
      const moduleSet = moduleEntryIds.get(placement.moduleId) ?? new Set<number>();
      moduleSet.add(placement.entryId);
      moduleEntryIds.set(placement.moduleId, moduleSet);
    }
  }

  const sorted = [...pages].sort((a, b) => {
    const nameA = a.title || a.route;
    const nameB = b.title || b.route;
    return nameA.localeCompare(nameB);
  });

  return sorted.map((p) => ({
    ...p,
    keyCount: pageEntryIds.get(p.id)?.size ?? 0,
    updatedAt: toIsoString(p.updatedAt),
    modules: p.modules.map((m) => ({
      ...m,
      keyCount: moduleEntryIds.get(m.id)?.size ?? 0,
      updatedAt: toIsoString(m.updatedAt)
    }))
  }));
}

export async function getBoundEntriesAction(input: z.infer<typeof getBoundEntriesSchema>) {
  return runProjectQuery(getBoundEntriesSchema, input, async (data) => {
    const placements = await prisma.entryPlacement.findMany({
      where: {
        pageId: data.pageId,
        moduleId: nullableId(data.moduleId),
        entry: { projectId: data.projectId }
      },
      include: { entry: { select: { id: true, key: true, sourceText: true, updatedAt: true } } },
      orderBy: { entryId: 'asc' }
    });

    return placements.map((p): ContextEntry => ({
      id: p.entry.id,
      key: p.entry.key,
      sourceText: p.entry.sourceText,
      updatedAt: toIsoString(p.entry.updatedAt)
    }));
  });
}

export async function searchEntriesAction(input: z.infer<typeof searchEntriesSchema>) {
  return runProjectQuery(searchEntriesSchema, input, async (data) => {
    const list = await prisma.entry.findMany({
      where: {
        projectId: data.projectId,
        OR: [{ key: { contains: data.query } }, { sourceText: { contains: data.query } }]
      },
      take: data.limit ?? 50,
      orderBy: { key: 'asc' },
      select: { id: true, key: true, sourceText: true, updatedAt: true }
    });

    return list.map((e): ContextEntry => ({
      id: e.id,
      key: e.key,
      sourceText: e.sourceText,
      updatedAt: toIsoString(e.updatedAt)
    }));
  });
}
