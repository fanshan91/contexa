'use server';

import crypto from 'node:crypto';
import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db/prisma';
import { getProjectPermissionChecker } from '@/lib/auth/project-permissions-server';
import { parseLanguagePack } from '@/lib/packages/language-pack-parser';
import { importSourcePack, importTargetPack } from '@/lib/packages/repo';

const projectIdSchema = z.coerce.number().int().positive();
const localeSchema = z.string().trim().min(1).max(20);

export type PackagesQueryResult<T> = { ok: true; data: T } | { ok: false; error: string };
export type PackagesActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type PackagesBootstrap = {
  sourceLocale: string;
  targetLocales: string[];
  canManage: boolean;
  templateShape: 'flat' | 'tree';
};

async function getProjectTemplateShape(projectId: number): Promise<'flat' | 'tree'> {
  const key = `project:${projectId}:langpack:shape`;
  const meta = await prisma.systemMeta.findUnique({ where: { key } });
  return meta?.value === 'tree' ? 'tree' : 'flat';
}

async function getProjectTemplatePaths(projectId: number): Promise<string[][]> {
  const key = `project:${projectId}:langpack:template`;
  const meta = await prisma.systemMeta.findUnique({ where: { key } });
  if (!meta?.value) return [];
  try {
    const parsed = JSON.parse(meta.value) as string[][];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => Array.isArray(p) && p.every((s) => typeof s === 'string'));
  } catch {
    return [];
  }
}

async function upsertProjectTemplatePaths(projectId: number, incoming: string[][]) {
  const key = `project:${projectId}:langpack:template`;
  const existing = await getProjectTemplatePaths(projectId);
  const existingSet = new Set(existing.map((p) => p.join('.')));
  const next = [...existing];
  for (const path of incoming) {
    const signature = path.join('.');
    if (!signature) continue;
    if (existingSet.has(signature)) continue;
    existingSet.add(signature);
    next.push(path);
  }
  if (next.length === existing.length) return;
  const value = JSON.stringify(next);
  await prisma.systemMeta.upsert({
    where: { key },
    update: { value },
    create: { key, value, description: 'language pack template paths for export' }
  });
}

export async function getPackagesBootstrapQuery(projectId: number): Promise<PackagesQueryResult<PackagesBootstrap>> {
  try {
    const { can } = await getProjectPermissionChecker(projectId, true);
    const canManage = can(['admin', 'creator']);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { sourceLocale: true }
    });
    if (!project) return { ok: false, error: '项目不存在' };

    const locales = await prisma.projectLocale.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      select: { locale: true }
    });

    const targetLocales = locales.map((l) => l.locale).filter((l) => l !== project.sourceLocale);

    const templateShape = await getProjectTemplateShape(projectId);
    return { ok: true, data: { sourceLocale: project.sourceLocale, targetLocales, canManage, templateShape } };
  } catch (error) {
    const debugId = crypto.randomUUID();
    console.error('projectPackages bootstrap query failed', { debugId, projectId }, error);
    return { ok: false, error: `请求失败 (debugId: ${debugId})` };
  }
}

export type PackagesEntryTranslation = {
  text: string;
  status: 'pending' | 'needs_update' | 'needs_review' | 'ready' | 'approved';
  updatedAt: string;
};

export type PackagesEntry = {
  id: number;
  key: string;
  sourceText: string;
  createdAt: string;
  updatedAt: string;
  translations: Record<string, PackagesEntryTranslation | undefined>;
};

export type PackagesEntriesResult = {
  items: PackagesEntry[];
  total: number;
};

