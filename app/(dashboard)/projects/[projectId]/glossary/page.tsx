import { getTranslations } from 'next-intl/server';
import { ProjectGlossaryClient } from './project-glossary-client';
import {
  getGlossaryBootstrapQuery,
  listGlossaryTermsQuery,
  listNegativePromptsQuery
} from './actions';

export default async function ProjectGlossaryPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const t = await getTranslations('projectGlossary');
  const { projectId } = await params;
  const id = Number(projectId);
  if (!Number.isFinite(id)) return null;

  const bootstrap = await getGlossaryBootstrapQuery(id);
  const targetLocales = bootstrap.ok ? bootstrap.data.targetLocales : [];
  const canManage = bootstrap.ok ? bootstrap.data.canManage : false;
  const locale = targetLocales[0] ?? '';

  const [terms, negatives] = await Promise.all([
    locale
      ? listGlossaryTermsQuery({
          projectId: id,
          locale,
          query: '',
          type: 'all',
          status: 'all',
          page: 1,
          pageSize: 20
        })
      : Promise.resolve({ ok: true as const, data: { items: [], total: 0, page: 1, pageSize: 20 } }),
    locale
      ? listNegativePromptsQuery({
          projectId: id,
          locale,
          query: '',
          status: 'all',
          page: 1,
          pageSize: 20
        })
      : Promise.resolve({ ok: true as const, data: { items: [], total: 0, page: 1, pageSize: 20 } })
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

      <ProjectGlossaryClient
        projectId={id}
        targetLocales={targetLocales}
        canManage={canManage}
        initialLocale={locale}
        initialTerms={terms.ok ? terms.data : { items: [], total: 0, page: 1, pageSize: 20 }}
        initialNegatives={
          negatives.ok ? negatives.data : { items: [], total: 0, page: 1, pageSize: 20 }
        }
        bootstrapError={bootstrap.ok ? '' : bootstrap.error}
      />
    </div>
  );
}
