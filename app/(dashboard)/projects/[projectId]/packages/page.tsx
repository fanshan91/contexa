import { getTranslations } from 'next-intl/server';
import { ProjectPackagesClient } from './project-packages-client';
import { getPackagesBootstrapQuery, listPackagesEntriesQuery } from './actions';

export default async function ProjectPackagesPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const t = await getTranslations('projectPackages');
  const { projectId } = await params;
  const id = Number(projectId);
  if (!Number.isFinite(id)) return null;

  const [bootstrap, entries] = await Promise.all([
    getPackagesBootstrapQuery(id),
    listPackagesEntriesQuery(id)
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground lg:text-2xl">
            {t('title')}
          </h1>
          {/* <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p> */}
        </div>
      </div>

      <ProjectPackagesClient
        projectId={id}
        variant="entries"
        sourceLocale={bootstrap.ok ? bootstrap.data.sourceLocale : ''}
        targetLocales={bootstrap.ok ? bootstrap.data.targetLocales : []}
        templateShape={bootstrap.ok ? bootstrap.data.templateShape : 'flat'}
        canManage={bootstrap.ok ? bootstrap.data.canManage : false}
        initialEntries={entries.ok ? entries.data.items : []}
        bootstrapError={bootstrap.ok ? '' : bootstrap.error}
        entriesError={entries.ok ? '' : entries.error}
      />
    </div>
  );
}
