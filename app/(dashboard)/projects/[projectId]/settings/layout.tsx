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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('subtitle')}</p>
        </div>
      </div>

      <div className="mt-6">
        <ProjectSettingsTabs projectId={id} />
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}

