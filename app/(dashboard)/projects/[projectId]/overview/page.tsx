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
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground lg:text-2xl">{project?.name ?? t('title')}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('projectInfoTitle')}</CardTitle>
          <CardDescription className="hidden sm:block">{t('projectInfoSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-background px-2.5 py-2">
            <div className="text-xs text-muted-foreground">{t('sourceLocale')}</div>
            <div className="mt-0.5 text-sm font-semibold text-foreground">{project?.sourceLocale ?? '—'}</div>
          </div>
          <div className="rounded-lg border bg-background px-2.5 py-2">
            <div className="text-xs text-muted-foreground">{t('targetLocales')}</div>
            <div className="mt-0.5 text-sm font-semibold text-foreground">
              {targetLocales.length ? targetLocales.join(', ') : '—'}
            </div>
          </div>
          <div className="rounded-lg border bg-background px-2.5 py-2">
            <div className="text-xs text-muted-foreground">{t('entryCount')}</div>
            <div className="mt-0.5 text-sm font-semibold text-foreground">{project?._count.entries ?? 0}</div>
          </div>

          {project?.description ? (
            <details className="sm:col-span-2 lg:col-span-4 rounded-lg border bg-background px-2.5 py-2">
              <summary className="cursor-pointer text-xs text-muted-foreground">{t('description')}</summary>
              <div className="mt-2 text-sm text-foreground">{project.description}</div>
            </details>
          ) : null}
        </CardContent>
      </Card>

      <ProjectPackagesClient projectId={id} variant="ops" />
    </div>
  );
}
