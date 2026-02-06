'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Table, type TableColumn } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { TranslationStatus } from './types';
import { useSearchPagination } from './hooks';

export function StatusPill({ status }: { status: TranslationStatus }) {
  const { label, cls } =
    status === 'approved'
      ? { label: '已定版', cls: 'border-success/30 text-success' }
      : status === 'needs_review' || status === 'ready'
        ? { label: '待核对', cls: 'border-warning/40 text-warning' }
        : status === 'needs_update'
          ? { label: '待更新', cls: 'border-info/30 text-info' }
          : { label: '待翻译', cls: 'border-border text-muted-foreground' };

  return <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs', cls)}>{label}</span>;
}

type PreviewTableProps =
  | {
      kind: 'added';
      items: Array<{ key: string; text: string }>;
      emptyText: string;
    }
  | {
      kind: 'updated';
      items: Array<{ key: string; before: string; after: string }>;
      emptyText: string;
    }
  | {
      kind: 'ignored';
      items: Array<{ key: string }>;
      emptyText: string;
    };

export function PreviewTable(props: PreviewTableProps) {
  const [query, setQuery] = useState('');

  const columns = useMemo((): Array<TableColumn<any>> => {
    if (props.kind === 'added') {
      return [
        {
          key: 'key',
          title: 'Key',
          headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
          cellClassName: 'px-3 py-2 align-top',
          render: (_value: unknown, record: any) => (
            <code className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground">
              {record.key}
            </code>
          )
        },
        {
          key: 'text',
          title: '文案',
          headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
          cellClassName: 'px-3 py-2 align-top text-foreground',
          render: (_value: unknown, record: any) => <div className="max-w-[520px] break-words">{record.text}</div>
        }
      ];
    }

    if (props.kind === 'ignored') {
      return [
        {
          key: 'key',
          title: 'Key',
          headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
          cellClassName: 'px-3 py-2 align-top',
          render: (_value: unknown, record: any) => (
            <code className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground">
              {record.key}
            </code>
          )
        }
      ];
    }

    return [
      {
        key: 'key',
        title: 'Key',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top',
        render: (_value: unknown, record: any) => (
          <code className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground">
            {record.key}
          </code>
        )
      },
      {
        key: 'before',
        title: '变更前',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-foreground',
        render: (_value: unknown, record: any) => <div className="max-w-[360px] break-words">{record.before || '—'}</div>
      },
      {
        key: 'after',
        title: '变更后',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-foreground',
        render: (_value: unknown, record: any) => <div className="max-w-[360px] break-words">{record.after || '—'}</div>
      }
    ];
  }, [props.kind, props.items]);

  const [pageSize, setPageSize] = useState(20);

  const { page, setPage, pageCount, filteredTotal, pageItems } = useSearchPagination({
    items: props.items,
    query,
    pageSize,
    predicate: (it, q) => {
      const key = String((it as any)?.key ?? '').toLowerCase();
      if (key.includes(q)) return true;
      if (props.kind === 'added') return String((it as any)?.text ?? '').toLowerCase().includes(q);
      if (props.kind === 'updated') {
        const before = String((it as any)?.before ?? '').toLowerCase();
        const after = String((it as any)?.after ?? '').toLowerCase();
        return before.includes(q) || after.includes(q);
      }
      return false;
    }
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索 key / 文案" />
        <div className="text-sm text-muted-foreground">共 {filteredTotal} 条</div>
      </div>
      <Table columns={columns} data={pageItems as any[]} emptyText={props.emptyText} />
      <Pagination
        page={page}
        pageCount={pageCount}
        total={filteredTotal}
        onChange={setPage}
        pageSize={pageSize}
        pageSizeOptions={[20, 50, 100]}
        onPageSizeChange={(next) => {
          setPageSize(next);
          setPage(1);
        }}
      />
    </div>
  );
}