export async function listPackagesEntriesQuery(projectId: number): Promise<PackagesQueryResult<PackagesEntriesResult>> {
  try {
    await getProjectPermissionChecker(projectId);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { sourceLocale: true }
    });
    if (!project) return { ok: false, error: '项目不存在' };

    const locales = await prisma.projectLocale.findMany({
      where: { projectId },
      select: { locale: true }
    });
    const targetLocales = locales.map((l) => l.locale).filter((l) => l !== project.sourceLocale);

    const entries = await prisma.entry.findMany({
      where: { projectId },
      orderBy: { key: 'asc' },
      select: {
        id: true,
        key: true,
        sourceText: true,
        createdAt: true,
        updatedAt: true,
        translations: {
          where: { locale: { in: targetLocales } },
          select: { locale: true, text: true, status: true, updatedAt: true }
        }
      }
    });

    const items: PackagesEntry[] = entries.map((e) => {
      const translations: PackagesEntry['translations'] = {};
      for (const tr of e.translations) {
        translations[tr.locale] = {
          text: tr.text ?? '',
          status: tr.status,
          updatedAt: tr.updatedAt.toISOString()
        };
      }
      return {
        id: e.id,
        key: e.key,
        sourceText: e.sourceText,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
        translations
      };
    });

    return { ok: true, data: { items, total: items.length } };
  } catch (error) {
    const debugId = crypto.randomUUID();
    console.error('projectPackages list entries query failed', { debugId, projectId }, error);
    return { ok: false, error: `请求失败 (debugId: ${debugId})` };
  }
}

const importSchema = z.object({
  projectId: projectIdSchema,
  locale: localeSchema,
  rawJson: z.string().min(1).max(5_000_000)
});

export type ImportLanguagePackResult =
  | {
      kind: 'source';
      shape: 'flat' | 'tree';
      summary: { added: number; updated: number; markedNeedsUpdate: number };
    }
  | {
      kind: 'target';
      shape: 'flat' | 'tree';
      summary: { updated: number; ignored: number; skippedEmpty: number };
    };

export async function importLanguagePackAction(
  input: z.infer<typeof importSchema>
): Promise<PackagesActionResult<ImportLanguagePackResult>> {
  let userId: number | null = null;
  try {
    const parsed = importSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

    const { user, can } = await getProjectPermissionChecker(parsed.data.projectId, true);
    userId = user.id;
    if (!can(['admin', 'creator'])) return { ok: false, error: '无权限执行导入操作' };

    const project = await prisma.project.findUnique({
      where: { id: parsed.data.projectId },
      select: { sourceLocale: true }
    });
    if (!project) return { ok: false, error: '项目不存在' };

    const locales = await prisma.projectLocale.findMany({
      where: { projectId: parsed.data.projectId },
      select: { locale: true }
    });
    const localeSet = new Set(locales.map((l) => l.locale));

    if (parsed.data.locale !== project.sourceLocale && !localeSet.has(parsed.data.locale)) {
      return { ok: false, error: '导入语言不在项目语言范围内' };
    }

    const parsedPack = parseLanguagePack(parsed.data.rawJson);
    if (!parsedPack.ok) return { ok: false, error: parsedPack.error };
    if (parsedPack.data.drafts.length > 50_000) {
      return { ok: false, error: '文件过大：单次导入最多支持 50,000 条。' };
    }

    if (parsed.data.locale === project.sourceLocale) {
      const targetLocales = Array.from(localeSet).filter((l) => l !== project.sourceLocale);
      const summary = await importSourcePack(prisma, {
        projectId: parsed.data.projectId,
        sourceLocale: project.sourceLocale,
        targetLocales,
        drafts: parsedPack.data.drafts
      });

      const shapeKey = `project:${parsed.data.projectId}:langpack:shape`;
      const existingShape = await prisma.systemMeta.findUnique({ where: { key: shapeKey } });
      if (!existingShape) {
        await prisma.systemMeta.create({
          data: { key: shapeKey, value: parsedPack.data.shape, description: 'language pack structure shape for export' }
        });
      }
      if ((existingShape?.value ?? parsedPack.data.shape) === 'tree' && parsedPack.data.shape === 'tree') {
        await upsertProjectTemplatePaths(
          parsed.data.projectId,
          parsedPack.data.drafts.map((d) => d.originalPath)
        );
      }

      return { ok: true, data: { kind: 'source', shape: parsedPack.data.shape, summary } };
    }

    const t = await getTranslations('projectPackages');
    const targetLocales = Array.from(localeSet).filter((l) => l !== project.sourceLocale);
    if (!targetLocales.includes(parsed.data.locale)) {
      return { ok: false, error: t('emptyTargetLocalesTitle') };
    }

    const summary = await importTargetPack(prisma, {
      projectId: parsed.data.projectId,
      locale: parsed.data.locale,
      drafts: parsedPack.data.drafts
    });

    return { ok: true, data: { kind: 'target', shape: parsedPack.data.shape, summary } };
  } catch (error) {
    const debugId = crypto.randomUUID();
    console.error('projectPackages import failed', { debugId, userId }, error);
    return { ok: false, error: `导入失败 (debugId: ${debugId})` };
  }
}

