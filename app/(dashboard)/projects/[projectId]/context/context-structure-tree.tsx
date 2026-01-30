'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight, FileText, Layers, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { type ContextPage, type SelectedNode } from './context-model';

function TreeMetaPill({ label, value }: { label: string; value: number }) {
  return (
    <span
      title={`${label}: ${value}`}
      aria-label={`${label}: ${value}`}
      className="shrink-0 inline-flex items-center rounded-md border border-border bg-secondary px-2 py-0.5 text-xs"
    >
      <span className="tabular-nums font-medium text-foreground leading-none">{value}</span>
    </span>
  );
}

export function ContextStructureTree({
  pages,
  selected,
  onSelect,
  disabled,
  className
}: {
  pages: ContextPage[];
  selected: SelectedNode | null;
  onSelect: (next: SelectedNode) => void;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations('projectContext');
  const [query, setQuery] = useState('');
  const [expandedPages, setExpandedPages] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(pages.map((p) => [p.id, true]))
  );

  const setExpanded = (pageId: number, open: boolean) => {
    setExpandedPages((prev) => ({ ...prev, [pageId]: open }));
  };

  const filteredPages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pages;

    return pages
      .map((p) => {
        const pageHit =
          p.route.toLowerCase().includes(q) || (p.title ?? '').toLowerCase().includes(q);
        const modules = p.modules.filter((m) => m.name.toLowerCase().includes(q));
        if (pageHit) return p;
        if (modules.length === 0) return null;
        return { ...p, modules };
      })
      .filter(Boolean) as ContextPage[];
  }, [pages, query]);

  const isPageActive = (pageId: number) => selected?.type === 'page' && selected.pageId === pageId;

  const isModuleActive = (pageId: number, moduleId: number) =>
    selected?.type === 'module' &&
    selected.pageId === pageId &&
    selected.moduleId === moduleId;

  return (
    <Card
      className={cn('flex min-h-0 flex-col py-0', className)}
      headerClassName="px-4 pt-4 pb-3"
      title={<span className="text-base">{t('tree.title')}</span>}
      description={t('tree.subtitle')}
      contentClassName="flex min-h-0 flex-1 flex-col gap-3 pt-0 px-4 pb-4"
    >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('tree.searchPlaceholder')}
            className="pl-9"
            disabled={disabled}
          />
        </div>

        <ScrollArea className="min-h-0 flex-1" viewportClassName="h-full">
            {filteredPages.length === 0 ? (
              <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
                {t('tree.emptySearch')}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredPages.map((p) => {
                  const open = expandedPages[p.id] ?? true;
                  const active = isPageActive(p.id);
                  const isFiltering = query.trim().length > 0;
                  const isOpen = isFiltering || open;
                  const canToggle = !isFiltering && p.modules.length > 0;
                  const pageTitle = (p.title ?? '').trim();
                  const primaryLabel = pageTitle ? pageTitle : t('tree.untitledPage');

                  return (
                    <div key={p.id} className="rounded-lg border border-border bg-background">
                      <div
                        className={cn(
                          'group relative flex w-full items-center gap-2 overflow-hidden rounded-lg px-3 py-2 text-left outline-none transition-colors',
                          active
                            ? 'bg-secondary ring-1 ring-primary/15 ring-inset before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r before:bg-primary'
                            : 'hover:bg-secondary/60',
                          disabled ? 'opacity-60 cursor-not-allowed' : ''
                        )}
                      >
                        {canToggle ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                            disabled={disabled}
                            onClick={() => setExpanded(p.id, !open)}
                          >
                            {isOpen ? (
                              <ChevronDown className="size-4" />
                            ) : (
                              <ChevronRight className="size-4" />
                            )}
                            <span className="sr-only">{t('tree.toggle')}</span>
                          </Button>
                        ) : (
                          <span className="size-8 shrink-0" aria-hidden="true" />
                        )}

                        <button
                          type="button"
                          disabled={disabled}
                          aria-current={active ? 'page' : undefined}
                          onClick={() => onSelect({ type: 'page', pageId: p.id })}
                          className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1 font-medium text-foreground truncate">
                              {primaryLabel}
                            </div>
                            <TreeMetaPill label={t('tree.meta.keys')} value={p.keyCount ?? 0} />
                          </div>
                        </button>
                      </div>

                      {isOpen && p.modules.length > 0 ? (
                        <div className="pb-2">
                          <div className="space-y-1 pl-10 pr-2">
                            {p.modules.map((m) => {
                              const mActive = isModuleActive(p.id, m.id);
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() =>
                                    onSelect({ type: 'module', pageId: p.id, moduleId: m.id })
                                  }
                                  className={cn(
                                    'relative flex w-full items-center gap-2 overflow-hidden rounded-md px-3 py-2 text-left text-sm outline-none transition-colors',
                                    'focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                                    mActive
                                      ? 'bg-secondary ring-1 ring-primary/15 ring-inset before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r before:bg-primary'
                                      : 'hover:bg-secondary/60',
                                    disabled ? 'opacity-60 cursor-not-allowed' : ''
                                  )}
                                >
                                  <span className="flex min-w-0 flex-1 items-center gap-2">
                                    <Layers className="size-4 shrink-0 text-muted-foreground" />
                                    <span className="truncate text-foreground">{m.name}</span>
                                  </span>
                                  <TreeMetaPill label={t('tree.meta.keys')} value={m.keyCount ?? 0} />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
        </ScrollArea>
    </Card>
  );
}
