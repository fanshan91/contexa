import { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { ProjectSettingsTabs } from './settings-tabs';

export default async function ProjectSettingsLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const t = await getTranslations('projectSettings');
  const { projectId } = await params;
  const id = Number(projectId);
  if (!Number.isFinite(id)) return null;

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

      <ProjectSettingsTabs projectId={id} />
      <div>{children}</div>
    </div>
  );
}
