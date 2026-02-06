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
  locales: z.string().trim().min(1)
});

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const parsedQuery = querySchema.safeParse({
      projectId: url.searchParams.get('projectId'),
      locales: url.searchParams.get('locales')
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

    const requestedLocales = parsedQuery.data.locales
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);
    if (requestedLocales.length === 0) {
      return validationError('Validation error', { locales: ['Locales is required'] });
    }
    const invalidLocale = requestedLocales.find((l) => !allLocales.includes(l));
    if (invalidLocale) {
      return validationError('Validation error', { locales: [`Locale not in project: ${invalidLocale}`] });
    }

    const shape = await getProjectTemplateShape(projectId);
    const templatePaths = shape === 'tree' ? await getProjectTemplatePaths(projectId) : [];

    const localesMap: Record<string, Record<string, string> | Record<string, unknown>> = {};
    for (const locale of requestedLocales) {
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

      localesMap[locale] = shape === 'flat' ? outMap : buildTree(outMap, templatePaths);
    }

    const entryMax = await prisma.entry.aggregate({
      where: { projectId },
      _max: { updatedAt: true }
    });
    const translationMax = await prisma.translation.aggregate({
      where: { projectId, locale: { in: requestedLocales } },
      _max: { updatedAt: true }
    });
    const entryTime = entryMax._max.updatedAt?.getTime() ?? 0;
    const translationTime = translationMax._max.updatedAt?.getTime() ?? 0;
    const maxTime = Math.max(entryTime, translationTime);
    const etag = `W/"${maxTime}-${requestedLocales.join(',')}"`;
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new Response(null, { status: 304, headers: { etag } });
    }

    return Response.json(
      { version: String(maxTime), updatedAt: maxTime, locales: localesMap },
      { status: 200, headers: { 'content-type': 'application/json', etag } }
    );
  } catch (err) {
    return fromUnknownError(err);
  }
}
