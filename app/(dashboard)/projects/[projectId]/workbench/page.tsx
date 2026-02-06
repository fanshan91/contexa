import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ProjectWorkbenchClient } from './project-workbench-client';
import {
  getProjectLocales,
  getUserProjectLocalePreference,
  getWorkbenchData,
  getWorkbenchTree
} from './actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-primitives';
import { Button } from '@/components/ui/button';

export default async function ProjectWorkbenchPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations('projectWorkbench');
  const { projectId } = await params;
  const id = Number(projectId);
  if (!Number.isFinite(id)) return null;

  const sp = (await searchParams) ?? {};
  const getParam = (key: string) => {
    const v = sp[key];
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v[0] ?? '';
    return '';
  };

  const localeConfig = await getProjectLocales(id);
  if (!localeConfig) return null;
  const targetLocales = localeConfig.locales.filter((l) => l !== localeConfig.sourceLocale);

  if (targetLocales.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground lg:text-2xl">{t('title')}</h1>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('emptyLocales.title')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <div>{t('emptyLocales.desc')}</div>
            <Button asChild className="w-fit">
              <Link href={`/projects/${id}/settings/locales`}>{t('emptyLocales.go')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tree = await getWorkbenchTree(id);
  if (tree.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground lg:text-2xl">{t('title')}</h1>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('emptyPages.title')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <div>{t('emptyPages.desc')}</div>
            <Button asChild className="w-fit">
              <Link href={`/projects/${id}/context`}>{t('emptyPages.go')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const requestedLocale = getParam('locale');
  const requestedPageId = getParam('pageId');
  const requestedModuleId = getParam('moduleId');
  const requestedStatuses = getParam('statuses');
  const requestedSearch = getParam('search');
  const requestedPage = getParam('page');
  const requestedPageSize = getParam('pageSize');

  const preferredLocale = await getUserProjectLocalePreference(id);
  const fallbackLocale = targetLocales.includes('en') ? 'en' : targetLocales[0]!;
  const defaultLocale =
    preferredLocale && targetLocales.includes(preferredLocale) ? preferredLocale : fallbackLocale;

  const defaultStatuses = ['pending', 'needs_update', 'needs_review'];

  const paramsForRedirect = new URLSearchParams();
  const ensureParam = (key: string, value: string) => {
    if (!value) return;
    paramsForRedirect.set(key, value);
  };

  const resolvedLocale = requestedLocale || defaultLocale;

  let resolvedPageId = requestedPageId;
  let resolvedModuleId = requestedModuleId;
  if (!resolvedPageId && !resolvedModuleId) {
    resolvedPageId = String(tree[0]!.originalId);
  }

  const resolvedStatuses = requestedStatuses || defaultStatuses.join(',');

  const pageNumber = Math.max(1, Number(requestedPage || '1'));
  const resolvedPageSize = Math.min(100, Math.max(1, Math.floor(Number(requestedPageSize || '20'))));

  const shouldRedirect =
    requestedLocale !== resolvedLocale ||
    requestedStatuses !== resolvedStatuses ||
    (!requestedPageId && !requestedModuleId);

  if (shouldRedirect) {
    ensureParam('locale', resolvedLocale);
    ensureParam('statuses', resolvedStatuses);
    ensureParam('pageId', resolvedPageId);
    ensureParam('moduleId', resolvedModuleId);
    ensureParam('search', requestedSearch);
    ensureParam('page', String(pageNumber));
    ensureParam('pageSize', String(resolvedPageSize));
    redirect(`?${paramsForRedirect.toString()}`);
  }

  const statuses = resolvedStatuses
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const data = await getWorkbenchData(id, {
    targetLocale: resolvedLocale,
    pageId: resolvedPageId ? Number(resolvedPageId) : undefined,
    moduleId: resolvedModuleId ? Number(resolvedModuleId) : undefined,
    search: requestedSearch || undefined,
    statuses: statuses as any,
    page: pageNumber,
    pageSize: resolvedPageSize
  });

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

      <ProjectWorkbenchClient
        projectId={id}
        tree={tree}
        targetLocales={targetLocales}
        locale={resolvedLocale}
        data={data}
      />
    </div>
  );
}
