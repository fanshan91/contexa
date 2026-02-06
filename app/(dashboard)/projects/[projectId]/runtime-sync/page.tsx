import { getTranslations } from 'next-intl/server';
import { ProjectRuntimeSyncClient } from './runtime-sync-client';
import { getRuntimeSyncBootstrapQuery } from './actions';

export default async function ProjectRuntimeSyncPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const t = await getTranslations('projectRuntimeSync');
  const { projectId } = await params;
  const id = Number(projectId);
  if (!Number.isFinite(id)) return null;

  const bootstrap = await getRuntimeSyncBootstrapQuery(id);
  if (!bootstrap.ok) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-foreground lg:text-2xl">{t('title')}</h1>
        </div>
        <div className="text-sm text-muted-foreground">{bootstrap.error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-foreground lg:text-2xl">{t('title')}</h1>
        <div className="text-sm text-muted-foreground">{t('subtitle')}</div>
      </div>
      <ProjectRuntimeSyncClient projectId={id} bootstrap={bootstrap.data} />
    </div>
  );
}

