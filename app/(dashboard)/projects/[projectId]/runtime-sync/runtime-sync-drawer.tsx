'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { Table, type TableColumn } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { ContextNodePicker } from '../context/context-node-picker';
import type { ContextPage, SelectedNode } from '../context/context-model';
import type { ContextPageNode, RuntimeDiffItem, RuntimeRouteDiff } from './actions';

function toContextPages(projectId: number, pages: ContextPageNode[]): ContextPage[] {
  return pages.map((p) => ({
    id: p.id,
    projectId,
    route: p.route,
    title: p.title,
    description: null,
    updatedAt: new Date().toISOString(),
    modules: p.modules.map((m) => ({
      id: m.id,
      pageId: p.id,
      name: m.name,
      description: null,
      updatedAt: new Date().toISOString()
    }))
  }));
}

function kindLabel(kind: RuntimeDiffItem['kind']) {
  if (kind === 'add') return '新增关系';
  if (kind === 'move') return '关系变更';
  if (kind === 'delete_suggestion') return '删除建议';
  return '未收录';
}

type ApplyOp = {
  kind: RuntimeDiffItem['kind'];
  key: string;
  sourceText?: string;
  entryId?: number | null;
  currentModuleId?: number | null;
  action: 'ignore' | 'bind' | 'delete';
  targetPageId?: number | null;
  targetModuleId?: number | null;
};

