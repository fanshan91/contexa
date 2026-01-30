'use client';

import { useTranslations } from 'next-intl';
import { ProjectRoles } from '@/lib/auth/project-permissions';
import { useCan } from '@/lib/auth/project-permissions-context';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getProjectLocaleLabel } from '@/lib/locales';
import { ProjectSettingsLocalesForm } from './locales-form';

export function ProjectSettingsLocalesPageClient({
  projectId,
  sourceLocale,
  targetLocales
}: {
  projectId: number;
  sourceLocale: string;
  targetLocales: string[];
}) {
  const t = useTranslations('projectSettingsLocales');
  const canEdit = useCan([ProjectRoles.admin]);

  return (
    <div className="space-y-4">
      <Card
        title={<span className="text-base">{t('listTitle')}</span>}
        contentClassName="space-y-3 text-sm"
      >
          <div>
            <div className="text-muted-foreground">{t('sourceLocale')}</div>
            <div className="mt-1 text-foreground">{getProjectLocaleLabel(sourceLocale)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{t('targetLocales')}</div>
            {targetLocales.length === 0 ? (
              <div className="mt-1 text-muted-foreground">{t('noTargetLocales')}</div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {targetLocales.map((l) => (
                  <Badge key={l} variant="secondary" className="rounded-full px-3 py-1">
                    {getProjectLocaleLabel(l)}
                  </Badge>
                ))}
              </div>
            )}
            <div className="mt-2 text-sm text-muted-foreground">{t('removePolicy')}</div>
          </div>
      </Card>

      <Card title={<span className="text-base">{t('addTitle')}</span>}>
        <ProjectSettingsLocalesForm
          projectId={projectId}
          sourceLocale={sourceLocale}
          targetLocales={targetLocales}
          canEdit={canEdit}
        />
      </Card>
    </div>
  );
}
