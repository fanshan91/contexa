'use client';

import { useTranslations } from 'next-intl';
import { ProjectRoles } from '@/lib/auth/project-permissions';
import { useCan } from '@/lib/auth/project-permissions-context';
import { Card } from '@/components/ui/card';
import { ProjectSettingsBasicForm } from './basic-form';

export function ProjectSettingsBasicPageClient({
  projectId,
  initialName,
  initialDescription,
  sourceLocale
}: {
  projectId: number;
  initialName: string;
  initialDescription: string | null;
  sourceLocale: string;
}) {
  const t = useTranslations('projectSettingsBasic');
  const canEdit = useCan([ProjectRoles.admin]);
  const canDelete = useCan(['creator']);

  return (
    <Card title={<span className="text-base">{t('cardTitle')}</span>}>
      <ProjectSettingsBasicForm
        projectId={projectId}
        initialName={initialName}
        initialDescription={initialDescription}
        sourceLocale={sourceLocale}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </Card>
  );
}
