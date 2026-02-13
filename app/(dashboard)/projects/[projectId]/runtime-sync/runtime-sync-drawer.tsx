'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Plus, RefreshCw, AlertCircle, Layout, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { Table, type TableColumn } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { ContextNodePicker } from '../context/context-node-picker';
import type { ContextPage, SelectedNode } from '../context/context-model';
import type { ContextPageNode, RuntimeDiffItem, RuntimeRouteDiff, RuntimeSessionDraftOpRow } from './actions';

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

function getDiffKindConfig(kind: RuntimeDiffItem['kind']): { label: string; variant: BadgeVariant } {
  switch (kind) {
    case 'add':
      return { label: '新增', variant: 'success' };
    case 'move':
      return { label: '变更', variant: 'warning' };
    case 'delete_suggestion':
      return { label: '建议删除', variant: 'destructive' };
    default:
      return { label: '未收录', variant: 'secondary' };
  }
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
  draftOps,
  mode = 'apply',
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
  draftOps?: RuntimeSessionDraftOpRow[];
  mode?: 'apply' | 'draft';
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
    if (draftOps?.length) {
      const nextSelection = new Map<string, SelectedNode | null>();
      const nextDelete = new Set<string>();
      for (const d of draftOps) {
        if (d.action === 'delete') {
          nextDelete.add(d.key);
          continue;
        }
        if (d.action === 'bind' && d.targetPageId) {
          nextSelection.set(
            d.key,
            d.targetModuleId
              ? { type: 'module', pageId: d.targetPageId, moduleId: d.targetModuleId }
              : { type: 'page', pageId: d.targetPageId }
          );
          continue;
        }
        nextSelection.set(d.key, null);
      }
      setSelection(nextSelection);
      setAcceptDelete(nextDelete);
    }
  }, [open, route, draftOps, mode]);

  const defaultNode = useMemo(() => {
    if (mode !== 'apply') return null;
    if (!diff?.page) return null;
    return { type: 'page' as const, pageId: diff.page.id };
  }, [diff?.page, mode]);

  const columns = useMemo((): Array<TableColumn<any>> => {
    return [
      {
        key: 'kind',
        title: '类型',
        width: 100,
        render: (_: unknown, record: RuntimeDiffItem) => {
          const config = getDiffKindConfig(record.kind);
          return (
            <Badge variant={config.variant} className="whitespace-nowrap">
              {config.label}
            </Badge>
          );
        }
      },
      {
        key: 'key',
        title: 'Key / 源文案',
        render: (_: unknown, record: RuntimeDiffItem) => (
          <div className="flex flex-col gap-1 max-w-[300px]">
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground w-fit break-all">
              {record.key}
            </code>
            {'sourceText' in record && record.sourceText && (
              <div className="text-xs text-muted-foreground line-clamp-2" title={record.sourceText}>
                {record.sourceText}
              </div>
            )}
          </div>
        )
      },
      {
        key: 'current',
        title: '当前归属',
        width: 150,
        render: (_: unknown, record: RuntimeDiffItem) => {
          if (record.kind === 'move' || record.kind === 'delete_suggestion') {
            return (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Layout className="h-3.5 w-3.5" />
                <span>{record.current.moduleName}</span>
              </div>
            );
          }
          return <span className="text-muted-foreground">—</span>;
        }
      },
      {
        key: 'target',
        title: '调整操作',
        width: 280,
        render: (_: unknown, record: RuntimeDiffItem) => {
          if (record.kind === 'delete_suggestion') {
            const checked = acceptDelete.has(record.key);
            return (
              <div className="flex items-center gap-3">
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
                <span className={cn('text-sm', checked ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                  {checked ? '确认删除' : '保留暂不处理'}
                </span>
              </div>
            );
          }

          const selected = selection.get(record.key) ?? defaultNode;
          return (
            <div className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1">
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
                  disabled={!canManage}
                />
              </div>
            </div>
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
        <div className="flex flex-col gap-1.5 pt-2">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight text-foreground">
              {mode === 'draft' ? '采集对齐（草稿）' : '运行时采集同步'}
            </span>
            <Badge variant="outline" className="font-mono font-normal text-muted-foreground">
              {route || 'Global'}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            {mode === 'draft' ? '保存对齐草稿，点击页面顶部保存后落库' : '自动识别新增 Key 与变更项，确认后更新至 TMS'}
          </div>
        </div>
      }
      contentClassName="max-w-[960px] flex flex-col h-full sm:max-w-[960px]"
      footer={
        <div className="flex items-center justify-end gap-2 py-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={apply} disabled={!canManage || pending || !diff}>
            {mode === 'draft' ? '保存草稿' : '确认更新'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6 py-4 flex-1 overflow-hidden">
        {/* Summary Stats Bar */}
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
          <div className="flex items-center gap-4 text-sm">
            {!diff ? (
              <span className="text-muted-foreground">正在加载差异数据...</span>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">新增</span>
                  <span className="font-medium text-foreground">{diff.summary.added}</span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">变更</span>
                  <span className="font-medium text-foreground">{diff.summary.moved}</span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">删除建议</span>
                  <span className="font-medium text-foreground">{diff.summary.deleteSuggested}</span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">总计</span>
                  <span className="font-medium text-foreground">{diff.summary.total}</span>
                </div>
              </>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={pending} className="h-8">
            <RefreshCw className={cn('mr-2 h-3.5 w-3.5', pending ? 'animate-spin' : '')} />
            刷新数据
          </Button>
        </div>

        {/* Content Area */}
        {!diff ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="h-8 w-8 animate-spin opacity-20" />
              <span>正在分析运行时差异...</span>
            </div>
          </div>
        ) : diff.page ? (
          <div className="flex flex-col gap-4 flex-1 overflow-hidden">
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <Layout className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">已匹配页面：</span>
                <span className="font-medium text-foreground">{diff.page.title || diff.route}</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={createModuleName}
                  onChange={(e) => setCreateModuleName(e.target.value)}
                  placeholder="输入模块名称"
                  className="h-8 w-[180px] bg-background text-sm"
                  disabled={!canManage}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={createModule}
                  disabled={!canManage || !createModuleName.trim()}
                  className="h-8"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  新增模块
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto rounded-md border">
              <Table
                columns={columns}
                data={diff.items}
                rowKey={(r: any) => r.key}
                emptyText="暂无差异项，所有内容均已同步。"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 flex-1 overflow-hidden">
            <Alert
              variant="warning"
              className="bg-warning/5 border-warning/20"
              icon={<AlertCircle className="h-4 w-4" />}
              title={<span className="text-warning-foreground font-medium">当前路由未关联页面</span>}
              description={
                <div className="space-y-4">
                  <div className="text-muted-foreground mt-1">
                    系统检测到当前路由 <code>{route}</code> 尚未绑定任何 TMS 页面。您可以立即创建页面以开始管理词条。
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        value={newPageTitle}
                        onChange={(e) => setNewPageTitle(e.target.value)}
                        placeholder="页面标题（例如：个人中心）"
                        className="bg-background focus-visible:ring-warning/30"
                        disabled={!canManage}
                      />
                      <Input
                        value={newModuleName}
                        onChange={(e) => setNewModuleName(e.target.value)}
                        placeholder="初始模块名（可选，例如：基本信息）"
                        className="bg-background focus-visible:ring-warning/30"
                        disabled={!canManage}
                      />
                    </div>
                    <Button 
                      onClick={createPage} 
                      disabled={!canManage || pending}
                      className="bg-warning text-warning-foreground hover:bg-warning/90 border-none shadow-sm shrink-0"
                    >
                      创建并继续
                    </Button>
                  </div>
                </div>
              }
            />

            <div className="flex-1 overflow-auto rounded-md border">
              <Table
                columns={columns}
                data={diff.items}
                rowKey={(r: any) => r.key}
                emptyText="暂无差异项。"
              />
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
