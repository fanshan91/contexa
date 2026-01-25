import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { prisma } from '@/lib/db/prisma';
import { ProjectPackagesClient } from '../packages/project-packages-client';

export default async function ProjectOverviewPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const t = await getTranslations('projectOverview');
  const { projectId } = await params;
  const id = Number(projectId);
  if (!Number.isFinite(id)) return null;

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      sourceLocale: true,
      locales: { select: { locale: true }, orderBy: { createdAt: 'asc' } },
      _count: { select: { entries: true } }
    }
  });

  const targetLocales = (project?.locales ?? [])
    .map((l) => l.locale)
    .filter((l) => l !== project?.sourceLocale);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground lg:text-2xl">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('projectInfoTitle')}</CardTitle>
          <CardDescription>{t('projectInfoSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">{t('projectName')}</div>
            <div className="mt-0.5 text-sm font-semibold text-foreground">{project?.name ?? '—'}</div>
          </div>
          <div className="rounded-lg border bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">{t('sourceLocale')}</div>
            <div className="mt-0.5 text-sm font-semibold text-foreground">{project?.sourceLocale ?? '—'}</div>
          </div>
          <div className="rounded-lg border bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">{t('targetLocales')}</div>
            <div className="mt-0.5 text-sm font-semibold text-foreground">
              {targetLocales.length ? targetLocales.join(', ') : '—'}
            </div>
          </div>
          <div className="rounded-lg border bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">{t('entryCount')}</div>
            <div className="mt-0.5 text-sm font-semibold text-foreground">{project?._count.entries ?? 0}</div>
          </div>

          {project?.description ? (
            <div className="sm:col-span-2 lg:col-span-4 rounded-lg border bg-background px-3 py-2">
              <div className="text-xs text-muted-foreground">{t('description')}</div>
              <div className="mt-0.5 text-sm text-foreground">{project.description}</div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <ProjectPackagesClient projectId={id} variant="ops" />
    </div>
  );
}

