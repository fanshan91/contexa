'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Loader2, RefreshCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Sheet } from '@/components/ui/sheet';
import { Table, type TableColumn } from '@/components/ui/table';
import {
  getPackagesUploadHistoryDetailQuery,
  listPackagesUploadHistoryQuery,
  type PackagesUploadHistoryDetail,
  type PackagesUploadHistoryItem
} from './actions';
import { useSearchPagination } from './hooks';
import { PreviewTable } from './shared';
import { formatDateTime } from './utils';

export function HistoryPanel({
  active,
  projectId,
  sourceLocale,
  targetLocales,
  contextLink,
  refreshSignal
}: {
  active: boolean;
  projectId: number;
  sourceLocale: string;
  targetLocales: string[];
  contextLink: string | null;
  refreshSignal: number;
}) {
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [history, setHistory] = useState<PackagesUploadHistoryItem[]>([]);
  const [historyQuery, setHistoryQuery] = useState('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<PackagesUploadHistoryDetail | null>(null);

  const loadHistory = useCallback(
    async (force?: boolean) => {
      if (historyBusy) return;
      if (!force && historyLoaded) return;
      setHistoryBusy(true);
      setHistoryError(null);
      try {
        const res = await listPackagesUploadHistoryQuery(projectId);
        if (!res.ok) {
          setHistoryError(res.error);
          setHistory([]);
          setHistoryLoaded(true);
          return;
        }
        setHistory(res.data.items);
        setHistoryLoaded(true);
      } catch {
        setHistoryError('加载上传历史失败，请重试。');
        setHistory([]);
        setHistoryLoaded(true);
      } finally {
        setHistoryBusy(false);
      }
    },
    [historyBusy, historyLoaded, projectId]
  );

  const openHistoryDetail = useCallback(
    async (uploadId: number) => {
      setDetailOpen(true);
      setDetailBusy(true);
      setDetailError(null);
      setDetail(null);
      try {
        const res = await getPackagesUploadHistoryDetailQuery({ projectId, uploadId });
        if (!res.ok) {
          setDetailError(res.error);
          return;
        }
        setDetail(res.data);
      } catch {
        setDetailError('加载详情失败，请重试。');
      } finally {
        setDetailBusy(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    if (!active) return;
    void loadHistory();
  }, [active, loadHistory]);

  useEffect(() => {
    setHistoryLoaded(false);
    if (!active) return;
    void loadHistory(true);
  }, [active, loadHistory, refreshSignal]);

  const {
    page: historyPage,
    setPage: setHistoryPage,
    pageCount: historyPageCount,
    filteredTotal: historyFilteredTotal,
    pageItems: historyPageItems
  } = useSearchPagination({
    items: history,
    query: historyQuery,
    pageSize: 20,
    predicate: (it, q) => {
      return (
        it.locale.toLowerCase().includes(q) ||
        it.operator.toLowerCase().includes(q) ||
        formatDateTime(it.createdAt).toLowerCase().includes(q)
      );
    }
  });

  const historyColumns = useMemo<Array<TableColumn<PackagesUploadHistoryItem>>>(
    () => [
      {
        key: 'createdAt',
        title: '时间',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-foreground',
        render: (_value: unknown, record: PackagesUploadHistoryItem) => (
          <span suppressHydrationWarning>{formatDateTime(record.createdAt)}</span>
        )
      },
      {
        key: 'locale',
        title: '语言',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top',
        render: (_value: unknown, record: PackagesUploadHistoryItem) => (
          <div className="flex items-center gap-2">
            <span className="text-foreground">{record.locale}</span>
            <Badge variant={record.locale === sourceLocale ? 'secondary' : 'outline'}>
              {record.locale === sourceLocale ? '源' : '目标'}
            </Badge>
          </div>
        )
      },
      {
        key: 'operator',
        title: '操作者',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-foreground',
        render: (_value: unknown, record: PackagesUploadHistoryItem) => record.operator
      },
      {
        key: 'summary',
        title: '摘要',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top',
        render: (_value: unknown, record: PackagesUploadHistoryItem) => (
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">新增 {record.summary.added}</Badge>
            <Badge variant="outline">更新 {record.summary.updated}</Badge>
            <Badge variant="outline">缺失 {record.summary.missing}</Badge>
            {record.locale === sourceLocale ? (
              <Badge variant="outline">待更新 {record.summary.markedNeedsUpdate}</Badge>
            ) : (
              <Badge variant="outline">忽略 {record.summary.ignored}</Badge>
            )}
          </div>
        )
      },
      {
        key: 'actions',
        title: '操作',
        headerClassName: 'bg-card px-3 py-2 text-right font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-right',
        align: 'right',
        render: (_value: unknown, record: PackagesUploadHistoryItem) => (
          <Button type="button" size="sm" variant="outline" onClick={() => void openHistoryDetail(record.id)}>
            <Eye />
            查看
          </Button>
        )
      }
    ],
    [openHistoryDetail, sourceLocale]
  );

  return (
    <>
      <HistoryDetailSheet
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setDetail(null);
            setDetailError(null);
          }
        }}
        detail={detail}
        detailBusy={detailBusy}
        detailError={detailError}
        sourceLocale={sourceLocale}
        targetLocales={targetLocales}
        projectId={projectId}
      />

      <HistoryTabContent
        historyQuery={historyQuery}
        onHistoryQueryChange={(value) => {
          setHistoryQuery(value);
          setHistoryPage(1);
        }}
        historyBusy={historyBusy}
        historyError={historyError}
        onRefresh={() => void loadHistory(true)}
        historyColumns={historyColumns}
        historyPageItems={historyPageItems}
        historyPage={historyPage}
        historyPageCount={historyPageCount}
        historyFilteredTotal={historyFilteredTotal}
        onPageChange={setHistoryPage}
        contextLink={contextLink}
      />
    </>
  );
}

