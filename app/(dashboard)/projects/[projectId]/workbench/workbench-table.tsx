'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { TranslationStatus } from '@prisma/client';
import { Save, RotateCcw } from 'lucide-react';
import { saveTranslation, WorkbenchItem } from './actions';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

type WorkbenchTableProps = {
  projectId: number;
  locale: string;
  items: WorkbenchItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function statusBadgeVariant(status: TranslationStatus) {
  switch (status) {
    case 'pending':
      return 'secondary' as const;
    case 'needs_update':
      return 'warning' as const;
    case 'needs_review':
      return 'info' as const;
    case 'ready':
      return 'outline' as const;
    case 'approved':
      return 'success' as const;
  }
}

export function WorkbenchTable({ projectId, locale, items, total, page, pageSize, totalPages }: WorkbenchTableProps) {
  const t = useTranslations('projectWorkbench');
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightKey = searchParams.get('key') || '';

  const [drafts, setDrafts] = React.useState<Record<number, string>>(() =>
    Object.fromEntries(items.map((it) => [it.id, it.targetText]))
  );
  const [saving, startSaving] = React.useTransition();

  React.useEffect(() => {
    setDrafts(Object.fromEntries(items.map((it) => [it.id, it.targetText])));
  }, [items]);

  const setPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(nextPage));
    router.push(`?${params.toString()}`);
  };

  const setPageSize = (nextPageSize: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('pageSize', String(nextPageSize));
    params.set('page', '1');
    router.push(`?${params.toString()}`);
  };

  const resetDraft = (entryId: number, value: string) => {
    setDrafts((prev) => ({ ...prev, [entryId]: value }));
  };

  const doSave = (row: WorkbenchItem) => {
    const draft = (drafts[row.id] ?? '').trim();
    if (!draft) {
      toast.push({ title: t('toast.invalidTitle'), message: t('toast.invalidEmpty'), variant: 'destructive' });
      return;
    }

    startSaving(async () => {
      try {
        await saveTranslation(projectId, row.id, locale, draft);
        toast.push({ title: t('toast.savedTitle'), message: t('toast.savedMessage'), variant: 'default' });
        router.refresh();
      } catch {
        toast.push({ title: t('error.title'), message: t('error.desc'), variant: 'destructive' });
      }
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {items.length === 0 ? (
        <div className="rounded-lg border border-border bg-background p-6 text-sm">
          <div className="font-medium text-foreground">{t('table.emptyTitle')}</div>
          <div className="mt-1 text-muted-foreground">{t('table.emptyDesc')}</div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto scrollbar-hover">
          <table className="w-full min-w-[980px] table-fixed text-sm">
            <colgroup>
              <col className="w-[280px]" />
              <col className="w-[34%]" />
              <col className="w-[34%]" />
              <col className="w-[140px]" />
              <col className="w-[110px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-card text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 text-left font-medium">{t('table.colKey')}</th>
                <th className="py-2 pr-3 text-left font-medium">{t('table.colSource')}</th>
                <th className="py-2 pr-3 text-left font-medium">{t('table.colTarget')}</th>
                <th className="py-2 pr-3 text-left font-medium">{t('table.colStatus')}</th>
                <th className="py-2 pr-3 text-left font-medium">{t('table.colOperations')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const draft = drafts[row.id] ?? '';
                const dirty = draft !== (row.targetText ?? '');
                const isHighlighted = Boolean(highlightKey) && row.key === highlightKey;
                const placements = row.placements
                  .map((p) => (p.module ? `${p.page.route} / ${p.module.name}` : p.page.route))
                  .slice(0, 2)
                  .join(' · ');

                return (
                  <tr
                    key={row.id}
                    className={cn('border-b border-border align-top', isHighlighted && 'bg-accent/60')}
                  >
                    <td className="py-3 pr-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{row.key}</div>
                        {placements ? (
                          <div className="mt-1 truncate text-xs text-muted-foreground">{placements}</div>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="whitespace-pre-wrap break-words text-foreground">{row.sourceText}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <textarea
                        value={draft}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))}
                        placeholder={t('table.targetPlaceholder')}
                        className={cn(
                          'min-h-10 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                          dirty && 'border-primary/40'
                        )}
                      />
                      {dirty ? <div className="mt-1 text-xs text-muted-foreground">{t('table.dirtyHint')}</div> : null}
                    </td>
                    <td className="py-3 pr-3">
                      <Badge variant={statusBadgeVariant(row.status)}>{t(`status.${row.status}`)}</Badge>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          disabled={!dirty || saving}
                          onClick={() => doSave(row)}
                          aria-label={t('table.save')}
                        >
                          <Save className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          disabled={!dirty || saving}
                          onClick={() => resetDraft(row.id, row.targetText)}
                          aria-label={t('table.reset')}
                        >
                          <RotateCcw className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-border bg-card p-4">
        <Pagination
          page={page}
          pageCount={Math.max(1, totalPages)}
          total={total}
          onChange={setPage}
          pageSize={pageSize}
          pageSizeOptions={[20, 50, 100]}
          onPageSizeChange={setPageSize}
          pending={saving}
        />
      </div>
    </div>
  );
}