const exportSchema = z.object({
  projectId: projectIdSchema,
  locale: localeSchema,
  mode: z.enum(['empty', 'fallback', 'filled'])
});

export type ExportLanguagePackResult = {
  fileName: string;
  content: string;
};

function setPathValue(target: Record<string, unknown>, path: string[], value: string) {
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < path.length; i += 1) {
    const seg = path[i];
    if (!seg) return;
    if (i === path.length - 1) {
      cursor[seg] = value;
      return;
    }
    const next = cursor[seg];
    if (typeof next !== 'object' || next === null || Array.isArray(next)) {
      cursor[seg] = {};
    }
    cursor = cursor[seg] as Record<string, unknown>;
  }
}

export async function exportLanguagePackAction(
  input: z.infer<typeof exportSchema>
): Promise<PackagesActionResult<ExportLanguagePackResult>> {
  try {
    const parsed = exportSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

    await getProjectPermissionChecker(parsed.data.projectId);

    const project = await prisma.project.findUnique({
      where: { id: parsed.data.projectId },
      select: { sourceLocale: true }
    });
    if (!project) return { ok: false, error: '项目不存在' };

    const locales = await prisma.projectLocale.findMany({
      where: { projectId: parsed.data.projectId },
      select: { locale: true }
    });
    const localeSet = new Set(locales.map((l) => l.locale));
    if (parsed.data.locale !== project.sourceLocale && !localeSet.has(parsed.data.locale)) {
      return { ok: false, error: '导出语言不在项目语言范围内' };
    }

    const entries = await prisma.entry.findMany({
      where: { projectId: parsed.data.projectId },
      orderBy: { key: 'asc' },
      select: {
        key: true,
        sourceText: true,
        translations: {
          where: { locale: parsed.data.locale },
          select: { text: true }
        }
      }
    });

    const isSource = parsed.data.locale === project.sourceLocale;
    const outMap: Record<string, string> = {};
    for (const e of entries) {
      if (isSource) {
        outMap[e.key] = e.sourceText;
        continue;
      }
      const tr = e.translations[0];
      const hasText = Boolean(tr?.text?.trim());
      if (parsed.data.mode === 'filled' && !hasText) continue;
      if (hasText) outMap[e.key] = tr!.text as string;
      else outMap[e.key] = parsed.data.mode === 'fallback' ? e.sourceText : '';
    }

    const shape = await getProjectTemplateShape(parsed.data.projectId);
    if (shape === 'flat') {
      return {
        ok: true,
        data: {
          fileName: `project-${parsed.data.projectId}.${parsed.data.locale}.json`,
          content: JSON.stringify(outMap, null, 2)
        }
      };
    }

    const templatePaths = await getProjectTemplatePaths(parsed.data.projectId);
    const fallbackPaths = Object.keys(outMap).map((k) => k.split('.'));
    const paths = templatePaths.length > 0 ? templatePaths : fallbackPaths;

    const tree: Record<string, unknown> = {};
    for (const path of paths) {
      const key = path.join('.');
      if (!key) continue;
      const value = outMap[key] ?? '';
      setPathValue(tree, path, value);
    }

    for (const key of Object.keys(outMap)) {
      if (paths.some((p) => p.join('.') === key)) continue;
      setPathValue(tree, key.split('.'), outMap[key]);
    }

    return {
      ok: true,
      data: {
        fileName: `project-${parsed.data.projectId}.${parsed.data.locale}.json`,
        content: JSON.stringify(tree, null, 2)
      }
    };
  } catch (error) {
    const debugId = crypto.randomUUID();
    console.error('projectPackages export failed', { debugId }, error);
    return { ok: false, error: `导出失败 (debugId: ${debugId})` };
  }
}