export function HistoryDetailSheet({
  open,
  onOpenChange,
  detail,
  detailBusy,
  detailError,
  sourceLocale,
  targetLocales,
  projectId
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: PackagesUploadHistoryDetail | null;
  detailBusy: boolean;
  detailError: string | null;
  sourceLocale: string;
  targetLocales: string[];
  projectId: number;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
      }}
      title={<span className="text-base">上传详情</span>}
      description={
        detail ? (
          <span className="text-sm text-muted-foreground">
            {formatDateTime(detail.createdAt)} · {detail.locale} · {detail.shape}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )
      }
      footer={
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          关闭
        </Button>
      }
    >
      {detailBusy ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          加载中…
        </div>
      ) : detailError ? (
        <div className="rounded-md border border-destructive/30 bg-background px-3 py-2 text-sm text-destructive">
          {detailError}
        </div>
      ) : detail ? (
        <div className="space-y-6">
          <div className="space-y-3 rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">操作者 {detail.operator}</Badge>
              <Badge variant="outline">新增 {detail.summary.added}</Badge>
              <Badge variant="outline">更新 {detail.summary.updated}</Badge>
              <Badge variant="outline">缺失 {detail.summary.missing}</Badge>
              {detail.locale === sourceLocale ? (
                <Badge variant="outline">待更新 {detail.summary.markedNeedsUpdate}</Badge>
              ) : (
                <>
                  <Badge variant="outline">忽略 {detail.summary.ignored}</Badge>
                  <Badge variant="outline">跳过空值 {detail.summary.skippedEmpty}</Badge>
                </>
              )}
            </div>

            {(() => {
              const isSourceUpload = detail.locale === sourceLocale;
              const jumpLocale = isSourceUpload ? (targetLocales[0] ?? '') : detail.locale;
              const jumpStatus = isSourceUpload ? 'needs_update' : 'needs_review';
              const jumpKey = isSourceUpload
                ? detail.details.markedNeedsUpdateKeys[0]
                : detail.details.pendingReviewKeys[0];
              if (!jumpLocale || !jumpKey) return null;
              return (
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={`/projects/${projectId}/workbench?locale=${encodeURIComponent(
                      jumpLocale
                    )}&status=${jumpStatus}&key=${encodeURIComponent(jumpKey)}`}
                  >
                    前往翻译工作台
                  </Link>
                </Button>
              );
            })()}
          </div>

          {detail.details.addedKeys.length ? (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-foreground">新增词条</div>
              <div className="flex flex-wrap gap-2">
                {detail.details.addedKeys.slice(0, 200).map((k) => (
                  <code key={k} className="rounded-md border border-border bg-card px-2 py-0.5 text-xs text-foreground">
                    {k}
                  </code>
                ))}
                {detail.details.addedKeys.length > 200 ? (
                  <span className="text-xs text-muted-foreground">
                    仅展示前 200 条，共 {detail.details.addedKeys.length} 条
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {detail.details.updatedKeys.length ? (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-foreground">修改差异</div>
              <PreviewTable kind="updated" items={detail.details.updatedKeys} emptyText="无修改项" />
            </div>
          ) : null}

          {detail.locale === sourceLocale && detail.details.markedNeedsUpdateKeys.length ? (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-foreground">标记为待更新</div>
              <div className="flex flex-wrap gap-2">
                {detail.details.markedNeedsUpdateKeys.slice(0, 200).map((k) => (
                  <code key={k} className="rounded-md border border-border bg-card px-2 py-0.5 text-xs text-foreground">
                    {k}
                  </code>
                ))}
                {detail.details.markedNeedsUpdateKeys.length > 200 ? (
                  <span className="text-xs text-muted-foreground">
                    仅展示前 200 条，共 {detail.details.markedNeedsUpdateKeys.length} 条
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {detail.details.ignoredKeys.length ? (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-foreground">被忽略的 key</div>
              <PreviewTable kind="ignored" items={detail.details.ignoredKeys.map((k) => ({ key: k }))} emptyText="无忽略项" />
            </div>
          ) : null}

          {detail.details.skippedEmptyKeys.length ? (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-foreground">空值跳过</div>
              <div className="flex flex-wrap gap-2">
                {detail.details.skippedEmptyKeys.slice(0, 200).map((k) => (
                  <code key={k} className="rounded-md border border-border bg-card px-2 py-0.5 text-xs text-foreground">
                    {k}
                  </code>
                ))}
                {detail.details.skippedEmptyKeys.length > 200 ? (
                  <span className="text-xs text-muted-foreground">
                    仅展示前 200 条，共 {detail.details.skippedEmptyKeys.length} 条
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">未选择记录</div>
      )}
    </Sheet>
  );
}

export function HistoryTabContent({
  historyQuery,
  onHistoryQueryChange,
  historyBusy,
  historyError,
  onRefresh,
  historyColumns,
  historyPageItems,
  historyPage,
  historyPageCount,
  historyFilteredTotal,
  onPageChange,
  contextLink
}: {
  historyQuery: string;
  onHistoryQueryChange: (value: string) => void;
  historyBusy: boolean;
  historyError: string | null;
  onRefresh: () => void;
  historyColumns: Array<TableColumn<PackagesUploadHistoryItem>>;
  historyPageItems: PackagesUploadHistoryItem[];
  historyPage: number;
  historyPageCount: number;
  historyFilteredTotal: number;
  onPageChange: (page: number) => void;
  contextLink: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-md">
          <Input value={historyQuery} onChange={(e) => onHistoryQueryChange(e.target.value)} placeholder="搜索语言 / 操作者 / 时间" />
        </div>
        <div className="flex items-center justify-end gap-2">
          {contextLink ? (
            <Button asChild type="button" variant="outline" disabled={historyBusy}>
              <Link href={contextLink}>查看绑定结果</Link>
            </Button>
          ) : null}
          <Button type="button" variant="outline" disabled={historyBusy} onClick={onRefresh}>
            {historyBusy ? <Loader2 className="animate-spin" /> : <RefreshCcw />}
            刷新
          </Button>
        </div>
      </div>

      {historyError ? (
        <div className="rounded-md border border-destructive/30 bg-background px-3 py-2 text-sm text-destructive">
          {historyError}
        </div>
      ) : null}

      <Table columns={historyColumns} data={historyPageItems} rowKey="id" emptyText={historyBusy ? '加载中…' : '暂无上传记录'} />

      <Pagination page={historyPage} pageCount={historyPageCount} total={historyFilteredTotal} onChange={onPageChange} pending={historyBusy} />
    </div>
  );
}
