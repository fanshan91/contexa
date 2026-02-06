'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Table, type TableColumn } from '@/components/ui/table';
import { listPackagesEntryPlacementsQuery, type PackagesEntry, type PackagesEntryPlacement } from './actions';
import { PlacementsDialog } from './dialogs';
import { StatusPill } from './shared';
import type { TranslationStatus } from './types';
import { formatDateTime } from './utils';

export function EntriesTabContent({
  query,
  onQueryChange,
  poolOnly,
  onPoolOnlyChange,
  filledFilter,
  onFilledFilterChange,
  statusFilter,
  onStatusFilterChange,
  isSource,
  selectedLocale,
  filteredTotal,
  entriesError,
  pageItems,
  page,
  pageCount,
  onPageChange,
  projectId
}: {
  query: string;
  onQueryChange: (value: string) => void;
  poolOnly: boolean;
  onPoolOnlyChange: (value: boolean) => void;
  filledFilter: 'all' | 'filled' | 'empty';
  onFilledFilterChange: (value: 'all' | 'filled' | 'empty') => void;
  statusFilter: TranslationStatus | 'all';
  onStatusFilterChange: (value: TranslationStatus | 'all') => void;
  isSource: boolean;
  selectedLocale: string;
  filteredTotal: number;
  entriesError: string;
  pageItems: PackagesEntry[];
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  projectId: number;
}) {
  const [placementsOpen, setPlacementsOpen] = useState(false);
  const [placementsBusy, setPlacementsBusy] = useState(false);
  const [placementsError, setPlacementsError] = useState<string | null>(null);
  const [placementsEntry, setPlacementsEntry] = useState<PackagesEntry | null>(null);
  const [placements, setPlacements] = useState<PackagesEntryPlacement[]>([]);

  const openPlacements = useCallback(
    async (entry: PackagesEntry) => {
      setPlacementsEntry(entry);
      setPlacementsOpen(true);
      setPlacementsError(null);
      setPlacementsBusy(true);
      try {
        const res = await listPackagesEntryPlacementsQuery({ projectId, entryId: entry.id });
        if (!res.ok) {
          setPlacementsError(res.error);
          setPlacements([]);
          return;
        }
        setPlacements(res.data.items);
      } catch {
        setPlacementsError('加载归属失败，请重试。');
        setPlacements([]);
      } finally {
        setPlacementsBusy(false);
      }
    },
    [projectId]
  );

  const entryColumns = useMemo<Array<TableColumn<PackagesEntry>>>(
    () => [
      {
        key: 'key',
        title: 'Key',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top',
        render: (_value: unknown, record: PackagesEntry) => (
          <code className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground">{record.key}</code>
        )
      },
      {
        key: 'sourceText',
        title: '源文案',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-foreground',
        render: (_value: unknown, record: PackagesEntry) => (
          <div className="max-w-[420px] break-words">{record.sourceText}</div>
        )
      },
      {
        key: 'currentText',
        title: '当前语言',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-foreground',
        render: (_value: unknown, record: PackagesEntry) => {
          const current = isSource ? record.sourceText : (record.translations[selectedLocale]?.text ?? '');
          return current?.trim() ? (
            <div className="max-w-[420px] break-words">{current}</div>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        }
      },
      {
        key: 'status',
        title: '状态',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top',
        render: (_value: unknown, record: PackagesEntry) => {
          if (isSource) return <span className="text-xs text-muted-foreground">源语言</span>;
          const tr = record.translations[selectedLocale];
          return <StatusPill status={(tr?.status ?? 'pending') as TranslationStatus} />;
        }
      },
      {
        key: 'placement',
        title: '归属',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top',
        render: (_value: unknown, record: PackagesEntry) => {
          const label = record.placement
            ? `${record.placement.pageTitle || record.placement.pageRoute}${record.placement.moduleName ? ` / ${record.placement.moduleName}` : ''}`
            : '未归属';

          return (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={record.placement ? 'outline' : 'secondary'} className="max-w-[280px] truncate">
                {label}
              </Badge>
              {record.hasMorePlacements ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => void openPlacements(record)}
                >
                  查看更多
                </Button>
              ) : null}
            </div>
          );
        }
      },
      {
        key: 'updatedAt',
        title: '更新时间',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-muted-foreground',
        render: (_value: unknown, record: PackagesEntry) => (
          <span suppressHydrationWarning>{formatDateTime(record.updatedAt)}</span>
        )
      }
    ],
    [isSource, openPlacements, selectedLocale]
  );

  return (
    <div className="space-y-4">
      <PlacementsDialog
        open={placementsOpen}
        onOpenChange={setPlacementsOpen}
        placementsEntry={placementsEntry}
        placements={placements}
        placementsError={placementsError}
        placementsBusy={placementsBusy}
        projectId={projectId}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-md">
          <Input value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="搜索 key / 文案" />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DropdownMenu
            trigger={
              <Button type="button" variant="outline">
                筛选
                {poolOnly || filledFilter !== 'all' || statusFilter !== 'all' ? (
                  <Badge variant="secondary" className="ml-1">
                    已启用
                  </Badge>
                ) : null}
              </Button>
            }
            items={[
              {
                type: 'checkbox',
                label: '仅看未分类词条（未归属）',
                checked: poolOnly,
                onCheckedChange: (checked) => onPoolOnlyChange(Boolean(checked))
              },
              { type: 'separator' },
              { type: 'label', label: '填写情况' },
              {
                type: 'radio-group',
                value: filledFilter,
                onValueChange: (v) => onFilledFilterChange(v as typeof filledFilter),
                items: [
                  { value: 'all', label: '全部' },
                  { value: 'filled', label: '仅已填写' },
                  { value: 'empty', label: '仅未填写' }
                ]
              },
              { type: 'separator' },
              { type: 'label', label: '状态（目标语言）' },
              {
                type: 'radio-group',
                value: statusFilter,
                onValueChange: (v) => onStatusFilterChange(v as typeof statusFilter),
                items: [
                  { value: 'all', label: '全部', disabled: isSource },
                  { value: 'pending', label: '待翻译', disabled: isSource },
                  { value: 'needs_update', label: '待更新', disabled: isSource },
                  { value: 'needs_review', label: '待核对', disabled: isSource },
                  { value: 'ready', label: '待核对', disabled: isSource },
                  { value: 'approved', label: '已定版', disabled: isSource }
                ]
              }
            ]}
          />
          <Button asChild variant="outline">
            <Link href={`/projects/${projectId}/overview`}>打开项目概览</Link>
          </Button>
        </div>
      </div>
      {entriesError ? (
        <div className="rounded-md border border-destructive/30 bg-background px-3 py-2 text-sm text-destructive">
          {entriesError}
        </div>
      ) : null}
      <Table columns={entryColumns} data={pageItems} rowKey="id" />
      <Pagination page={page} pageCount={pageCount} total={filteredTotal} onChange={onPageChange} />
    </div>
  );
}
