import 'server-only';

import { prisma } from '@/lib/db/prisma';

const ROOT_MODULE_NAME = '__root__';

type ApplyOp = {
  kind: 'unregistered' | 'add' | 'move' | 'delete_suggestion';
  key: string;
  sourceText?: string;
  entryId?: number | null;
  currentModuleId?: number | null;
  action: 'ignore' | 'bind' | 'delete';
  targetPageId?: number | null;
  targetModuleId?: number | null;
};

async function getProjectLocales(projectId: number) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { locales: true }
  });
  if (!project) return null;
  return { sourceLocale: project.sourceLocale, locales: project.locales.map((l) => l.locale) };
}

export async function applyRuntimeDiffOperations(input: { projectId: number; operations: ApplyOp[] }) {
  const localeConfig = await getProjectLocales(input.projectId);
  if (!localeConfig) return { ok: false as const, error: '项目不存在' };
  const targetLocales = localeConfig.locales.filter((l) => l !== localeConfig.sourceLocale);

  const ops = input.operations.filter((o) => o.action !== 'ignore');
  if (ops.length === 0) return { ok: true as const };

  await prisma.$transaction(async (tx) => {
    const existingEntries = await tx.entry.findMany({
      where: { projectId: input.projectId, key: { in: ops.map((o) => o.key) } },
      select: { id: true, key: true }
    });
    const entryIdByKey = new Map(existingEntries.map((e) => [e.key, e.id] as const));

    const ensureEntry = async (key: string, sourceText: string) => {
      const existingId = entryIdByKey.get(key);
      if (existingId) return existingId;
      const created = await tx.entry.create({
        data: {
          projectId: input.projectId,
          key,
          sourceText,
          sourceLocale: localeConfig.sourceLocale
        },
        select: { id: true }
      });
      entryIdByKey.set(key, created.id);
      if (targetLocales.length) {
        await tx.translation.createMany({
          data: targetLocales.map((locale) => ({
            entryId: created.id,
            projectId: input.projectId,
            locale,
            text: null,
            status: 'pending'
          }))
        });
      }
      return created.id;
    };

    const ensureRootModuleId = async (pageId: number) => {
      const existing = await tx.module.findFirst({
        where: { pageId, name: ROOT_MODULE_NAME },
        select: { id: true }
      });
      if (existing) return existing.id;
      try {
        const created = await tx.module.create({
          data: { pageId, name: ROOT_MODULE_NAME },
          select: { id: true }
        });
        return created.id;
      } catch (error: any) {
        if (error?.code === 'P2002') {
          const after = await tx.module.findFirst({
            where: { pageId, name: ROOT_MODULE_NAME },
            select: { id: true }
          });
          if (after) return after.id;
        }
        throw error;
      }
    };

    for (const op of ops) {
      if (op.action === 'delete') {
        if (!op.entryId || !op.currentModuleId) continue;
        await tx.entryPlacement.deleteMany({
          where: { entryId: op.entryId, moduleId: op.currentModuleId }
        });
        continue;
      }

      if (op.action !== 'bind') continue;
      const targetPageId = op.targetPageId ?? null;
      if (!targetPageId) continue;
      const targetModuleId =
        typeof op.targetModuleId === 'number' ? op.targetModuleId : await ensureRootModuleId(targetPageId);

      const entryId =
        typeof op.entryId === 'number'
          ? op.entryId
          : await ensureEntry(op.key, op.sourceText?.trim() ? op.sourceText.trim() : '—');

      if (op.currentModuleId && op.kind === 'move') {
        await tx.entryPlacement.deleteMany({
          where: { entryId, moduleId: op.currentModuleId }
        });
      }

      await tx.entryPlacement
        .create({
          data: { entryId, moduleId: targetModuleId }
        })
        .catch(() => null);
    }
  });

  return { ok: true as const };
}

