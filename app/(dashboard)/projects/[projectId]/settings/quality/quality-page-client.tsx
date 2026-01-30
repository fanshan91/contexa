'use client';

import { useTranslations } from 'next-intl';
import { ProjectRoles } from '@/lib/auth/project-permissions';
import { useCan } from '@/lib/auth/project-permissions-context';
import { Card } from '@/components/ui/card';
import { ProjectSettingsQualityForm } from './quality-form';

export function ProjectSettingsQualityPageClient({
  projectId,
  initialQualityMode,
  initialAdapter
}: {
  projectId: number;
  initialQualityMode: string;
  initialAdapter: string;
}) {
  const t = useTranslations('projectSettingsQuality');
  const canEdit = useCan([ProjectRoles.admin]);

  return (
    <Card title={<span className="text-base">{t('cardTitle')}</span>}>
      <ProjectSettingsQualityForm
        projectId={projectId}
        initialQualityMode={initialQualityMode}
        initialAdapter={initialAdapter}
        canEdit={canEdit}
      />
    </Card>
  );
}
