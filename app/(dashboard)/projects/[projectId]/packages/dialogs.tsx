'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog-primitives';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { Table } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { TargetLocaleSelect } from '@/components/target-locale-select';
import { useToast } from '@/components/ui/toast';
import {
  checkPackagesEntryKeyQuery,
  createPackagesEntryAction,
  listPackagesEntriesQuery,
  type PackagesContextPageNode,
  type PackagesEntry,
  type PackagesEntryPlacement
} from './actions';
import { useContextNodes } from './hooks';
import type { DownloadMode } from './types';
import { randomShortId } from './utils';

export function PlacementsDialog({
  open,
  onOpenChange,
  placementsEntry,
  placements,
  placementsError,
  placementsBusy,
  projectId
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placementsEntry: PackagesEntry | null;
  placements: PackagesEntryPlacement[];
  placementsError: string | null;
  placementsBusy: boolean;
  projectId: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg">词条归属</DialogTitle>
          <DialogDescription>
            {placementsEntry ? (
              <span className="break-all">
                Key：<span className="text-foreground">{placementsEntry.key}</span>
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        {placementsError ? (
          <div className="rounded-md border border-destructive/30 bg-background px-3 py-2 text-sm text-destructive">
            {placementsError}
          </div>
        ) : null}
        {placementsBusy ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            加载中…
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">共 {placements.length} 条</div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/projects/${projectId}/context`}>前往页面/模块管理</Link>
              </Button>
            </div>
            <div className="rounded-md border">
              <Table
                columns={[
                  {
                    key: 'page',
                    title: '页面',
                    headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
                    cellClassName: 'px-3 py-2 align-top text-foreground',
                    render: (_value, record: any) => (
                      <div className="space-y-0.5">
                        <div className="text-sm text-foreground">{record.pageTitle || '未命名页面'}</div>
                        <div className="text-xs text-muted-foreground">{record.pageRoute}</div>
                      </div>
                    )
                  },
                  {
                    key: 'module',
                    title: '模块',
                    headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
                    cellClassName: 'px-3 py-2 align-top text-foreground',
                    render: (_value, record: any) => record.moduleName || '—'
                  }
                ]}
                data={placements as any[]}
                emptyText="暂无归属"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateEntrySheet({
  open,
  onOpenChange,
  canManage,
  createError,
  createBusy,
  keyCheck,
  createKey,
  createKeyMode,
  onKeyChange,
  onKeyModeChange,
  onGenerateKey,
  createSourceText,
  onSourceTextChange,
  createTargetLocale,
  onTargetLocaleChange,
  createTargetText,
  onTargetTextChange,
  createPageId,
  onPageChange,
  createModuleId,
  onModuleChange,
  contextError,
  contextLoaded,
  contextBusy,
  contextPages,
  selectedPage,
  moduleOptions,
  targetLocales,
  onSubmit,
  projectId
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  createError: string | null;
  createBusy: boolean;
  keyCheck: 'idle' | 'checking' | 'available' | 'taken' | 'error';
  createKey: string;
  createKeyMode: 'auto' | 'manual';
  onKeyChange: (value: string) => void;
  onKeyModeChange: (mode: 'auto' | 'manual') => void;
  onGenerateKey: () => void;
  createSourceText: string;
  onSourceTextChange: (value: string) => void;
  createTargetLocale: string;
  onTargetLocaleChange: (value: string) => void;
  createTargetText: string;
  onTargetTextChange: (value: string) => void;
  createPageId: string;
  onPageChange: (value: string) => void;
  createModuleId: string;
  onModuleChange: (value: string) => void;
  contextError: string | null;
  contextLoaded: boolean;
  contextBusy: boolean;
  contextPages: PackagesContextPageNode[];
  selectedPage: PackagesContextPageNode | null;
  moduleOptions: Array<{ value: string; label: string }>;
  targetLocales: string[];
  onSubmit: () => void;
  projectId: number;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
      }}
      title={<span className="text-base">新增词条</span>}
      description={<span className="text-sm text-muted-foreground">保存前支持 key 唯一性校验与初始归属选择。</span>}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createBusy}>
            取消
          </Button>
          <Button type="button" onClick={onSubmit} disabled={!canManage || createBusy || keyCheck === 'checking' || keyCheck === 'taken'}>
            {createBusy ? <Loader2 className="animate-spin" /> : null}
            保存并入库
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {createError ? (
          <div className="rounded-md border border-destructive/30 bg-background px-3 py-2 text-sm text-destructive">
            {createError}
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Key</Label>
            <div className="flex items-center gap-2">
              {keyCheck === 'checking' ? (
                <Badge variant="outline" className="gap-1">
                  <Loader2 className="size-3 animate-spin" />
                  校验中
                </Badge>
              ) : keyCheck === 'available' ? (
                <Badge variant="outline">可用</Badge>
              ) : keyCheck === 'taken' ? (
                <Badge variant="destructive">冲突</Badge>
              ) : keyCheck === 'error' ? (
                <Badge variant="outline">校验失败</Badge>
              ) : (
                <Badge variant="outline">待校验</Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input value={createKey} onChange={(e) => onKeyChange(e.target.value)} placeholder="例如 order.title 或 ctx_a1b2c3d4" />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={createKeyMode === 'auto' ? 'default' : 'outline'}
                onClick={() => {
                  onKeyModeChange('auto');
                  onGenerateKey();
                }}
              >
                系统生成
              </Button>
              <Button
                type="button"
                size="sm"
                variant={createKeyMode === 'manual' ? 'default' : 'outline'}
                onClick={() => onKeyModeChange('manual')}
              >
                手动输入
              </Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">建议手动输入；保存前会校验项目内唯一性。</div>
        </div>

        <div className="space-y-2">
          <Label>源文案（必填）</Label>
          <Textarea value={createSourceText} onChange={(e) => onSourceTextChange(e.target.value)} placeholder="请输入源语言文案" rows={4} />
        </div>

        <div className="space-y-2">
          <Label>目标语言文案（可选）</Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="min-w-[220px]">
              <TargetLocaleSelect targetLocales={targetLocales} value={createTargetLocale} onValueChange={onTargetLocaleChange} />
            </div>
            <div className="text-xs text-muted-foreground">仅在该目标语言下写入译文，状态会标记为待核对。</div>
          </div>
          <Textarea value={createTargetText} onChange={(e) => onTargetTextChange(e.target.value)} placeholder="可选：输入该目标语言译文" rows={3} />
        </div>

        <div className="space-y-2">
          <Label>初始归属（可选）</Label>
          {contextError ? (
            <div className="rounded-md border border-destructive/30 bg-background px-3 py-2 text-sm text-destructive">
              {contextError}
            </div>
          ) : null}
          {!contextLoaded && contextBusy ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              加载页面/模块…
            </div>
          ) : contextPages.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>页面</Label>
                <Select
                  value={createPageId}
                  onValueChange={(v) => {
                    onPageChange(v);
                    onModuleChange('');
                  }}
                  placeholder="选择页面"
                  options={contextPages.map((p) => ({
                    value: String(p.id),
                    label: p.title ? `${p.title} · ${p.route}` : p.route
                  }))}
                  className="h-10 w-full justify-between"
                />
              </div>
              <div className="space-y-2">
                <Label>模块</Label>
                <Select
                  value={createModuleId}
                  onValueChange={onModuleChange}
                  placeholder={selectedPage ? '选择模块（可选）' : '先选择页面'}
                  options={moduleOptions}
                  disabled={!selectedPage}
                  className="h-10 w-full justify-between"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-md border bg-card p-3 text-sm text-muted-foreground">
              项目尚未建立页面/模块结构，暂时无法设置归属。可先创建页面/模块后再回来设置。
              <div className="mt-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/projects/${projectId}/context`}>前往页面/模块管理</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}

export function CreateEntrySheetContainer({
  open,
  onOpenChange,
  canManage,
  targetLocales,
  projectId,
  entries,
  onEntriesUpdated,
  onCreated
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  targetLocales: string[];
  projectId: number;
  entries: PackagesEntry[];
  onEntriesUpdated: (items: PackagesEntry[]) => void;
  onCreated: () => void;
}) {
  const { push } = useToast();
  const { loaded: contextLoaded, busy: contextBusy, error: contextError, pages: contextPages, load: loadContextNodes } =
    useContextNodes(projectId);

  const [createKeyMode, setCreateKeyMode] = useState<'auto' | 'manual'>('auto');
  const [createKey, setCreateKey] = useState(() => `ctx_${randomShortId()}`);
  const [createSourceText, setCreateSourceText] = useState('');
  const [createTargetLocale, setCreateTargetLocale] = useState(targetLocales[0] ?? '');
  const [createTargetText, setCreateTargetText] = useState('');
  const [createPageId, setCreatePageId] = useState('');
  const [createModuleId, setCreateModuleId] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [keyCheck, setKeyCheck] = useState<'idle' | 'checking' | 'available' | 'taken' | 'error'>('idle');
  const lastOpenRef = useRef(false);

  const resetCreateForm = useCallback(() => {
    setCreateError(null);
    setCreateKeyMode('auto');
    setCreateKey(`ctx_${randomShortId()}`);
    setCreateSourceText('');
    setCreateTargetLocale(targetLocales[0] ?? '');
    setCreateTargetText('');
    setCreatePageId('');
    setCreateModuleId('');
    setKeyCheck('idle');
  }, [targetLocales]);

  useEffect(() => {
    const wasOpen = lastOpenRef.current;
    lastOpenRef.current = open;
    if (open && !wasOpen) {
      resetCreateForm();
      void loadContextNodes();
    }
    if (!open && wasOpen) {
      setCreateError(null);
    }
  }, [loadContextNodes, open, resetCreateForm]);

  const selectedPage = useMemo(() => {
    const id = Number(createPageId);
    if (!Number.isFinite(id)) return null;
    return contextPages.find((p) => p.id === id) ?? null;
  }, [contextPages, createPageId]);

  const moduleOptions = useMemo(() => {
    if (!selectedPage) return [];
    return selectedPage.modules.map((m) => ({ value: String(m.id), label: m.name }));
  }, [selectedPage]);

  useEffect(() => {
    if (!selectedPage) {
      if (createModuleId) setCreateModuleId('');
      return;
    }
    if (!createModuleId) return;
    const id = Number(createModuleId);
    const exists = selectedPage.modules.some((m) => m.id === id);
    if (!exists) setCreateModuleId('');
  }, [createModuleId, selectedPage]);

  useEffect(() => {
    if (!open) return;
    const key = createKey.trim();
    if (!key) {
      setKeyCheck('idle');
      return;
    }
    if (entries.some((e) => e.key === key)) {
      setKeyCheck('taken');
      return;
    }
    setKeyCheck('checking');
    const handle = window.setTimeout(async () => {
      try {
        const res = await checkPackagesEntryKeyQuery({ projectId, key });
        if (!res.ok) {
          setKeyCheck('error');
          return;
        }
        setKeyCheck(res.data.available ? 'available' : 'taken');
      } catch {
        setKeyCheck('error');
      }
    }, 400);
    return () => window.clearTimeout(handle);
  }, [createKey, entries, open, projectId]);

  const handleCreateEntry = useCallback(async () => {
    if (!canManage) return;
    const key = createKey.trim();
    const sourceText = createSourceText.trim();
    if (!key) {
      setCreateError('请输入 key。');
      return;
    }
    if (!sourceText) {
      setCreateError('请输入源文案。');
      return;
    }
    if (keyCheck === 'taken') {
      setCreateError('key 已存在：请修改 key 或重新生成。');
      return;
    }
    setCreateError(null);
    setCreateBusy(true);
    try {
      const res = await createPackagesEntryAction({
        projectId,
        key,
        sourceText,
        targetLocale: createTargetLocale || undefined,
        targetText: createTargetText.trim() ? createTargetText.trim() : undefined,
        pageId: createPageId ? Number(createPageId) : undefined,
        moduleId: createModuleId ? Number(createModuleId) : undefined
      });
      if (!res.ok) {
        setCreateError(res.error);
        return;
      }

      const refreshed = await listPackagesEntriesQuery(projectId);
      if (refreshed.ok) onEntriesUpdated(refreshed.data.items);

      push({ variant: 'default', title: '新增成功', message: key });
      onOpenChange(false);
      onCreated();
    } catch {
      setCreateError('新增过程中发生异常，请重试。');
    } finally {
      setCreateBusy(false);
    }
  }, [
    canManage,
    createKey,
    createModuleId,
    createPageId,
    createSourceText,
    createTargetLocale,
    createTargetText,
    keyCheck,
    onCreated,
    onEntriesUpdated,
    onOpenChange,
    projectId,
    push
  ]);

  return (
    <CreateEntrySheet
      open={open}
      onOpenChange={onOpenChange}
      canManage={canManage}
      createError={createError}
      createBusy={createBusy}
      keyCheck={keyCheck}
      createKey={createKey}
      createKeyMode={createKeyMode}
      onKeyChange={setCreateKey}
      onKeyModeChange={setCreateKeyMode}
      onGenerateKey={() => setCreateKey(`ctx_${randomShortId()}`)}
      createSourceText={createSourceText}
      onSourceTextChange={setCreateSourceText}
      createTargetLocale={createTargetLocale}
      onTargetLocaleChange={setCreateTargetLocale}
      createTargetText={createTargetText}
      onTargetTextChange={setCreateTargetText}
      createPageId={createPageId}
      onPageChange={setCreatePageId}
      createModuleId={createModuleId}
      onModuleChange={setCreateModuleId}
      contextError={contextError}
      contextLoaded={contextLoaded}
      contextBusy={contextBusy}
      contextPages={contextPages}
      selectedPage={selectedPage}
      moduleOptions={moduleOptions}
      targetLocales={targetLocales}
      onSubmit={() => void handleCreateEntry()}
      projectId={projectId}
    />
  );
}

export function DownloadDialog({
  open,
  onOpenChange,
  downloadLocale,
  onDownloadLocaleChange,
  downloadMode,
  onDownloadModeChange,
  localeOptions,
  sourceLocale,
  onConfirm
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  downloadLocale: string;
  onDownloadLocaleChange: (value: string) => void;
  downloadMode: DownloadMode;
  onDownloadModeChange: (value: DownloadMode) => void;
  localeOptions: Array<{ code: string; label: string; kind: 'source' | 'target' }>;
  sourceLocale: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <Download />
          下载导出
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">下载语言包（JSON）</DialogTitle>
          <DialogDescription>导出结构保持项目模板一致。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="export-locale">语言</Label>
            <DropdownMenu
              trigger={
                <Button id="export-locale" type="button" variant="outline" className="h-10 justify-between">
                  <span className="truncate">{downloadLocale}</span>
                  <Badge variant={downloadLocale === sourceLocale ? 'secondary' : 'outline'}>
                    {downloadLocale === sourceLocale ? '源' : '目标'}
                  </Badge>
                </Button>
              }
              items={[
                {
                  type: 'radio-group',
                  value: downloadLocale,
                  onValueChange: onDownloadLocaleChange,
                  items: localeOptions.map((o) => ({
                    value: o.code,
                    label: (
                      <span className="flex w-full items-center justify-between gap-3">
                        <span className="text-foreground">{o.label}</span>
                        <span className="text-xs text-muted-foreground">{o.code}</span>
                      </span>
                    )
                  }))
                }
              ]}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="export-mode">导出项</Label>
            <DropdownMenu
              trigger={
                <Button id="export-mode" type="button" variant="outline" className="h-10 justify-between">
                  {downloadMode === 'filled'
                    ? '仅导出已填写'
                    : downloadMode === 'empty'
                      ? '包含待翻译：空字符串'
                      : '包含待翻译：回退源文案'}
                </Button>
              }
              items={[
                {
                  type: 'radio-group',
                  value: downloadMode,
                  onValueChange: (v) => onDownloadModeChange(v as DownloadMode),
                  items: [
                    { value: 'empty', label: '包含待翻译：空字符串' },
                    { value: 'fallback', label: '包含待翻译：回退源文案' },
                    { value: 'filled', label: '仅导出已填写（有目标文案）' }
                  ]
                }
              ]}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" onClick={onConfirm}>
            下载
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
