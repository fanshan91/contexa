'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ChevronDown,
  ChevronRight,
  LayoutTemplate,
  Link2,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  type ContextPage,
  type SelectedNode,
  resolveSelection
} from './context-model';

export function ContextNodePicker({
  pages,
  selected,
  onSelect,
  disabled
}: {
  pages: ContextPage[];
  selected: SelectedNode | null;
  onSelect: (next: SelectedNode) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('projectContext');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [expandedPageIds, setExpandedPageIds] = useState<Set<number>>(
    () => new Set(pages.map((p) => p.id))
  );

  const selection = useMemo(() => resolveSelection(pages, selected), [pages, selected]);

  const selectedNodeLabel = useMemo(() => {
    if (!selection) return '';
    const pageTitle = selection.page.title ? selection.page.title : t('tree.untitledPage');
    if (selection.type === 'page') return pageTitle;
    return `${pageTitle} / ${selection.module?.name ?? '-'}`;
  }, [selection, t]);

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

  const isSelected = (node: SelectedNode) => {
    if (!selected) return false;
    if (node.type !== selected.type) return false;
    if (node.pageId !== selected.pageId) return false;
    if (node.type === 'module' && selected.type === 'module') {
      return node.moduleId === selected.moduleId;
    }
    return node.type === 'page' && selected.type === 'page';
  };

  return (
    <>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-[280px] justify-between shadow-none px-3 font-normal"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <div className="flex items-center gap-2 truncate">
          <LayoutTemplate className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {selection ? selectedNodeLabel : t('selector.trigger')}
          </span>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        contentClassName="max-w-[400px] p-0 gap-0"
        header={
          <div className="px-4 py-3 border-b">
            <div className="text-lg leading-none font-semibold">
              {t('selector.trigger')}
            </div>
          </div>
        }
      >
        <div className="flex items-center border-b px-3 pb-2 pt-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            className="flex h-5 w-full rounded-md bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            placeholder={t('selector.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="max-h-[320px] overflow-auto p-1">
          {filteredPages.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t('selector.empty')}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredPages.map((page) => {
                const pageNode: SelectedNode = { type: 'page', pageId: page.id };
                const isFiltering = query.trim().length > 0;
                const isOpen = isFiltering || expandedPageIds.has(page.id);

                return (
                  <div key={page.id} className="py-0.5">
                    <div className="flex items-start gap-1">
                      {!isFiltering ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-0.5 size-8 shrink-0 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setExpandedPageIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(page.id)) next.delete(page.id);
                              else next.add(page.id);
                              return next;
                            });
                          }}
                        >
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="sr-only">{t('tree.toggle')}</span>
                        </Button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => {
                          onSelect(pageNode);
                          setOpen(false);
                        }}
                        className={cn(
                          'flex-1 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground',
                          isSelected(pageNode) ? 'bg-accent text-accent-foreground' : '',
                          isFiltering ? 'pl-2' : ''
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {page.title ? page.title : t('tree.untitledPage')}
                            </div>
                            {!page.title || isFiltering ? (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Link2 className="h-3 w-3" />
                                <span className="truncate">{page.route}</span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    </div>

                    {isOpen && page.modules.length > 0 ? (
                      <div
                        className={cn(
                          'mt-0.5 space-y-0.5',
                          isFiltering ? 'pl-4' : 'pl-9'
                        )}
                      >
                        {page.modules.map((m) => {
                          const moduleNode: SelectedNode = {
                            type: 'module',
                            pageId: page.id,
                            moduleId: m.id
                          };
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                onSelect(moduleNode);
                                setOpen(false);
                              }}
                              className={cn(
                                'w-full rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground',
                                isSelected(moduleNode) ? 'bg-accent text-accent-foreground' : ''
                              )}
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm">{m.name}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
