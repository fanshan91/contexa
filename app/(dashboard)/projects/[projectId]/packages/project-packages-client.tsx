'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card-primitives';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import {
  exportLanguagePackAction,
  type PackagesEntry
} from './actions';
import { CreateEntrySheetContainer, DownloadDialog } from './dialogs';
import { EntriesTabContent } from './entries';
import { HistoryPanel } from './history';
import { ImportTabContent } from './import';
import { useSearchPagination } from './hooks';
import type { DownloadMode, TabKey, TranslationStatus } from './types';
import { buildLocaleOptions } from './utils';

export function ProjectPackagesClient({
  projectId,
  sourceLocale,
  targetLocales,
  templateShape,
  canManage,
  initialEntries,
  initialTab,
  bootstrapError,
  entriesError
}: {
  projectId: number;
  sourceLocale: string;
  targetLocales: string[];
  templateShape: 'flat' | 'tree';
  canManage: boolean;
  initialEntries: PackagesEntry[];
  initialTab?: TabKey;
  bootstrapError: string;
  entriesError: string;
}) {
  const { push } = useToast();
  const [tab, setTab] = useState<TabKey>(() => initialTab ?? 'entries');
  const [selectedLocale, setSelectedLocale] = useState(sourceLocale);
  const [query, setQuery] = useState('');

  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadLocale, setDownloadLocale] = useState(sourceLocale);
  const [downloadMode, setDownloadMode] = useState<DownloadMode>('fallback');

  const [entries, setEntries] = useState<PackagesEntry[]>(() => initialEntries);

  const [poolOnly, setPoolOnly] = useState(false);
  const [filledFilter, setFilledFilter] = useState<'all' | 'filled' | 'empty'>('all');
  const [statusFilter, setStatusFilter] = useState<TranslationStatus | 'all'>('all');

  const [lastImportContextLink, setLastImportContextLink] = useState<string | null>(null);
  const [historyRefreshSignal, setHistoryRefreshSignal] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);

  const localeOptions = useMemo(
    () => buildLocaleOptions(sourceLocale, targetLocales),
    [sourceLocale, targetLocales]
  );

  const sortedEntries = useMemo(() => {
    const list = [...entries];
    list.sort((a, b) => a.key.localeCompare(b.key));
    return list;
  }, [entries]);

  const isSource = selectedLocale === sourceLocale;
  const currentLocaleStats = useMemo(() => {
    const total = sortedEntries.length;
    if (isSource) return { total, filled: total, pendingReview: 0, needsUpdate: 0 };
    let filled = 0;
    let pendingReview = 0;
    let needsUpdate = 0;
    for (const e of sortedEntries) {
      const tr = e.translations[selectedLocale];
      if (tr?.text?.trim()) filled += 1;
      if (tr?.status === 'needs_review' || tr?.status === 'ready') pendingReview += 1;
      if (tr?.status === 'needs_update') needsUpdate += 1;
    }
    return { total, filled, pendingReview, needsUpdate };
  }, [isSource, selectedLocale, sortedEntries]);

  const entriesByFilters = useMemo(() => {
    return sortedEntries.filter((e) => {
      if (poolOnly && e.placementCount > 0) return false;
      if (isSource) return true;

      const tr = e.translations[selectedLocale];
      const text = tr?.text ?? '';
      const status = (tr?.status ?? 'pending') as TranslationStatus;

      if (filledFilter === 'filled' && !text.trim()) return false;
      if (filledFilter === 'empty' && text.trim()) return false;
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      return true;
    });
  }, [filledFilter, isSource, poolOnly, selectedLocale, sortedEntries, statusFilter]);

  const { page, setPage, pageCount, filteredTotal, pageItems } = useSearchPagination({
    items: entriesByFilters,
    query: tab === 'entries' ? query : '',
    pageSize: 20,
    predicate: (e, q) => {
      const current = isSource
        ? e.sourceText
        : (e.translations[selectedLocale]?.text ?? '').toString();
      return (
        e.key.toLowerCase().includes(q) ||
        e.sourceText.toLowerCase().includes(q) ||
        current.toLowerCase().includes(q)
      );
    }
  });

  const selectedLocaleLabel = useMemo(() => {
    const found = localeOptions.find((o) => o.code === selectedLocale);
    if (!found) return selectedLocale;
    return found.label;
  }, [localeOptions, selectedLocale]);

  const handleDownload = async () => {
    try {
      const res = await exportLanguagePackAction({
        projectId,
        locale: downloadLocale,
        mode: downloadMode
      });
      if (!res.ok) {
        push({ variant: 'destructive', title: '导出失败', message: res.error });
        return;
      }

      const blob = new Blob([res.data.content], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.data.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      push({ variant: 'default', title: '已开始下载', message: `导出语言：${downloadLocale}` });
      setDownloadOpen(false);
    } catch {
      push({ variant: 'destructive', title: '导出失败', message: '导出过程中发生异常，请重试。' });
    }
  };

  if (bootstrapError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">加载失败</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{bootstrapError}</CardContent>
      </Card>
    );
  }

  if (!targetLocales.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">请先添加目标语言</CardTitle>
          <CardAction>
            <Button asChild>
              <Link href={`/projects/${projectId}/settings/locales`}>前往项目设置</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          未配置目标语言时，仍可在源语言下上传/下载与维护词条；目标语言相关能力将不可用。
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <CreateEntrySheetContainer
        open={createOpen}
        onOpenChange={setCreateOpen}
        canManage={canManage}
        targetLocales={targetLocales}
        projectId={projectId}
        entries={entries}
        onEntriesUpdated={setEntries}
        onCreated={() => {
          setTab('entries');
        }}
      />

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base">语言包管理</CardTitle>
              <div className="mt-1 text-sm text-muted-foreground">
                管理原文与翻译内容，支持导入/导出与页面/模块归属。组织形式：{templateShape === 'tree' ? '树形' : '扁平'}。
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu
                trigger={
                  <Button type="button" variant="outline" className="h-10 min-w-[220px] justify-between">
                    <span className="truncate">
                      <span className="text-foreground">{selectedLocaleLabel}</span>
                      <span className="ml-1 text-xs text-muted-foreground">{selectedLocale}</span>
                    </span>
                    <Badge
                      variant={isSource ? 'secondary' : 'outline'}
                      className="ml-2"
                    >
                      {isSource ? '源' : '目标'}
                    </Badge>
                  </Button>
                }
                contentProps={{
                  align: 'end',
                  style: { width: 'var(--radix-popper-anchor-width)' },
                  className: 'max-w-[calc(100vw-2rem)] min-w-[220px]'
                }}
                items={[
                  {
                    type: 'radio-group',
                    value: selectedLocale,
                    onValueChange: (v) => {
                      setSelectedLocale(v);
                      setQuery('');
                      setPage(1);
                    },
                    items: localeOptions.map((opt) => ({
                      value: opt.code,
                      label: (
                        <span className="flex w-full items-center justify-between gap-3">
                          <span className="flex items-center gap-2">
                            <span className="text-foreground">{opt.label}</span>
                            <Badge variant={opt.kind === 'source' ? 'secondary' : 'outline'}>
                              {opt.kind === 'source' ? '源' : '目标'}
                            </Badge>
                          </span>
                          <span className="text-xs text-muted-foreground">{opt.code}</span>
                        </span>
                      )
                    }))
                  }
                ]}
              />

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTab('import');
                }}
              >
                <Upload />
                上传语言包
              </Button>

              <DownloadDialog
                open={downloadOpen}
                onOpenChange={setDownloadOpen}
                downloadLocale={downloadLocale}
                onDownloadLocaleChange={setDownloadLocale}
                downloadMode={downloadMode}
                onDownloadModeChange={setDownloadMode}
                localeOptions={localeOptions}
                sourceLocale={sourceLocale}
                onConfirm={() => void handleDownload()}
              />

              <Button type="button" variant="outline" onClick={() => setTab('history')}>
                历史
              </Button>

              <Button
                type="button"
                disabled={!canManage}
                onClick={() => {
                  setCreateOpen(true);
                }}
              >
                <Plus />
                新增词条
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">总数 {currentLocaleStats.total}</Badge>
            <Badge variant="outline">已填写 {currentLocaleStats.filled}</Badge>
            {isSource ? null : (
              <>
                <Badge variant="outline">待核对 {currentLocaleStats.pendingReview}</Badge>
                <Badge variant="outline">待更新 {currentLocaleStats.needsUpdate}</Badge>
              </>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v as TabKey);
              setQuery('');
              setPage(1);
            }}
            items={[
              {
                value: 'entries',
                label: (
                  <span className="flex items-center gap-2">
                    词条列表
                    <Badge variant="secondary">{filteredTotal}</Badge>
                  </span>
                ),
                content: (
                  <EntriesTabContent
                    query={query}
                    onQueryChange={setQuery}
                    poolOnly={poolOnly}
                    onPoolOnlyChange={(value) => {
                      setPoolOnly(value);
                      setPage(1);
                    }}
                    filledFilter={filledFilter}
                    onFilledFilterChange={(value) => {
                      setFilledFilter(value);
                      setPage(1);
                    }}
                    statusFilter={statusFilter}
                    onStatusFilterChange={(value) => {
                      setStatusFilter(value);
                      setPage(1);
                    }}
                    isSource={isSource}
                    selectedLocale={selectedLocale}
                    filteredTotal={filteredTotal}
                    entriesError={entriesError}
                    pageItems={pageItems}
                    page={page}
                    pageCount={pageCount}
                    onPageChange={setPage}
                    projectId={projectId}
                  />
                )
              },
              {
                value: 'import',
                label: '上传导入',
                content: (
                  <ImportTabContent
                    active={tab === 'import'}
                    selectedLocale={selectedLocale}
                    sourceLocale={sourceLocale}
                    entries={entries}
                    canManage={canManage}
                    projectId={projectId}
                    onEntriesUpdated={setEntries}
                    onImportSuccess={(contextLink) => {
                      setLastImportContextLink(contextLink);
                      setTab('history');
                      setHistoryRefreshSignal((s) => s + 1);
                    }}
                  />
                )
              },
              {
                value: 'history',
                label: '上传历史',
                content: (
                  <HistoryPanel
                    active={tab === 'history'}
                    projectId={projectId}
                    sourceLocale={sourceLocale}
                    targetLocales={targetLocales}
                    contextLink={lastImportContextLink}
                    refreshSignal={historyRefreshSignal}
                  />
                )
              }
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