export function RuntimeSyncDrawer({
  open,
  onOpenChange,
  projectId,
  route,
  canManage,
  diff,
  contextPages,
  onRefresh,
  onCreatePage,
  onCreateModule,
  onApply
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  route: string;
  canManage: boolean;
  diff: RuntimeRouteDiff | null;
  contextPages: ContextPageNode[];
  onRefresh: () => void;
  onCreatePage: (input: { projectId: number; route: string; title?: string; moduleName?: string }) => Promise<any>;
  onCreateModule: (input: { projectId: number; pageId: number; name: string }) => Promise<any>;
  onApply: (ops: ApplyOp[]) => Promise<any>;
}) {
  const pages = useMemo(() => toContextPages(projectId, contextPages), [projectId, contextPages]);
  const [selection, setSelection] = useState<Map<string, SelectedNode | null>>(new Map());
  const [acceptDelete, setAcceptDelete] = useState<Set<string>>(new Set());

  const [newPageTitle, setNewPageTitle] = useState('');
  const [newModuleName, setNewModuleName] = useState('');
  const [createModuleName, setCreateModuleName] = useState('');

  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setSelection(new Map());
    setAcceptDelete(new Set());
    setNewPageTitle('');
    setNewModuleName('');
    setCreateModuleName('');
  }, [open, route]);

  const defaultNode = useMemo(() => {
    if (!diff?.page) return null;
    return { type: 'page' as const, pageId: diff.page.id };
  }, [diff?.page]);

  const columns = useMemo((): Array<TableColumn<any>> => {
    return [
      {
        key: 'kind',
        title: '变化类型',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top',
        render: (_: unknown, record: RuntimeDiffItem) => (
          <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs text-foreground">
            {kindLabel(record.kind)}
          </span>
        )
      },
      {
        key: 'key',
        title: 'Key',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top',
        render: (_: unknown, record: RuntimeDiffItem) => (
          <code className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground">{record.key}</code>
        )
      },
      {
        key: 'sourceText',
        title: '源文案',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-foreground',
        render: (_: unknown, record: RuntimeDiffItem) =>
          'sourceText' in record ? (
            <div className="max-w-[420px] break-words">{record.sourceText}</div>
          ) : (
            <div className="text-muted-foreground">—</div>
          )
      },
      {
        key: 'current',
        title: '当前归属',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-foreground',
        render: (_: unknown, record: RuntimeDiffItem) => {
          if (record.kind === 'move' || record.kind === 'delete_suggestion') {
            return (
              <div className="text-sm">
                <span className="text-muted-foreground">模块：</span>
                {record.current.moduleName}
              </div>
            );
          }
          return <div className="text-muted-foreground">—</div>;
        }
      },
      {
        key: 'target',
        title: '调整为',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top',
        render: (_: unknown, record: RuntimeDiffItem) => {
          if (record.kind === 'delete_suggestion') {
            const checked = acceptDelete.has(record.key);
            return (
              <div className="flex items-center gap-2">
                <Switch
                  checked={checked}
                  onCheckedChange={(v) => {
                    setAcceptDelete((prev) => {
                      const next = new Set(prev);
                      if (v) next.add(record.key);
                      else next.delete(record.key);
                      return next;
                    });
                  }}
                  disabled={!canManage}
                />
                <div className="text-sm text-muted-foreground">接受删除</div>
              </div>
            );
          }

          const selected = selection.get(record.key) ?? defaultNode;
          return (
            <ContextNodePicker
              pages={pages}
              selected={selected ?? null}
              onSelect={(next) => {
                setSelection((prev) => {
                  const out = new Map(prev);
                  out.set(record.key, next);
                  return out;
                });
              }}
              disabled={!canManage || pages.length === 0}
            />
          );
        }
      }
    ];
  }, [pages, selection, acceptDelete, canManage, defaultNode]);

  const apply = () => {
    if (!diff) return;
    startTransition(async () => {
      const ops: ApplyOp[] = diff.items.map((it) => {
        if (it.kind === 'delete_suggestion') {
          const shouldDelete = acceptDelete.has(it.key);
          return {
            kind: it.kind,
            key: it.key,
            entryId: it.entryId,
            currentModuleId: it.current.moduleId,
            action: shouldDelete ? 'delete' : 'ignore'
          };
        }

        const selected = selection.get(it.key) ?? defaultNode ?? null;
        if (!selected) {
          return {
            kind: it.kind,
            key: it.key,
            sourceText: 'sourceText' in it ? it.sourceText : undefined,
            entryId: 'entryId' in it ? it.entryId : null,
            currentModuleId: it.kind === 'move' ? it.current.moduleId : null,
            action: 'ignore'
          };
        }

        return {
          kind: it.kind,
          key: it.key,
          sourceText: 'sourceText' in it ? it.sourceText : undefined,
          entryId: 'entryId' in it ? it.entryId : null,
          currentModuleId: it.kind === 'move' ? it.current.moduleId : null,
          action: 'bind',
          targetPageId: selected.pageId,
          targetModuleId: selected.type === 'module' ? selected.moduleId : null
        };
      });

      await onApply(ops);
    });
  };

  const createPage = () => {
    if (!route.trim()) return;
    startTransition(async () => {
      await onCreatePage({
        projectId,
        route: route.trim(),
        title: newPageTitle.trim() || undefined,
        moduleName: newModuleName.trim() || undefined
      });
    });
  };

  const createModule = () => {
    if (!diff?.page) return;
    if (!createModuleName.trim()) return;
    startTransition(async () => {
      await onCreateModule({
        projectId,
        pageId: diff.page!.id,
        name: createModuleName.trim()
      });
      setCreateModuleName('');
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="space-y-1">
          <div className="text-lg font-semibold text-foreground">页面词条同步</div>
          <div className="text-sm text-muted-foreground">
            {route ? (
              <>
                <span className="text-foreground">{route}</span>
                <span className="mx-2">·</span>
                <span>仅展示新增与差异</span>
              </>
            ) : (
              '—'
            )}
          </div>
        </div>
      }
      contentClassName="max-w-[920px]"
      footer={
        <>
          <Button variant="outline" className="shadow-none" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={apply} disabled={!canManage || pending || !diff}>
            确认更新
          </Button>
        </>
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {diff ? (
            <>
              汇总：新增 {diff.summary.added} · 变更 {diff.summary.moved} · 删除建议 {diff.summary.deleteSuggested} · 共{' '}
              {diff.summary.total}
            </>
          ) : (
            '加载中…'
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="shadow-none" onClick={onRefresh} disabled={pending}>
            <RefreshCw className={cn('mr-2 h-4 w-4', pending ? 'animate-spin' : '')} />
            刷新
          </Button>
        </div>
      </div>

      {!diff ? (
        <div className="py-10 text-center text-sm text-muted-foreground">加载差异中…</div>
      ) : diff.page ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              已匹配页面：<span className="text-foreground">{diff.page.title ? diff.page.title : diff.route}</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={createModuleName}
                onChange={(e) => setCreateModuleName(e.target.value)}
                placeholder="新增模块名（可选）"
                className="w-[220px]"
                disabled={!canManage}
              />
              <Button
                variant="outline"
                className="shadow-none"
                onClick={createModule}
                disabled={!canManage || !createModuleName.trim()}
              >
                <Plus className="mr-2 h-4 w-4" />
                新增模块
              </Button>
            </div>
          </div>

          <Table
            columns={columns}
            data={diff.items}
            rowKey={(r: any) => r.key}
            emptyText="暂无差异项。"
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-medium text-foreground">当前路由未匹配到页面</div>
            <div className="mt-1 text-sm text-muted-foreground">
              可先创建页面并绑定路由，再继续对齐差异。
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
                placeholder="页面标题（可选）"
                className="sm:w-[240px]"
                disabled={!canManage}
              />
              <Input
                value={newModuleName}
                onChange={(e) => setNewModuleName(e.target.value)}
                placeholder="初始模块名（可选）"
                className="sm:w-[240px]"
                disabled={!canManage}
              />
              <Button onClick={createPage} disabled={!canManage || pending}>
                创建页面并继续
              </Button>
            </div>
          </div>

          <Table
            columns={columns}
            data={diff.items}
            rowKey={(r: any) => r.key}
            emptyText="暂无差异项。"
          />
        </div>
      )}
    </Sheet>
  );
}
