import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requireProjectRuntimeToken } from '@/lib/runtime/auth';
import { fromUnknownError, notFound, validationError } from '@/lib/http/response';

export const runtime = 'nodejs';

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

function buildTree(outMap: Record<string, string>, templatePaths: string[][]) {
  const fallbackPaths = Object.keys(outMap).map((k) => k.split('.'));
  const paths = templatePaths.length > 0 ? templatePaths : fallbackPaths;

  const tree: Record<string, unknown> = {};
  for (const path of paths) {
    const key = path.join('.');
    if (!key) continue;
    setPathValue(tree, path, outMap[key] ?? '');
  }
  for (const key of Object.keys(outMap)) {
    if (paths.some((p) => p.join('.') === key)) continue;
    setPathValue(tree, key.split('.'), outMap[key] ?? '');
  }
  return tree;
}

const querySchema = z.object({
  projectId: z.coerce.number().int().positive(),
  locale: z.string().trim().min(1).max(20).optional()
});

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const parsedQuery = querySchema.safeParse({
      projectId: url.searchParams.get('projectId'),
      locale: url.searchParams.get('locale') || undefined
    });
    if (!parsedQuery.success) {
      return validationError('Validation error', { projectId: ['Invalid projectId'] });
    }

    const projectId = parsedQuery.data.projectId;
    const tokenAuth = await requireProjectRuntimeToken(request, projectId);
    if (!tokenAuth.ok) return tokenAuth.response;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { sourceLocale: true }
    });
    if (!project) return notFound('项目不存在');

    const locales = await prisma.projectLocale.findMany({
      where: { projectId },
      select: { locale: true }
    });
    const localeSet = new Set(locales.map((l) => l.locale));
    localeSet.add(project.sourceLocale);
    const allLocales = Array.from(localeSet);

    const locale = parsedQuery.data.locale ? parsedQuery.data.locale : project.sourceLocale;
    if (!allLocales.includes(locale)) {
      return validationError('Validation error', { locale: ['Locale not in project'] });
    }

    const isSource = locale === project.sourceLocale;
    const outMap: Record<string, string> = {};
    if (isSource) {
      const entries = await prisma.entry.findMany({
        where: { projectId },
        orderBy: { key: 'asc' },
        select: { key: true, sourceText: true }
      });
      for (const e of entries) {
        outMap[e.key] = e.sourceText;
      }
    } else {
      const entries = await prisma.entry.findMany({
        where: { projectId },
        orderBy: { key: 'asc' },
        select: {
          key: true,
          sourceText: true,
          translations: {
            where: { locale },
            select: { text: true }
          }
        }
      });
      for (const e of entries) {
        const text = e.translations[0]?.text ?? '';
        outMap[e.key] = text.trim() ? text : e.sourceText;
      }
    }

    const shape = await getProjectTemplateShape(projectId);
    if (shape === 'flat') {
      return Response.json(outMap, { status: 200, headers: { 'content-type': 'application/json' } });
    }

    const templatePaths = await getProjectTemplatePaths(projectId);
    const tree = buildTree(outMap, templatePaths);
    return Response.json(tree, { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    return fromUnknownError(err);
  }
}
