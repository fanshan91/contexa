'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ExternalLink } from 'lucide-react';
import { WorkbenchDataResponse, WorkbenchTreeNode } from './actions';
import { WorkbenchFilters } from './workbench-filters';
import { WorkbenchSidebar } from './workbench-sidebar';
import { WorkbenchTable } from './workbench-table';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ProjectWorkbenchClient({
  projectId,
  tree,
  targetLocales,
  locale,
  data
}: {
  projectId: number;
  tree: WorkbenchTreeNode[];
  targetLocales: string[];
  locale: string;
  data: WorkbenchDataResponse;
}) {
  const t = useTranslations('projectWorkbench');
  const searchParams = useSearchParams();

  const pageId = searchParams.get('pageId');
  const moduleId = searchParams.get('moduleId');

  const scopeLabel = React.useMemo(() => {
    const pageNode = pageId
      ? tree.find((n) => n.type === 'page' && String(n.originalId) === String(pageId))
      : null;
    if (moduleId) {
      const parent = tree.find((p) => p.type === 'page' && p.children?.some((m) => String(m.originalId) === String(moduleId)));
      const mod = parent?.children?.find((m) => String(m.originalId) === String(moduleId));
      return (
        <span className="font-medium text-foreground">
          {parent?.label || '—'}
          {mod?.label ? <span className="text-muted-foreground"> / {mod.label}</span> : null}
        </span>
      );
    }
    return <span className="font-medium text-foreground">{pageNode?.label || '—'}</span>;
  }, [tree, pageId, moduleId]);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="h-fit overflow-hidden rounded-xl border border-border bg-card lg:sticky lg:top-6">
        <WorkbenchSidebar tree={tree} className="h-[calc(100dvh-220px)] border-0" />
      </div>

      <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div className="text-sm text-muted-foreground">
            {t('table.count', { count: data.total })}
          </div>
          <Button asChild variant="outline" className="h-9">
            <Link href={`/projects/${projectId}/context`}>
              <ExternalLink className="mr-2 size-4" />
              {t('tree.goContext')}
            </Link>
          </Button>
        </div>

        <WorkbenchFilters targetLocales={targetLocales} currentLocale={locale} currentScopeLabel={scopeLabel} />

        <div className={cn('min-h-0 flex-1')}>
          <WorkbenchTable
            projectId={projectId}
            locale={locale}
            items={data.items}
            total={data.total}
            page={data.page}
            pageSize={data.pageSize}
            totalPages={data.totalPages}
          />
        </div>
      </div>
    </div>
  );
}
