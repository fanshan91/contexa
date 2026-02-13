'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ContextNodePicker } from '../context/context-node-picker';
import type { ContextPage, SelectedNode } from '../context/context-model';
import type { ContextPageNode } from './actions';

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

function getAttentionLabel(reason: string) {
  switch (reason) {
    case 'missing_page':
      return '缺失页面';
    case 'unregistered':
      return '未收录';
    case 'unbound':
      return '未绑定';
    case 'text_changed':
      return '文案变更';
    default:
      return null;
  }
}

export type RuntimeSyncEventDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  event: {
    route: string;
    key: string;
    sourceText: string;
    entrySourceText: string | null;
    attentionReason: string;
    pageId: number | null;
    moduleId: number | null;
  } | null;
  contextPages: ContextPageNode[];
  canManage: boolean;
  onSaveDraft: (op: {
    route: string;
    key: string;
    action: 'ignore' | 'bind' | 'delete';
    targetPageId: number | null;
    targetModuleId: number | null;
  }) => Promise<any>;
  onCreatePage: (input: { projectId: number; route: string; title?: string; moduleName?: string }) => Promise<any>;
  onCreateModule: (input: { projectId: number; pageId: number; name: string }) => Promise<any>;
};

export function RuntimeSyncEventDrawer({
  open,
  onOpenChange,
  projectId,
  event,
  contextPages,
  canManage,
  onSaveDraft,
  onCreatePage,
  onCreateModule
}: RuntimeSyncEventDrawerProps) {
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newModuleName, setNewModuleName] = useState('');
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !event) return;
    if (event.moduleId && event.pageId) {
      setSelected({ type: 'module', pageId: event.pageId, moduleId: event.moduleId });
    } else if (event.pageId) {
      setSelected({ type: 'page', pageId: event.pageId });
    } else {
      setSelected(null);
    }
    setNewPageTitle('');
    setNewModuleName('');
  }, [open, event]);

  const pages = useMemo(() => toContextPages(projectId, contextPages), [projectId, contextPages]);
  const hasMatchingPage = useMemo(() => contextPages.some((p) => p.route === event?.route), [contextPages, event?.route]);
  const attentionLabel = useMemo(() => getAttentionLabel(event?.attentionReason ?? ''), [event?.attentionReason]);

  const selectedPageId = selected?.pageId ?? null;
  const save = () => {
    if (!event) return;
    startTransition(async () => {
      await onSaveDraft({
        route: event.route,
        key: event.key,
        action: selected ? 'bind' : 'ignore',
        targetPageId: selected?.pageId ?? null,
        targetModuleId: selected?.type === 'module' ? selected.moduleId : null
      });
    });
  };

  const createPage = () => {
    if (!event) return;
    startTransition(async () => {
      const res = await onCreatePage({
        projectId,
        route: event.route,
        title: newPageTitle.trim() || undefined,
        moduleName: newModuleName.trim() || undefined
      });
      if (res?.ok && res?.data?.pageId) {
        const createdPageId = Number(res.data.pageId);
        const createdModuleId = res?.data?.moduleId ? Number(res.data.moduleId) : null;
        if (createdModuleId) setSelected({ type: 'module', pageId: createdPageId, moduleId: createdModuleId });
        else setSelected({ type: 'page', pageId: createdPageId });
        setNewPageTitle('');
        setNewModuleName('');
      }
    });
  };

  const createModule = () => {
    if (!selectedPageId) return;
    const name = newModuleName.trim();
    if (!name) return;
    startTransition(async () => {
      const res = await onCreateModule({ projectId, pageId: selectedPageId, name });
      if (res?.ok && res?.data?.moduleId) {
        setSelected({ type: 'module', pageId: selectedPageId, moduleId: Number(res.data.moduleId) });
        setNewModuleName('');
      }
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="单条词条关联"
      contentClassName="max-w-[600px]"
      footer={
        <div className="flex items-center justify-end gap-2 py-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={save} disabled={!canManage || pending}>
            保存草稿
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-4">
        <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">路由</span>
            <code className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground">
              {event?.route ?? '—'}
            </code>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Key</span>
            <code className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground">
              {event?.key ?? '—'}
            </code>
          </div>
          <div className="text-sm text-foreground space-y-1">
            <div>
              <span className="text-muted-foreground">采集文案：</span>
              <span className="break-words">{event?.sourceText ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">源文案：</span>
              <span className={cn('break-words', !event?.entrySourceText ? 'text-muted-foreground' : '')}>
                {event?.entrySourceText ?? '—'}
              </span>
            </div>
          </div>
          {attentionLabel ? <Badge variant="warning">{attentionLabel}</Badge> : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">关联到页面/模块</div>
            <Button variant="ghost" size="sm" className="h-8" disabled={!canManage} onClick={() => setSelected(null)}>
              不关联
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ContextNodePicker pages={pages} selected={selected ?? null} onSelect={setSelected} disabled={!canManage} />
          </div>
        </div>

        {selected?.type !== 'module' && selectedPageId ? (
          <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
            <div className="text-sm font-medium">可选：为已选页面新增模块</div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={newModuleName}
                onChange={(e) => setNewModuleName(e.target.value)}
                placeholder="模块名称（例如：基本信息）"
                disabled={!canManage || pending}
                className="bg-background"
              />
              <Button
                variant="outline"
                onClick={createModule}
                disabled={!canManage || pending || !newModuleName.trim()}
                className="shrink-0"
              >
                创建模块并选择
              </Button>
            </div>
          </div>
        ) : null}

        {!hasMatchingPage ? (
          <Alert
            variant="warning"
            title="当前路由未关联页面"
            description={
              <div className="space-y-3">
                <div className="text-muted-foreground">为此路由创建页面后，可更方便管理采集词条。</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input
                    value={newPageTitle}
                    onChange={(e) => setNewPageTitle(e.target.value)}
                    placeholder="页面标题（可选）"
                    disabled={!canManage || pending}
                    className="bg-background"
                  />
                  <Input
                    value={newModuleName}
                    onChange={(e) => setNewModuleName(e.target.value)}
                    placeholder="初始模块名（可选）"
                    disabled={!canManage || pending}
                    className="bg-background"
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={createPage} disabled={!canManage || pending}>
                    创建页面
                  </Button>
                </div>
              </div>
            }
          />
        ) : null}
      </div>
    </Sheet>
  );
}

