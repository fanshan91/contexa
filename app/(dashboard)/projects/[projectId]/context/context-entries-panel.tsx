'use client';

import { useEffect, useMemo, useState, type TransitionStartFunction } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Search, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { type ContextEntry, type ResolvedSelection, formatCompactTime } from './context-model';
import {
  bindEntriesAction,
  getBoundEntriesAction,
  searchEntriesAction,
  unbindEntriesAction
} from './actions';

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-6">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
    </div>
  );
}

function LoadingBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: lines }).map((_, idx) => (
        <div
          key={idx}
          className={cn(
            'h-4 rounded-md bg-muted',
            idx === 0 ? 'w-2/3' : idx === 1 ? 'w-5/6' : 'w-1/2'
          )}
        />
      ))}
    </div>
  );
}

export function ContextEntriesPanel({
  projectId,
  selection,
  isPending,
  startTransition
}: {
  projectId: number;
  selection: ResolvedSelection;
  isPending: boolean;
  startTransition: TransitionStartFunction;
}) {
  const t = useTranslations('projectContext');
  const { push } = useToast();

  const [entriesQuery, setEntriesQuery] = useState('');

  const [boundEntries, setBoundEntries] = useState<ContextEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);

  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<number>>(
    () => new Set()
  );

  const clearEntrySelection = () => setSelectedEntryIds(new Set());

  const toggleEntrySelected = (id: number) => {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredBoundEntries = useMemo(() => {
    const q = entriesQuery.trim().toLowerCase();
    if (!q) return boundEntries;
    return boundEntries.filter((e) => e.key.toLowerCase().includes(q));
  }, [boundEntries, entriesQuery]);

  const selectedEntryCount = selectedEntryIds.size;
  const allVisibleSelected =
    filteredBoundEntries.length > 0 &&
    filteredBoundEntries.every((e) => selectedEntryIds.has(e.id));

  const toggleSelectAllVisibleEntries = () => {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      const allSelected =
        filteredBoundEntries.length > 0 &&
        filteredBoundEntries.every((e) => next.has(e.id));
      if (allSelected) {
        for (const e of filteredBoundEntries) next.delete(e.id);
      } else {
        for (const e of filteredBoundEntries) next.add(e.id);
      }
      return next;
    });
  };

  const fetchBoundEntries = async () => {
    setEntriesLoading(true);
    const res = await getBoundEntriesAction({
      projectId,
      pageId: selection.page.id,
      moduleId: selection.type === 'module' ? selection.module?.id : undefined
    });

    if (!res.ok) {
      push({ variant: 'destructive', message: res.error });
      setBoundEntries([]);
      setEntriesLoading(false);
      clearEntrySelection();
      return;
    }

    setBoundEntries(res.data);
    setEntriesLoading(false);
    clearEntrySelection();
  };

  useEffect(() => {
    fetchBoundEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.page.id, selection.type, selection.type === 'module' ? selection.module?.id : null]);

  const unbindEntries = (ids: number[]) => {
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await unbindEntriesAction({
        projectId,
        pageId: selection.page.id,
        moduleId: selection.type === 'module' ? selection.module?.id : undefined,
        entryIds: ids
      });

      if (!res.ok) {
        push({ variant: 'destructive', message: res.error });
        return;
      }

      push({ variant: 'default', message: res.success });
      await fetchBoundEntries();
    });
  };

  const [addEntryDialogOpen, setAddEntryDialogOpen] = useState(false);
  const [poolQuery, setPoolQuery] = useState('');
  const [poolCandidates, setPoolCandidates] = useState<ContextEntry[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolSelectedIds, setPoolSelectedIds] = useState<Set<number>>(
    () => new Set()
  );

  const poolAllSelected =
    poolCandidates.length > 0 && poolCandidates.every((e) => poolSelectedIds.has(e.id));

  const togglePoolSelectAll = () => {
    setPoolSelectedIds((prev) => {
      const next = new Set(prev);
      const all = poolCandidates.length > 0 && poolCandidates.every((e) => next.has(e.id));
      if (all) {
        for (const e of poolCandidates) next.delete(e.id);
      } else {
        for (const e of poolCandidates) next.add(e.id);
      }
      return next;
    });
  };

  const togglePoolKey = (id: number) => {
    setPoolSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (!addEntryDialogOpen) return;

    const timeoutId = setTimeout(() => {
      setPoolLoading(true);
      searchEntriesAction({ projectId, query: poolQuery })
        .then((res) => {
          if (!res.ok) {
            push({ variant: 'destructive', message: res.error });
            setPoolCandidates([]);
            return;
          }

          const boundIds = new Set(boundEntries.map((e) => e.id));
          setPoolCandidates(res.data.filter((e) => !boundIds.has(e.id)));
        })
        .finally(() => setPoolLoading(false));
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [addEntryDialogOpen, poolQuery, projectId, boundEntries, push]);

  const addSelectedPoolEntries = () => {
    const ids = Array.from(poolSelectedIds);
    if (ids.length === 0) return;

    startTransition(async () => {
      const res = await bindEntriesAction({
        projectId,
        pageId: selection.page.id,
        moduleId: selection.type === 'module' ? selection.module?.id : undefined,
        entryIds: ids
      });

      if (!res.ok) {
        push({ variant: 'destructive', message: res.error });
        return;
      }

      push({ variant: 'default', message: res.success });
      setAddEntryDialogOpen(false);
      setPoolSelectedIds(new Set());
      await fetchBoundEntries();
    });
  };

  return (
    <>
      <Card
        className="flex h-full flex-col py-0"
        headerClassName="px-4 pt-4 pb-2"
        contentClassName="flex min-h-0 flex-1 flex-col px-4 pb-4"
        title={<span className="text-base">{t('entries.title')}</span>}
        description={t('entries.subtitle')}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="shadow-none"
              onClick={() => {
                setPoolSelectedIds(new Set());
                setPoolQuery('');
                setPoolCandidates([]);
                setAddEntryDialogOpen(true);
              }}
              disabled={isPending}
            >
              <Plus className="h-4 w-4" />
              {t('entries.add')}
            </Button>
            <Button
              variant="outline"
              className="shadow-none"
              disabled={selectedEntryCount === 0 || isPending}
              onClick={() => unbindEntries(Array.from(selectedEntryIds))}
            >
              <Trash2 className="h-4 w-4" />
              {t('entries.unbind')}
              {selectedEntryCount > 0 ? (
                <Badge variant="secondary" className="ml-1">
                  {selectedEntryCount}
                </Badge>
              ) : null}
            </Button>
          </div>
        }
      >
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={entriesQuery}
                onChange={(e) => setEntriesQuery(e.target.value)}
                placeholder={t('entries.searchPlaceholder')}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisibleEntries}
                  className="h-4 w-4 rounded border border-input bg-background text-primary"
                />
                {t('entries.selectAll')}
              </label>
              {selectedEntryCount > 0 ? (
                <Button
                  variant="ghost"
                  className="h-9 px-3 shadow-none"
                  onClick={clearEntrySelection}
                >
                  {t('entries.clearSelection')}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border">
            <div className="grid grid-cols-[40px_1.3fr_1.7fr_140px] gap-0 border-b border-border bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground">
              <div className="flex items-center justify-center">#</div>
              <div>{t('entries.columns.key')}</div>
              <div>{t('entries.columns.snapshot')}</div>
              <div className="text-right">{t('entries.columns.lastSeen')}</div>
            </div>

            {entriesLoading ? (
              <div className="flex-1 p-4">
                <LoadingBlock lines={3} />
              </div>
            ) : filteredBoundEntries.length === 0 ? (
              <div className="flex-1 p-4">
                <EmptyState title={t('entries.emptyTitle')} desc={t('entries.emptyDesc')} />
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                {filteredBoundEntries.map((e) => (
                  <div
                    key={e.id}
                    className={cn(
                      'grid grid-cols-[40px_1.3fr_1.7fr_140px] items-start gap-0 border-b border-border px-3 py-2 last:border-b-0 hover:bg-secondary',
                      selectedEntryIds.has(e.id) ? 'bg-secondary' : null
                    )}
                  >
                    <div className="flex items-start justify-center pt-0.5">
                      <input
                        type="checkbox"
                        checked={selectedEntryIds.has(e.id)}
                        onChange={() => toggleEntrySelected(e.id)}
                        className="h-4 w-4 rounded border border-input bg-background text-primary"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{e.key}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm text-muted-foreground">
                        {e.sourceText ? e.sourceText : '-'}
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      {e.updatedAt ? formatCompactTime(e.updatedAt) : '-'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
      </Card>

      <Dialog
        open={addEntryDialogOpen}
        onOpenChange={setAddEntryDialogOpen}
        title={t('addEntry.title')}
        contentClassName="max-w-3xl"
        footer={
          <>
            <Button
              variant="outline"
              className="shadow-none"
              onClick={() => setAddEntryDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={addSelectedPoolEntries}
              disabled={poolSelectedIds.size === 0 || isPending}
            >
              {t('addEntry.add')}
            </Button>
          </>
        }
      >
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={poolQuery}
                onChange={(e) => setPoolQuery(e.target.value)}
                placeholder={t('addEntry.searchPlaceholder')}
                className="pl-9"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={poolAllSelected}
                  onChange={togglePoolSelectAll}
                  className="h-4 w-4 rounded border border-input bg-background text-primary"
                />
                {t('addEntry.selectAll')}
              </label>
              <Badge variant="secondary">
                {t('addEntry.selectedCount', { count: poolSelectedIds.size })}
              </Badge>
            </div>

            <div className="max-h-[420px] overflow-auto rounded-lg border border-border bg-background">
              {poolLoading ? (
                <div className="p-4">
                  <LoadingBlock lines={3} />
                </div>
              ) : poolCandidates.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">{t('addEntry.empty')}</div>
              ) : (
                <div className="divide-y divide-border">
                  {poolCandidates.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => togglePoolKey(e.id)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                        poolSelectedIds.has(e.id) ? 'bg-accent/40' : 'hover:bg-accent/30'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={poolSelectedIds.has(e.id)}
                        readOnly
                        className="mt-0.5 h-4 w-4 rounded border border-input bg-background text-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{e.key}</div>
                        <div className="mt-0.5 truncate text-sm text-muted-foreground">
                          {e.sourceText ? e.sourceText : '-'}
                        </div>
                      </div>
                      {e.updatedAt ? (
                        <Badge variant="outline">{formatCompactTime(e.updatedAt)}</Badge>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
      </Dialog>
    </>
  );
}
