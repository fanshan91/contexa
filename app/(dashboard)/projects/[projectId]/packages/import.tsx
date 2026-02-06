'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Table } from '@/components/ui/table';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { parseLanguagePack } from '@/lib/packages/language-pack-parser';
import { cn } from '@/lib/utils';
import { importLanguagePackAction, listPackagesEntriesQuery, type PackagesEntry } from './actions';
import type { ImportBindPlanDraft, ImportPreview } from './types';
import { PreviewTable } from './shared';
import { useContextNodes, useSearchPagination } from './hooks';

export function ImportTabContent({
  active,
  selectedLocale,
  sourceLocale,
  entries,
  canManage,
  projectId,
  onEntriesUpdated,
  onImportSuccess
}: {
  active: boolean;
  selectedLocale: string;
  sourceLocale: string;
  entries: PackagesEntry[];
  canManage: boolean;
  projectId: number;
  onEntriesUpdated: (items: PackagesEntry[]) => void;
  onImportSuccess: (contextLink: string | null) => void;
}) {
  const { push } = useToast();
  const isSource = selectedLocale === sourceLocale;
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importStage, setImportStage] = useState<'idle' | 'parsed' | 'confirmed'>('idle');
  const [importError, setImportError] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importFileSize, setImportFileSize] = useState<number | null>(null);
  const [importRawJson, setImportRawJson] = useState('');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importMap, setImportMap] = useState<Record<string, string> | null>(null);
  const [previewTab, setPreviewTab] = useState<'added' | 'updated' | 'ignored'>('added');

  const { loaded: contextLoaded, busy: contextBusy, error: contextError, pages: contextPages, load: loadContextNodes } =
    useContextNodes(projectId);

  const sortedEntries = useMemo(() => {
    const list = [...entries];
    list.sort((a, b) => a.key.localeCompare(b.key));
    return list;
  }, [entries]);

  const hasActionableChanges = importPreview ? importPreview.summary.added + importPreview.summary.updated > 0 : false;
  const [dragActive, setDragActive] = useState(false);
  const [bindMode, setBindMode] = useState<'off' | 'single' | 'per_key'>('off');
  const [bindScope, setBindScope] = useState<'new_only' | 'all'>('new_only');

  const [singlePageMode, setSinglePageMode] = useState<'existing' | 'create'>('existing');
  const [singlePageId, setSinglePageId] = useState('');
  const [singleCreatePageRoute, setSingleCreatePageRoute] = useState('');
  const [singleCreatePageTitle, setSingleCreatePageTitle] = useState('');
  const [singleModuleMode, setSingleModuleMode] = useState<'none' | 'existing' | 'create'>('none');
  const [singleModuleId, setSingleModuleId] = useState('');
  const [singleCreateModuleName, setSingleCreateModuleName] = useState('');

  const [perKeyQuery, setPerKeyQuery] = useState('');
  const [perKeySelected, setPerKeySelected] = useState<string[]>([]);
  const [perKeyAssign, setPerKeyAssign] = useState<Record<string, { pageId: string; moduleId?: string }>>({});
  const [perKeyBulkPageId, setPerKeyBulkPageId] = useState('');
  const [perKeyBulkModuleId, setPerKeyBulkModuleId] = useState('');

  useEffect(() => {
    if (importPreview?.kind === 'target') setBindScope('all');
  }, [importPreview?.kind]);

  useEffect(() => {
    if (!active) return;
    void loadContextNodes();
    requestAnimationFrame(() => importFileRef.current?.focus());
  }, [active, loadContextNodes]);

  const effectiveScope = importPreview?.kind === 'target' ? 'all' : bindScope;

  const resetImport = useCallback(() => {
    setImportBusy(false);
    setImportStage('idle');
    setImportError(null);
    setImportFileName('');
    setImportFileSize(null);
    setImportRawJson('');
    setImportPreview(null);
    setImportMap(null);
    setPreviewTab('added');
    if (importFileRef.current) importFileRef.current.value = '';
  }, []);

  const buildImportPreviewFromParsed = useCallback(
    (parsed: { shape: 'flat' | 'tree'; map: Record<string, string> }): ImportPreview => {
      const incoming = parsed.map;
      const incomingKeys = Object.keys(incoming);
      const incomingTotal = incomingKeys.length;
      const existingByKey = new Map(sortedEntries.map((e) => [e.key, e] as const));
      let existingTotal = 0;
      let existingWithPlacements = 0;

      if (selectedLocale === sourceLocale) {
        const added: ImportPreview['added'] = [];
        const updated: ImportPreview['updated'] = [];

        for (const key of incomingKeys) {
          const next = incoming[key] ?? '';
          const existing = existingByKey.get(key);
          if (!existing) {
            added.push({ key, text: next });
            continue;
          }
          existingTotal += 1;
          if (existing.placementCount > 0) existingWithPlacements += 1;
          if (existing.sourceText !== next) {
            updated.push({ key, before: existing.sourceText, after: next });
          }
        }

        return {
          kind: 'source',
          shape: parsed.shape,
          incomingKeys,
          incomingTotal,
          existingTotal,
          existingWithPlacements,
          summary: {
            added: added.length,
            updated: updated.length,
            ignored: 0
          },
          added,
          updated,
          ignored: []
        };
      }

      const ignored: ImportPreview['ignored'] = [];
      const updated: ImportPreview['updated'] = [];

      for (const key of incomingKeys) {
        const existing = existingByKey.get(key);
        if (!existing) {
          ignored.push({ key });
          continue;
        }
        existingTotal += 1;
        if (existing.placementCount > 0) existingWithPlacements += 1;
        const next = incoming[key] ?? '';
        const before = existing.translations[selectedLocale]?.text ?? '';
        if (next === before) continue;
        if (!next.trim()) continue;
        updated.push({ key, before, after: next });
      }

      return {
        kind: 'target',
        shape: parsed.shape,
        incomingKeys,
        incomingTotal,
        existingTotal,
        existingWithPlacements,
        summary: {
          added: 0,
          updated: updated.length,
          ignored: ignored.length
        },
        added: [],
        updated,
        ignored
      };
    },
    [selectedLocale, sortedEntries, sourceLocale]
  );

  const handlePickImportFile = useCallback(
    async (file: File) => {
      setImportError(null);
      setImportBusy(true);
      setImportStage('idle');
      setImportPreview(null);
      setImportMap(null);
      setPreviewTab(selectedLocale === sourceLocale ? 'added' : 'updated');
      setImportFileName(file.name);
      setImportFileSize(file.size);
      try {
        const text = await file.text();
        setImportRawJson(text);
        const parsed = parseLanguagePack(text);
        if (!parsed.ok) {
          setImportError(parsed.error);
          setImportStage('idle');
          return;
        }
        setImportMap(parsed.data.map);
        const preview = buildImportPreviewFromParsed({ shape: parsed.data.shape, map: parsed.data.map });
        setPreviewTab(() => {
          if (preview.kind === 'source') return 'added';
          if (preview.summary.updated > 0) return 'updated';
          if (preview.summary.ignored > 0) return 'ignored';
          return 'updated';
        });
        setImportPreview(preview);
        setImportStage('parsed');
      } catch {
        setImportError('读取文件失败，请重试。');
      } finally {
        setImportBusy(false);
      }
    },
    [buildImportPreviewFromParsed, selectedLocale, sourceLocale]
  );

  const handleConfirmImport = useCallback(
    async (bindPlan: ImportBindPlanDraft | null) => {
      if (!importRawJson.trim()) return;
      if (!importPreview) return;
      if (importPreview.summary.added + importPreview.summary.updated === 0) return;
      setImportError(null);
      setImportBusy(true);
      try {
        const normalizedBindPlan =
          !bindPlan
            ? undefined
            : bindPlan.mode === 'single'
              ? {
                  mode: 'single' as const,
                  scope: bindPlan.scope,
                  target: {
                    pageId:
                      bindPlan.pageMode === 'existing' && bindPlan.pageId ? Number(bindPlan.pageId) : undefined,
                    moduleId:
                      bindPlan.moduleMode === 'existing' && bindPlan.moduleId ? Number(bindPlan.moduleId) : undefined
                  },
                  createContext: {
                    page:
                      bindPlan.pageMode === 'create' && bindPlan.createPageRoute?.trim()
                        ? {
                            route: bindPlan.createPageRoute.trim(),
                            title: bindPlan.createPageTitle?.trim() ? bindPlan.createPageTitle.trim() : undefined
                          }
                        : undefined,
                    module:
                      bindPlan.moduleMode === 'create' && bindPlan.createModuleName?.trim()
                        ? { name: bindPlan.createModuleName.trim() }
                        : undefined
                  }
                }
              : {
                  mode: 'per_key' as const,
                  scope: bindPlan.scope,
                  items: bindPlan.items
                    .map((it) => ({
                      key: it.key,
                      pageId: Number(it.pageId),
                      moduleId: it.moduleId ? Number(it.moduleId) : undefined
                    }))
                    .filter((it) => Number.isFinite(it.pageId))
                };

        const res = await importLanguagePackAction({
          projectId,
          locale: selectedLocale,
          rawJson: importRawJson,
          bindPlan: normalizedBindPlan
        });
        if (!res.ok) {
          setImportError(res.error);
          return;
        }

        const refreshed = await listPackagesEntriesQuery(projectId);
        if (refreshed.ok) onEntriesUpdated(refreshed.data.items);

        if (res.data.bind) {
          await loadContextNodes(true);
        }

        setImportStage('confirmed');

        const nextContextLink =
          res.data.bind && res.data.bind.targetsCount === 1 && typeof res.data.bind.pageId === 'number'
            ? (() => {
                const qs = new URLSearchParams({ pageId: String(res.data.bind.pageId) });
                if (typeof res.data.bind.moduleId === 'number') {
                  qs.set('moduleId', String(res.data.bind.moduleId));
                }
                return `/projects/${projectId}/context?${qs.toString()}`;
              })()
            : null;

        const bindHint = res.data.bind ? ` · 已设置归属 ${res.data.bind.boundCount} 条` : '';
        push({
          variant: 'default',
          title: '导入成功',
          message:
            res.data.kind === 'source'
              ? `新增 ${res.data.summary.added} · 更新 ${res.data.summary.updated} · 标记待更新 ${res.data.summary.markedNeedsUpdate}`
              : `更新 ${res.data.summary.updated} · 忽略 ${res.data.summary.ignored} · 跳过空值 ${res.data.summary.skippedEmpty}` +
                bindHint
        });

        onImportSuccess(nextContextLink);
      } catch {
        setImportError('导入过程中发生异常，请重试。');
      } finally {
        setImportBusy(false);
      }
    },
    [
      importPreview,
      importRawJson,
      loadContextNodes,
      onEntriesUpdated,
      onImportSuccess,
      projectId,
      push,
      selectedLocale
    ]
  );

  const pageOptions = useMemo(
    () =>
      contextPages.map((p) => ({
        value: String(p.id),
        label: p.title ? `${p.title} · ${p.route}` : p.route
      })),
    [contextPages]
  );

  const getModuleOptionsByPageId = (pageId: string) => {
    const id = Number(pageId);
    if (!Number.isFinite(id)) return [];
    const page = contextPages.find((p) => p.id === id);
    if (!page) return [];
    return page.modules.map((m) => ({ value: String(m.id), label: m.name }));
  };

  const perKeyCandidates = useMemo(() => {
    if (!importPreview) return [];
    if (effectiveScope === 'new_only') {
      if (importPreview.kind !== 'source') return [];
      return importPreview.added.map((a) => ({ key: a.key, text: a.text }));
    }
    return importPreview.incomingKeys.map((k) => ({ key: k, text: importMap?.[k] ?? '' }));
  }, [effectiveScope, importMap, importPreview]);

  const perKeyPagination = useSearchPagination({
    items: perKeyCandidates,
    query: perKeyQuery,
    pageSize: 20,
    predicate: (it, q) => it.key.toLowerCase().includes(q) || it.text.toLowerCase().includes(q)
  });

  const perKeyAssignedCount = useMemo(() => {
    let count = 0;
    for (const k of perKeyCandidates.map((it) => it.key)) {
      if (perKeyAssign[k]?.pageId) count += 1;
    }
    return count;
  }, [perKeyAssign, perKeyCandidates]);

  const bindPlan = useMemo((): ImportBindPlanDraft | null => {
    if (bindMode === 'off') return null;
    if (bindMode === 'single') {
      return {
        mode: 'single',
        scope: effectiveScope,
        pageMode: singlePageMode,
        pageId: singlePageMode === 'existing' ? singlePageId : undefined,
        createPageRoute: singlePageMode === 'create' ? singleCreatePageRoute : undefined,
        createPageTitle: singlePageMode === 'create' ? singleCreatePageTitle : undefined,
        moduleMode: singleModuleMode,
        moduleId: singleModuleMode === 'existing' ? singleModuleId : undefined,
        createModuleName: singleModuleMode === 'create' ? singleCreateModuleName : undefined
      };
    }

    const items = Object.entries(perKeyAssign)
      .filter(([, v]) => v.pageId)
      .map(([key, v]) => ({ key, pageId: v.pageId, moduleId: v.moduleId }));

    return { mode: 'per_key', scope: effectiveScope, items };
  }, [
    bindMode,
    effectiveScope,
    perKeyAssign,
    singleCreateModuleName,
    singleCreatePageRoute,
    singleCreatePageTitle,
    singleModuleId,
    singleModuleMode,
    singlePageId,
    singlePageMode
  ]);

  const bindValidationError = useMemo(() => {
    if (bindMode === 'off') return null;
    if (!importPreview) return null;
    if (!contextLoaded && contextBusy) return '正在加载页面/模块，请稍后…';

    if (effectiveScope === 'new_only' && importPreview.kind === 'source' && importPreview.summary.added === 0) {
      return '本次导入没有新增词条，无需设置“新增词条归属”。如需补充已存在词条的归属，请切换为“包含已存在词条”。';
    }

    if (bindMode === 'single') {
      if (singlePageMode === 'existing') {
        if (!contextLoaded) return '页面/模块尚未加载，请稍后或重试。';
        if (!singlePageId) return '请选择页面。';
      } else {
        if (!singleCreatePageRoute.trim()) return '请输入新建页面路由/标识。';
      }

      if (singleModuleMode === 'existing' && !singleModuleId) return '请选择模块。';
      if (singleModuleMode === 'create' && !singleCreateModuleName.trim()) return '请输入新建模块名称。';
    }

    return null;
  }, [
    bindMode,
    contextBusy,
    contextLoaded,
    effectiveScope,
    importPreview,
    singleCreateModuleName,
    singleCreatePageRoute,
    singleModuleId,
    singleModuleMode,
    singlePageId,
    singlePageMode
  ]);

  const canConfirmImport =
    canManage &&
    importStage === 'parsed' &&
    hasActionableChanges &&
    !importBusy &&
    !bindValidationError;

  const showBindPlanInUpdated =
    importPreview?.kind === 'target' || (importPreview?.kind === 'source' && importPreview.summary.added === 0);

  const bindPlanPanel = importPreview ? (
    <div className="rounded-md border bg-background p-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold text-foreground">页面归属（可选）</div>
        <div className="text-sm text-muted-foreground">把本次导入的词条关联到页面/模块，方便后续按页面维护。</div>
      </div>

      <div className="mt-4 space-y-4">
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>归属方式</Label>
            <Select
              value={bindMode}
              onValueChange={(v) => setBindMode(v as typeof bindMode)}
              placeholder="选择归属方式"
              options={[
                { value: 'off', label: '不设置归属' },
                { value: 'single', label: '统一归属到同一页面/模块' },
                { value: 'per_key', label: '为不同词条分配归属' }
              ]}
              className="h-10 w-full justify-between"
            />
          </div>
          <div className="space-y-2">
            <Label>适用范围</Label>
            <Select
              value={effectiveScope}
              onValueChange={(v) => setBindScope(v as typeof bindScope)}
              placeholder="选择适用范围"
              options={[
                { value: 'new_only', label: '仅本次新增词条（推荐）' },
                { value: 'all', label: '包含已存在词条（可选）' }
              ]}
              disabled={importPreview?.kind === 'target'}
              className="h-10 w-full justify-between"
            />
            {importPreview?.kind === 'target' ? (
              <div className="text-xs text-muted-foreground">目标语言导入不会新增词条，如需归属，等同于“包含已存在词条”。</div>
            ) : null}
          </div>
          <div className="rounded-md border bg-card p-3 text-xs text-muted-foreground">
            默认只为新增词条设置归属；未分配的词条也可稍后在页面/模块里再关联。
          </div>
        </div>

        {bindMode !== 'off' ? (
          <div className="space-y-3">
            {contextError ? (
              <div className="rounded-md border border-destructive/30 bg-background px-3 py-2 text-sm text-destructive">
                {contextError}
              </div>
            ) : null}

            {(() => {
              if (!contextLoaded && contextBusy) {
                return (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    加载页面/模块…
                  </div>
                );
              }

              if (!contextLoaded) {
                return (
                  <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
                    页面/模块信息尚未加载完成，稍后会自动展示归属选项。
                  </div>
                );
              }

              if (bindMode === 'single') {
                return (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>页面来源</Label>
                        <Select
                          value={singlePageMode}
                          onValueChange={(v) => {
                            setSinglePageMode(v as typeof singlePageMode);
                            setSinglePageId('');
                            setSingleCreatePageRoute('');
                            setSingleCreatePageTitle('');
                            setSingleModuleId('');
                            setSingleCreateModuleName('');
                          }}
                          placeholder="选择页面来源"
                          options={[
                            { value: 'existing', label: '选择已有页面' },
                            { value: 'create', label: '导入时新建页面' }
                          ]}
                          className="h-10 w-full justify-between"
                        />
                      </div>
                      {singlePageMode === 'existing' ? (
                        <div className="space-y-2">
                          <Label>页面</Label>
                          <Select
                            value={singlePageId}
                            onValueChange={(v) => {
                              setSinglePageId(v);
                              setSingleModuleId('');
                            }}
                            placeholder={contextPages.length ? '选择页面' : '暂无页面'}
                            options={pageOptions}
                            disabled={contextPages.length === 0}
                            className="h-10 w-full justify-between"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label>新建页面路由/标识</Label>
                          <Input
                            value={singleCreatePageRoute}
                            onChange={(e) => setSingleCreatePageRoute(e.target.value)}
                            placeholder="例如 /order 或 order"
                          />
                        </div>
                      )}
                    </div>

                    {singlePageMode === 'create' ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>页面标题（可选）</Label>
                          <Input
                            value={singleCreatePageTitle}
                            onChange={(e) => setSingleCreatePageTitle(e.target.value)}
                            placeholder="例如 订单页"
                          />
                        </div>
                        <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">
                          页面会在“确认导入”时创建；若路由重复将提示冲突。
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>模块（可选）</Label>
                        <Select
                          value={singleModuleMode}
                          onValueChange={(v) => {
                            setSingleModuleMode(v as typeof singleModuleMode);
                            setSingleModuleId('');
                            setSingleCreateModuleName('');
                          }}
                          placeholder="选择模块设置"
                          options={[
                            { value: 'none', label: '不设置模块（仅归属到页面）' },
                            { value: 'existing', label: '选择已有模块' },
                            { value: 'create', label: '导入时新建模块' }
                          ]}
                          className="h-10 w-full justify-between"
                        />
                      </div>

                      {singleModuleMode === 'existing' ? (
                        <div className="space-y-2">
                          <Label>模块</Label>
                          <Select
                            value={singleModuleId}
                            onValueChange={setSingleModuleId}
                            placeholder={singlePageId ? '选择模块' : singlePageMode === 'create' ? '新建页面后再选择模块' : '先选择页面'}
                            options={getModuleOptionsByPageId(singlePageId)}
                            disabled={!singlePageId || getModuleOptionsByPageId(singlePageId).length === 0}
                            className="h-10 w-full justify-between"
                          />
                        </div>
                      ) : singleModuleMode === 'create' ? (
                        <div className="space-y-2">
                          <Label>新建模块名称</Label>
                          <Input
                            value={singleCreateModuleName}
                            onChange={(e) => setSingleCreateModuleName(e.target.value)}
                            placeholder="例如 Header / Main / Footer"
                          />
                        </div>
                      ) : (
                        <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">
                          不设置模块时，会将词条归属到所选页面。
                        </div>
                      )}
                    </div>

                    {contextPages.length === 0 && singlePageMode === 'existing' ? (
                      <div className="rounded-md border bg-card p-3 text-sm text-muted-foreground">
                        项目尚未建立页面/模块结构；可切换为“导入时新建页面”，或先创建页面/模块后再回来导入。
                        <div className="mt-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/projects/${projectId}/context`}>前往页面/模块管理</Link>
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {effectiveScope === 'new_only' && importPreview?.kind === 'source' && importPreview.summary.added === 0 ? (
                    <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
                      本次导入没有新增词条；如需补充已存在词条的归属，请切换为“包含已存在词条”。
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="grid w-full gap-3 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label>批量页面</Label>
                        <Select
                          value={perKeyBulkPageId}
                          onValueChange={(v) => {
                            setPerKeyBulkPageId(v);
                            setPerKeyBulkModuleId('');
                          }}
                          placeholder="选择页面"
                          options={pageOptions}
                          className="h-10 w-full justify-between"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>批量模块（可选）</Label>
                        <Select
                          value={perKeyBulkModuleId || undefined}
                          onValueChange={(v) => setPerKeyBulkModuleId(v)}
                          placeholder="不选择模块"
                          options={getModuleOptionsByPageId(perKeyBulkPageId)}
                          disabled={!perKeyBulkPageId || getModuleOptionsByPageId(perKeyBulkPageId).length === 0}
                          className="h-10 w-full justify-between"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>搜索</Label>
                        <Input value={perKeyQuery} onChange={(e) => setPerKeyQuery(e.target.value)} placeholder="搜索 key / 文案" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 lg:justify-end">
                      <div className="text-sm text-muted-foreground">
                        已分配 {perKeyAssignedCount} / {perKeyCandidates.length}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!perKeyBulkPageId || perKeySelected.length === 0}
                        onClick={() => {
                          setPerKeyAssign((prev) => {
                            const next = { ...prev };
                            for (const key of perKeySelected) {
                              next[key] = {
                                pageId: perKeyBulkPageId,
                                moduleId: perKeyBulkModuleId || undefined
                              };
                            }
                            return next;
                          });
                        }}
                      >
                        应用到已选（{perKeySelected.length}）
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-md border">
                    <Table
                      columns={[
                        {
                          key: 'select',
                          title: (
                            <Checkbox
                              checked={
                                perKeyPagination.pageItems.length > 0 &&
                                perKeyPagination.pageItems.every((it) => perKeySelected.includes(it.key))
                              }
                              onCheckedChange={(checked) => {
                                const keys = perKeyPagination.pageItems.map((it) => it.key);
                                setPerKeySelected((prev) => {
                                  const set = new Set(prev);
                                  if (checked) keys.forEach((k) => set.add(k));
                                  else keys.forEach((k) => set.delete(k));
                                  return Array.from(set);
                                });
                              }}
                            />
                          ),
                          headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
                          cellClassName: 'px-3 py-2 align-top',
                          render: (_value: unknown, record: any) => (
                            <Checkbox
                              checked={perKeySelected.includes(record.key)}
                              onCheckedChange={(checked) => {
                                setPerKeySelected((prev) => {
                                  const set = new Set(prev);
                                  if (checked) set.add(record.key);
                                  else set.delete(record.key);
                                  return Array.from(set);
                                });
                              }}
                            />
                          )
                        },
                        {
                          key: 'key',
                          title: '词条标识',
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
                          title: isSource ? '原文' : '翻译内容',
                          headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
                          cellClassName: 'px-3 py-2 align-top text-foreground',
                          render: (_value: unknown, record: any) => (
                            <div className="max-w-[420px] break-words">{record.text || '—'}</div>
                          )
                        },
                        {
                          key: 'page',
                          title: '页面',
                          headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
                          cellClassName: 'px-3 py-2 align-top',
                          render: (_value: unknown, record: any) => (
                            <Select
                              value={perKeyAssign[record.key]?.pageId || undefined}
                              onValueChange={(v) => {
                                setPerKeyAssign((prev) => ({
                                  ...prev,
                                  [record.key]: { pageId: v }
                                }));
                              }}
                              placeholder="选择页面"
                              options={pageOptions}
                              className="h-9 w-[260px] justify-between"
                            />
                          )
                        },
                        {
                          key: 'module',
                          title: '模块（可选）',
                          headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
                          cellClassName: 'px-3 py-2 align-top',
                          render: (_value: unknown, record: any) => {
                            const pageId = perKeyAssign[record.key]?.pageId || '';
                            const options = getModuleOptionsByPageId(pageId);
                            return (
                              <div className="flex items-center gap-2">
                                <Select
                                  value={perKeyAssign[record.key]?.moduleId || undefined}
                                  onValueChange={(v) => {
                                    setPerKeyAssign((prev) => ({
                                      ...prev,
                                      [record.key]: { ...prev[record.key], moduleId: v }
                                    }));
                                  }}
                                  placeholder="不选择模块"
                                  options={options}
                                  disabled={!pageId || options.length === 0}
                                  className="h-9 w-[220px] justify-between"
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2"
                                  disabled={!perKeyAssign[record.key]?.moduleId}
                                  onClick={() => {
                                    setPerKeyAssign((prev) => ({
                                      ...prev,
                                      [record.key]: { ...prev[record.key], moduleId: undefined }
                                    }));
                                  }}
                                >
                                  清除
                                </Button>
                              </div>
                            );
                          }
                        }
                      ]}
                      data={perKeyPagination.pageItems as any[]}
                      rowKey="key"
                      emptyText={effectiveScope === 'new_only' ? '本次没有可分配归属的新增词条' : '暂无可分配项'}
                    />
                  </div>
                  <Pagination
                    page={perKeyPagination.page}
                    pageCount={perKeyPagination.pageCount}
                    total={perKeyPagination.filteredTotal}
                    onChange={perKeyPagination.setPage}
                  />
                </div>
              );
            })()}

            {bindValidationError ? (
              <div className="rounded-md border border-destructive/30 bg-background px-3 py-2 text-sm text-destructive">
                {bindValidationError}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      <div
        className={cn('rounded-lg border bg-card p-4 transition-colors', dragActive ? 'border-primary/40 bg-primary/5' : '')}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (importBusy) return;
          setDragActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (importBusy) return;
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(false);
          if (importBusy) return;
          const file = e.dataTransfer.files?.[0];
          if (file) void handlePickImportFile(file);
        }}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-foreground">导入语言包（JSON）</div>
            <div className="text-sm text-muted-foreground">
              当前语言：{selectedLocale}{' '}
              <Badge variant={isSource ? 'secondary' : 'outline'}>{isSource ? '默认语言' : '翻译语言'}</Badge>
            </div>
            {isSource ? (
              <div className="text-sm text-muted-foreground">会新增新词条并更新已有原文；不会删除未出现在文件里的词条。</div>
            ) : (
              <div className="text-sm text-muted-foreground">
                只更新已存在词条的翻译内容；不会新增词条；空白值会跳过，不会清空已有翻译。
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" disabled={importBusy} onClick={() => importFileRef.current?.click()}>
              <Upload />
              选择文件
            </Button>
            <Button type="button" variant="outline" disabled={importBusy || importStage === 'idle'} onClick={resetImport}>
              重新选择
            </Button>
            <input
              ref={importFileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handlePickImportFile(file);
              }}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>文件：{importFileName || '未选择'}</span>
          {importFileSize !== null ? <span>大小：{Math.ceil(importFileSize / 1024)} KB</span> : null}
          <span className="text-xs">也可以将 JSON 文件拖拽到此卡片</span>
          {importPreview ? (
            <span>
              解析：{importPreview.shape === 'tree' ? '树形' : '扁平'} · 新增 {importPreview.summary.added} · 修改{' '}
              {importPreview.summary.updated}
              {importPreview.kind === 'target' && importPreview.summary.ignored > 0 ? (
                <> · 忽略 {importPreview.summary.ignored}</>
              ) : null}
            </span>
          ) : null}
        </div>

        {importError ? (
          <div className="mt-3 rounded-md border border-destructive/30 bg-background px-3 py-2 text-sm text-destructive">
            {importError}
          </div>
        ) : null}
      </div>

      {importPreview ? (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">变更预览</div>
              <div className="mt-1 text-sm text-muted-foreground">先预览，再确认导入；返回/重新选择不会产生数据变更。</div>
            </div>
            <Button type="button" disabled={!canConfirmImport} onClick={() => void handleConfirmImport(bindPlan)}>
              {importBusy ? <Loader2 className="animate-spin" /> : null}
              确认导入
            </Button>
          </div>

          <div className="mt-4">
            {(() => {
              const items =
                importPreview.kind === 'source'
                  ? ([
                      {
                        value: 'added',
                        label: (
                          <span className="flex items-center gap-2">
                            新增 <Badge variant="secondary">{importPreview.summary.added}</Badge>
                          </span>
                        ),
                        disabled: importPreview.summary.added === 0,
                        content: (
                          <div className="space-y-4">
                            {bindPlanPanel}
                            <PreviewTable kind="added" items={importPreview.added} emptyText="无新增项" />
                          </div>
                        )
                      },
                      {
                        value: 'updated',
                        label: (
                          <span className="flex items-center gap-2">
                            修改 <Badge variant="secondary">{importPreview.summary.updated}</Badge>
                          </span>
                        ),
                        disabled: importPreview.summary.updated === 0,
                        content: showBindPlanInUpdated ? (
                          <div className="space-y-4">
                            {bindPlanPanel}
                            <PreviewTable kind="updated" items={importPreview.updated} emptyText="无修改项" />
                          </div>
                        ) : (
                          <PreviewTable kind="updated" items={importPreview.updated} emptyText="无修改项" />
                        )
                      }
                    ] as const)
                  : ([
                      {
                        value: 'updated',
                        label: (
                          <span className="flex items-center gap-2">
                            修改 <Badge variant="secondary">{importPreview.summary.updated}</Badge>
                          </span>
                        ),
                        disabled: importPreview.summary.updated === 0,
                        content: (
                          <div className="space-y-4">
                            {bindPlanPanel}
                            <PreviewTable kind="updated" items={importPreview.updated} emptyText="无修改项" />
                          </div>
                        )
                      },
                      ...(importPreview.summary.ignored > 0
                        ? ([
                            {
                              value: 'ignored',
                              label: (
                                <span className="flex items-center gap-2">
                                  忽略 <Badge variant="secondary">{importPreview.summary.ignored}</Badge>
                                </span>
                              ),
                              disabled: importPreview.summary.ignored === 0,
                              content: <PreviewTable kind="ignored" items={importPreview.ignored} emptyText="无忽略项" />
                            }
                          ] as const)
                        : [])
                    ] as const);

              const safeTab = items.some((i) => i.value === previewTab) ? previewTab : items[0].value;

              return <Tabs value={safeTab} onValueChange={(v) => setPreviewTab(v as typeof safeTab)} items={items as any} />;
            })()}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          选择 JSON 文件后，将在此处展示变更预览（新增/修改；目标语言可能出现忽略项）。
        </div>
      )}
    </div>
  );
}
