'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-primitives';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, type TableColumn } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { formatDateTimeShanghai } from '@/lib/datetime';
import { RUNTIME_SESSION_STALE_MS } from '@/lib/runtime/session';
import { cn } from '@/lib/utils';
import {
  applyRuntimeSessionAction,
  createRuntimeModuleAction,
  createRuntimePageAction,
  discardRuntimeSessionAction,
  getRuntimeSessionRouteDiffQuery,
  listRuntimeSessionDraftOpsQuery,
  listRuntimeContextNodesQuery,
  listRuntimeSessionEventsQuery,
  listRuntimeSessionRoutesQuery,
  listRuntimeSessionRouteStatsQuery,
  upsertRuntimeSessionDraftOpAction,
  upsertRuntimeSessionDraftOpsBatchAction,
  type ContextPageNode,
  type RuntimeCaptureSessionBootstrap,
  type RuntimeEventsPage,
  type RuntimeRouteDiff,
  type RuntimeSessionRouteStatsPage,
  type RuntimeSessionDraftOpRow,
  type RuntimeSyncBootstrap
} from '../actions';
import { RuntimeSyncDrawer } from '@/app/(dashboard)/projects/[projectId]/runtime-sync/runtime-sync-drawer';
import { RuntimeSyncEventDrawer } from '@/app/(dashboard)/projects/[projectId]/runtime-sync/runtime-sync-event-drawer';

export function ProjectRuntimeSyncEventsClient({
  projectId,
  bootstrap,
  capture
}: {
  projectId: number;
  bootstrap: RuntimeSyncBootstrap;
  capture: RuntimeCaptureSessionBootstrap;
}) {
  const ROUTE_ALL_VALUE = '__all__';
  const [onlyDiff, setOnlyDiff] = useState(true);
  const [search, setSearch] = useState('');
  const [routeFilter, setRouteFilter] = useState(ROUTE_ALL_VALUE);
  const [routeOptions, setRouteOptions] = useState<Array<{ value: string; label: string }>>([
    { value: ROUTE_ALL_VALUE, label: '全部路由' }
  ]);
  const [events, setEvents] = useState<RuntimeEventsPage>(bootstrap.events);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [viewMode, setViewMode] = useState<'events' | 'routes'>('events');

  const [routeStats, setRouteStats] = useState<RuntimeSessionRouteStatsPage>({
    page: 1,
    pageSize: 20,
    total: 0,
    items: []
  });
  const [routeStatsSearch, setRouteStatsSearch] = useState('');
  const [routeStatsLoading, setRouteStatsLoading] = useState(false);
  const [routeStatsError, setRouteStatsError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRoute, setDrawerRoute] = useState<string>('');
  const [drawerData, setDrawerData] = useState<RuntimeRouteDiff | null>(null);
  const [drawerDraftOps, setDrawerDraftOps] = useState<RuntimeSessionDraftOpRow[]>([]);
  const [contextPages, setContextPages] = useState<ContextPageNode[]>([]);

  const [eventDrawerOpen, setEventDrawerOpen] = useState(false);
  const [eventDrawerEvent, setEventDrawerEvent] = useState<{
    route: string;
    key: string;
    sourceText: string;
    entrySourceText: string | null;
    attentionReason: string;
    pageId: number | null;
    moduleId: number | null;
  } | null>(null);

  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const { push } = useToast();
  const router = useRouter();

  const canReadEnhanced = true;
  const canMutate = bootstrap.canManage && bootstrap.status !== 'expired';
  const canResolveSession = bootstrap.canManage && bootstrap.status !== 'expired';
  const viewSession = capture.session ?? bootstrap.unsavedSession?.session ?? null;
  const viewSessionId =
    viewSession && (viewSession.status === 'active' || viewSession.status === 'closing') ? viewSession.id : null;
  const hasActiveSession = viewSession?.status === 'active';
  const isApplyingSession = viewSession?.status === 'closing';
  const collectedKeysForDisplay = capture.session ? capture.collectedKeys : (bootstrap.unsavedSession?.collectedKeys ?? 0);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!hasActiveSession) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, [hasActiveSession]);

  const sessionLastSeenAtMs = viewSession?.lastSeenAt ? Date.parse(viewSession.lastSeenAt) : null;
  const sessionIdleMs = hasActiveSession && sessionLastSeenAtMs ? Math.max(0, nowMs - sessionLastSeenAtMs) : null;
  const sessionStale = hasActiveSession && (sessionLastSeenAtMs == null || sessionIdleMs == null || sessionIdleMs > RUNTIME_SESSION_STALE_MS);

  useEffect(() => {
    if (!sessionStale) return;
    setAutoRefresh(false);
  }, [sessionStale]);

  useEffect(() => {
    if (!viewSessionId) return;
    if (viewMode !== 'events') return;
    if (!onlyDiff) return;
    if (events.total <= 0) return;
    if (events.items.length > 0) return;
    push({ variant: 'default', title: '当前无差异项', message: '仅差异筛选下暂无结果，可关闭“仅差异”查看全部数据。' });
  }, [events.items.length, events.total, onlyDiff, push, viewMode, viewSessionId]);

  useEffect(() => {
    if (!hasActiveSession) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasActiveSession]);

  useEffect(() => {
    startTransition(async () => {
      if (!viewSessionId) {
        setRouteOptions([{ value: ROUTE_ALL_VALUE, label: '全部路由' }]);
        return;
      }
      const res = await listRuntimeSessionRoutesQuery({ projectId, sessionId: viewSessionId, limit: 120 });
      if (!res.ok) return;
      setRouteOptions([{ value: ROUTE_ALL_VALUE, label: '全部路由' }, ...res.data.map((r) => ({ value: r, label: r }))]);
    });
  }, [projectId, viewSessionId]);

  useEffect(() => {
    startTransition(async () => {
      const nodes = await listRuntimeContextNodesQuery(projectId);
      if (!nodes.ok) return;
      setContextPages(nodes.data.pages);
    });
  }, [projectId]);

  const refreshEvents = useCallback(
    (opts?: { page?: number; pageSize?: number }) => {
      if (!canReadEnhanced) return;
      startTransition(async () => {
        if (!viewSessionId) {
          setEvents((prev) => ({ ...prev, items: [], total: 0, lastReportedAt: null }));
          return;
        }
        const route = routeFilter === ROUTE_ALL_VALUE ? undefined : routeFilter.trim() || undefined;
        const res = await listRuntimeSessionEventsQuery({
          projectId,
          sessionId: viewSessionId,
          search: search.trim() || undefined,
          page: opts?.page ?? events.page,
          pageSize: opts?.pageSize ?? events.pageSize,
          onlyDiff,
          route
        });
        if (!res.ok) return;
        setEvents(res.data);
      });
    },
    [canReadEnhanced, events.page, events.pageSize, onlyDiff, projectId, routeFilter, search, startTransition, viewSessionId]
  );

  const refreshRouteStats = useCallback(
    (opts?: { page?: number; pageSize?: number }) => {
      startTransition(async () => {
        if (!viewSessionId) {
          setRouteStats((prev) => ({ ...prev, page: 1, total: 0, items: [] }));
          setRouteStatsLoading(false);
          setRouteStatsError(null);
          return;
        }
        setRouteStatsLoading(true);
        setRouteStatsError(null);
        const res = await listRuntimeSessionRouteStatsQuery({
          projectId,
          sessionId: viewSessionId,
          search: routeStatsSearch.trim() || undefined,
          page: opts?.page ?? routeStats.page,
          pageSize: opts?.pageSize ?? routeStats.pageSize
        });
        if (!res.ok) {
          setRouteStatsLoading(false);
          setRouteStatsError(res.error);
          push({ variant: 'destructive', title: '获取路由概览失败', message: res.error });
          return;
        }
        setRouteStats(res.data);
        setRouteStatsLoading(false);
      });
    },
    [projectId, push, routeStats.page, routeStats.pageSize, routeStatsSearch, startTransition, viewSessionId]
  );

  useEffect(() => {
    if (!viewSessionId) {
      setEvents((prev) => ({ ...prev, page: 1, total: 0, items: [], lastReportedAt: null }));
      return;
    }
    refreshEvents({ page: 1 });
  }, [refreshEvents, viewSessionId]);

  useEffect(() => {
    if (!viewSessionId) return;
    if (viewMode !== 'events') return;
    refreshEvents({ page: 1 });
  }, [onlyDiff, refreshEvents, routeFilter, viewMode, viewSessionId]);

  useEffect(() => {
    if (!viewSessionId) return;
    if (viewMode !== 'events') return;
    const timer = window.setTimeout(() => {
      refreshEvents({ page: 1 });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [refreshEvents, search, viewMode, viewSessionId]);

  useEffect(() => {
    if (!autoRefresh) return;
    if (!canReadEnhanced) return;
    if (bootstrap.status !== 'connected') return;
    if (!hasActiveSession) return;
    if (sessionStale) return;
    if (viewMode !== 'events') return;

    const id = window.setInterval(() => {
      refreshEvents();
    }, 5000);
    return () => window.clearInterval(id);
  }, [autoRefresh, bootstrap.status, canReadEnhanced, hasActiveSession, refreshEvents, sessionStale, viewMode]);

  useEffect(() => {
    if (!viewSessionId) return;
    if (viewMode !== 'routes') return;
    refreshRouteStats({ page: 1 });
  }, [refreshRouteStats, viewMode, viewSessionId]);

  const columns = useMemo((): Array<TableColumn<any>> => {
    return [
      {
        key: 'lastSeenAt',
        title: '时间',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-muted-foreground',
        render: (_: unknown, record: any) => (
          <div className="whitespace-nowrap text-xs">{formatDateTimeShanghai(record.lastSeenAt)}</div>
        )
      },
      {
        key: 'route',
        title: '页面/路由',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top',
        render: (_: unknown, record: any) => (
          <code className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground">{record.route}</code>
        )
      },
      {
        key: 'key',
        title: 'Key',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top',
        render: (_: unknown, record: any) => (
          <div className="space-y-1">
            <code className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground">{record.key}</code>
            {record.attentionReason === 'missing_page' ? (
              <div className="text-xs text-warning">缺失页面</div>
            ) : record.attentionReason === 'unregistered' ? (
              <div className="text-xs text-warning">未收录</div>
            ) : record.attentionReason === 'unbound' ? (
              <div className="text-xs text-warning">未绑定</div>
            ) : record.attentionReason === 'text_changed' ? (
              <div className="text-xs text-warning">文案变更</div>
            ) : null}
          </div>
        )
      },
      {
        key: 'sourceText',
        title: '采集文案',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-foreground',
        render: (_: unknown, record: any) => <div className="max-w-[420px] break-words">{record.sourceText}</div>
      },
      {
        key: 'entrySourceText',
        title: '源文案',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-foreground',
        render: (_: unknown, record: any) => <div className="max-w-[420px] break-words">{record.entrySourceText ?? '—'}</div>
      },
      {
        key: 'actions',
        title: '操作',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top',
        render: (_: unknown, record: any) => (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="shadow-none"
              disabled={!canReadEnhanced}
              onClick={() => {
                setEventDrawerEvent({
                  route: record.route,
                  key: record.key,
                  sourceText: record.sourceText,
                  entrySourceText: record.entrySourceText,
                  attentionReason: record.attentionReason,
                  pageId: record.pageId,
                  moduleId: record.moduleId
                });
                setEventDrawerOpen(true);
              }}
            >
              关联页面/模块
            </Button>
          </div>
        )
      }
    ];
  }, [canReadEnhanced]);

  const routeColumns = useMemo((): Array<TableColumn<any>> => {
    return [
      {
        key: 'route',
        title: '路由',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top',
        render: (_: unknown, record: any) => (
          <code className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground">{record.route}</code>
        )
      },
      {
        key: 'newKeysCount',
        title: '新 Key',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-foreground',
        render: (_: unknown, record: any) => (
          <div className={cn('text-sm', record.newKeysCount > 0 ? 'text-warning' : 'text-muted-foreground')}>
            {record.newKeysCount}
          </div>
        )
      },
      {
        key: 'textChangedCount',
        title: '文案变更',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-foreground',
        render: (_: unknown, record: any) => (
          <div className={cn('text-sm', record.textChangedCount > 0 ? 'text-warning' : 'text-muted-foreground')}>
            {record.textChangedCount}
          </div>
        )
      },
      {
        key: 'keysTotal',
        title: 'Key 数',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-muted-foreground',
        render: (_: unknown, record: any) => <div className="text-sm">{record.keysTotal}</div>
      },
      {
        key: 'lastSeenAt',
        title: '最近上报',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-muted-foreground',
        render: (_: unknown, record: any) => (
          <div className="whitespace-nowrap text-xs">{formatDateTimeShanghai(record.lastSeenAt)}</div>
        )
      },
      {
        key: 'actions',
        title: '操作',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top',
        render: (_: unknown, record: any) => (
          <Button
            variant="outline"
            size="sm"
            className="shadow-none"
            disabled={!canReadEnhanced}
            onClick={() => {
              setDrawerRoute(record.route);
              setDrawerOpen(true);
            }}
          >
            查看/处理
          </Button>
        )
      }
    ];
  }, [canReadEnhanced]);

  useEffect(() => {
    if (!drawerOpen || !drawerRoute) {
      setDrawerData(null);
      setDrawerDraftOps([]);
      return;
    }
    startTransition(async () => {
      const [diff, drafts] = await Promise.all([
        viewSessionId
          ? getRuntimeSessionRouteDiffQuery({ projectId, sessionId: viewSessionId, route: drawerRoute })
          : Promise.resolve({ ok: false as const, error: 'no_active_session' }),
        viewSessionId
          ? listRuntimeSessionDraftOpsQuery({ projectId, sessionId: viewSessionId, route: drawerRoute })
          : Promise.resolve({ ok: true as const, data: [] as RuntimeSessionDraftOpRow[] })
      ]);
      if (diff.ok) setDrawerData(diff.data);
      if (drafts.ok) setDrawerDraftOps(drafts.data);
    });
  }, [drawerOpen, drawerRoute, projectId, viewSessionId]);

  const refreshDrawer = () => {
    if (!drawerRoute) return;
    startTransition(async () => {
      const [diff, drafts] = await Promise.all([
        viewSessionId
          ? getRuntimeSessionRouteDiffQuery({ projectId, sessionId: viewSessionId, route: drawerRoute })
          : Promise.resolve({ ok: false as const, error: 'no_active_session' }),
        viewSessionId
          ? listRuntimeSessionDraftOpsQuery({ projectId, sessionId: viewSessionId, route: drawerRoute })
          : Promise.resolve({ ok: true as const, data: [] as RuntimeSessionDraftOpRow[] })
      ]);
      if (diff.ok) setDrawerData(diff.data);
      if (drafts.ok) setDrawerDraftOps(drafts.data);
    });
  };

  return (
    <>
      {!viewSessionId ? (
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">采集会话</CardTitle>
            <div className="text-sm text-muted-foreground">采集会话仅在采集中展示临时数据，保存后会写入项目并清空工作区。</div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-2">
              <div className="text-muted-foreground">尚未检测到进行中的采集会话。</div>
              <div className="text-muted-foreground">请在业务侧使用 SDK v2 打开会话后开始采集。</div>
            </div>
            {bootstrap.status !== 'connected' ? (
              <div className="text-muted-foreground">当前增强能力未接入或不可用，保存功能可能不可用。</div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base">会话信息</CardTitle>
                <div className="text-sm text-muted-foreground">
                  会话 #{viewSession?.id} · {viewSession?.sdkIdentity ?? '—'} · {viewSession?.env ?? '—'}
                </div>
                {isApplyingSession ? (
                  <div className="text-sm text-muted-foreground">当前会话正在关闭处理中（closing），刷新不会丢失数据。</div>
                ) : null}
                {sessionStale ? (
                  <div className="text-sm text-warning">
                    会话疑似已中止：已超过 {Math.ceil(RUNTIME_SESSION_STALE_MS / 1000)} 秒未收到 SDK 心跳/上报，请尽快保存或退出会话。
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ConfirmDialog
                  disabled={!canMutate || saving || discarding || bootstrap.status !== 'connected' || !hasActiveSession}
                  title="确认保存到项目？"
                  description="保存后将结束本次采集会话并清空工作区。"
                  confirmText="保存并结束"
                  confirmVariant="default"
                  trigger={
                    <Button disabled={!canMutate || saving || discarding || bootstrap.status !== 'connected' || !hasActiveSession}>
                      保存
                    </Button>
                  }
                  onConfirm={() => {
                    if (!viewSessionId || !hasActiveSession) return;
                    setSaving(true);
                    startTransition(async () => {
                      try {
                        const res = await applyRuntimeSessionAction({ projectId, sessionId: viewSessionId });
                        if (!res.ok) {
                          push({ variant: 'destructive', title: '保存失败', message: res.error });
                          return;
                        }
                        push({ variant: 'default', title: '已保存', message: `已结束会话 #${viewSessionId}` });
                        router.push(`/projects/${projectId}/runtime-sync`);
                      } finally {
                        setSaving(false);
                      }
                    });
                  }}
                />
                <ConfirmDialog
                  disabled={!canMutate || saving || discarding || !hasActiveSession}
                  title="确认退出采集会话？"
                  description="退出后将丢弃未保存的采集数据，并清空工作区。"
                  confirmText="退出会话"
                  confirmVariant="destructive"
                  trigger={
                    <Button
                      variant="outline"
                      className="shadow-none"
                      disabled={!canMutate || saving || discarding || !hasActiveSession}
                    >
                      退出会话
                    </Button>
                  }
                  onConfirm={() => {
                    if (!viewSessionId || !hasActiveSession) return;
                    setDiscarding(true);
                    startTransition(async () => {
                      try {
                        const res = await discardRuntimeSessionAction({ projectId, sessionId: viewSessionId });
                        if (!res.ok) {
                          push({ variant: 'destructive', title: '退出失败', message: res.error });
                          return;
                        }
                        push({ variant: 'default', title: '已退出会话', message: `会话 #${viewSessionId}` });
                        router.push(`/projects/${projectId}/runtime-sync`);
                      } finally {
                        setDiscarding(false);
                      }
                    });
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              已采集 Key 数：{collectedKeysForDisplay} · 最近上报：{formatDateTimeShanghai(events.lastReportedAt)} · 采集语言：
              {capture.session?.requestedLocale ?? '—'} · 项目源语言：{bootstrap.sourceLocale}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base">会话内采集数据</CardTitle>
                <div className="text-sm text-muted-foreground">默认仅展示新增与差异项（不展示未变更数据）</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className="shadow-none"
                  disabled={!canReadEnhanced}
                  onClick={() => {
                    if (viewMode === 'routes') refreshRouteStats({ page: 1 });
                    else refreshEvents({ page: 1 });
                  }}
                >
                  <RefreshCw className={cn('mr-2 h-4 w-4', pending ? 'animate-spin' : '')} />
                  刷新
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {capture.nearLimit ? (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
                  已采集 {capture.collectedKeys}/{capture.hardUniqueKeys} 个唯一 Key（按 route+key 计）。建议先保存结束会话，再继续采集新的内容。
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={viewMode === 'events' ? 'default' : 'outline'}
                  className={cn(viewMode === 'events' ? '' : 'shadow-none')}
                  onClick={() => setViewMode('events')}
                >
                  事件列表 ({events.total})
                </Button>
                <Button
                  variant={viewMode === 'routes' ? 'default' : 'outline'}
                  className={cn(viewMode === 'routes' ? '' : 'shadow-none')}
                  onClick={() => setViewMode('routes')}
                >
                  路由概览 ({routeStats.total})
                </Button>
              </div>

              {viewMode === 'routes' ? (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-1 items-center gap-2">
                      <Input
                        value={routeStatsSearch}
                        placeholder="搜索路由"
                        onChange={(e) => setRouteStatsSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') refreshRouteStats({ page: 1 });
                        }}
                        className="max-w-[420px]"
                      />
                      <Button variant="outline" className="shadow-none" onClick={() => refreshRouteStats({ page: 1 })}>
                        搜索
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      {viewSessionId ? <div>会话：#{viewSessionId}</div> : null}
                      <div>仅展示：新 Key / 文案变更统计</div>
                      {routeStatsLoading ? (
                        <div>加载中…</div>
                      ) : routeStatsError ? (
                        <div className="max-w-[360px] truncate text-destructive" title={routeStatsError}>
                          请求失败
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <Table columns={routeColumns} data={routeStats.items} rowKey={(r: any) => r.route} emptyText="暂无路由数据。" />

                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                    <div>
                      共 {routeStats.total} 条 · 当前 {routeStats.items.length} 条
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={String(routeStats.pageSize)}
                        onValueChange={(v) => {
                          const newSize = Number(v);
                          setRouteStats((prev) => ({ ...prev, page: 1, pageSize: newSize }));
                          refreshRouteStats({ page: 1, pageSize: newSize });
                        }}
                        options={[
                          { value: '20', label: '20 条/页' },
                          { value: '50', label: '50 条/页' },
                          { value: '100', label: '100 条/页' }
                        ]}
                        className="h-9 w-[120px] justify-between"
                      />
                      <Button
                        variant="outline"
                        className="shadow-none"
                        disabled={routeStats.page <= 1}
                        onClick={() => refreshRouteStats({ page: Math.max(1, routeStats.page - 1) })}
                      >
                        上一页
                      </Button>
                      <div className="text-xs">第 {routeStats.page} 页</div>
                      <Button
                        variant="outline"
                        className="shadow-none"
                        disabled={routeStats.page * routeStats.pageSize >= routeStats.total}
                        onClick={() => refreshRouteStats({ page: routeStats.page + 1 })}
                      >
                        下一页
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-1 items-center gap-2">
                      <Input
                        value={search}
                        placeholder="搜索 Key / 采集文案 / 源文案"
                        onChange={(e) => setSearch(e.target.value)}
                        className="max-w-[420px]"
                      />
                      <Button variant="outline" className="shadow-none" onClick={() => refreshEvents({ page: 1 })}>
                        搜索
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={routeFilter}
                        onValueChange={setRouteFilter}
                        className="h-9 w-[260px] justify-between"
                        options={routeOptions}
                      />
                      <Switch checked={onlyDiff} onCheckedChange={setOnlyDiff} />
                      <div className="text-sm text-muted-foreground">仅差异</div>
                      <Switch
                        checked={autoRefresh}
                        onCheckedChange={setAutoRefresh}
                        disabled={bootstrap.status !== 'connected' || !hasActiveSession || sessionStale}
                      />
                      <div className="text-sm text-muted-foreground">自动刷新</div>
                    </div>
                  </div>

                  <Table
                    columns={columns}
                    data={events.items}
                    rowKey={(r: any) => `${r.route}:${r.key}`}
                    emptyText="暂无采集数据。请在业务侧触发页面并等待 SDK 上报。"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                    <div>
                      共 {events.total} 条 · 当前 {events.items.length} 条
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={String(events.pageSize)}
                        onValueChange={(v) => {
                          const newSize = Number(v);
                          setEvents((prev) => ({ ...prev, page: 1, pageSize: newSize }));
                          refreshEvents({ page: 1, pageSize: newSize });
                        }}
                        options={[
                          { value: '20', label: '20 条/页' },
                          { value: '50', label: '50 条/页' },
                          { value: '100', label: '100 条/页' }
                        ]}
                        className="h-9 w-[120px] justify-between"
                      />
                      <Button
                        variant="outline"
                        className="shadow-none"
                        disabled={events.page <= 1}
                        onClick={() => refreshEvents({ page: Math.max(1, events.page - 1) })}
                      >
                        上一页
                      </Button>
                      <div className="text-xs">第 {events.page} 页</div>
                      <Button
                        variant="outline"
                        className="shadow-none"
                        disabled={events.page * events.pageSize >= events.total}
                        onClick={() => refreshEvents({ page: events.page + 1 })}
                      >
                        下一页
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <RuntimeSyncDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        projectId={projectId}
        route={drawerRoute}
        canManage={canMutate}
        diff={drawerData}
        draftOps={drawerDraftOps}
        mode="draft"
        contextPages={contextPages}
        onRefresh={() => {
          refreshDrawer();
        }}
        onCreatePage={async (payload: Parameters<typeof createRuntimePageAction>[0]) => {
          const res = await createRuntimePageAction(payload);
          if (res.ok) {
            await Promise.all([
              listRuntimeContextNodesQuery(projectId).then((n) => n.ok && setContextPages(n.data.pages)),
              viewSessionId
                ? getRuntimeSessionRouteDiffQuery({ projectId, sessionId: viewSessionId, route: drawerRoute }).then((d) => d.ok && setDrawerData(d.data))
                : Promise.resolve(null)
            ]);
          }
          return res;
        }}
        onCreateModule={async (payload: Parameters<typeof createRuntimeModuleAction>[0]) => {
          const res = await createRuntimeModuleAction(payload);
          if (res.ok) {
            const nodes = await listRuntimeContextNodesQuery(projectId);
            if (nodes.ok) setContextPages(nodes.data.pages);
          }
          return res;
        }}
        onApply={async (ops) => {
          if (!viewSessionId || !hasActiveSession) return { ok: false, error: 'no_active_session' };
          const res = await upsertRuntimeSessionDraftOpsBatchAction({
            projectId,
            sessionId: viewSessionId,
            route: drawerRoute,
            ops: ops.map((op) => ({
              key: op.key,
              action: op.action,
              targetPageId: op.targetPageId ?? null,
              targetModuleId: op.targetModuleId ?? null
            }))
          });
          if (!res.ok) {
            push({ variant: 'destructive', title: '保存草稿失败', message: res.error });
            return res;
          }
          push({ variant: 'default', message: '草稿已保存' });
          refreshDrawer();
          refreshEvents();
          return { ok: true };
        }}
      />

      <RuntimeSyncEventDrawer
        open={eventDrawerOpen}
        onOpenChange={(open) => {
          setEventDrawerOpen(open);
          if (!open) setEventDrawerEvent(null);
        }}
        projectId={projectId}
        event={eventDrawerEvent}
        contextPages={contextPages}
        canManage={canMutate}
        onSaveDraft={async (op) => {
          if (!viewSessionId || !hasActiveSession) return { ok: false, error: 'no_active_session' };
          const res = await upsertRuntimeSessionDraftOpAction({
            projectId,
            sessionId: viewSessionId,
            route: op.route,
            key: op.key,
            action: op.action,
            targetPageId: op.targetPageId ?? null,
            targetModuleId: op.targetModuleId ?? null
          });
          if (!res.ok) {
            push({ variant: 'destructive', title: '保存草稿失败', message: (res as any).error ?? '请求失败' });
            return res;
          }
          push({ variant: 'default', message: '草稿已保存' });
          setEventDrawerOpen(false);
          setEventDrawerEvent(null);
          refreshEvents();
          return { ok: true };
        }}
        onCreatePage={async (payload) => {
          const res = await createRuntimePageAction(payload);
          if (res.ok) {
            const nodes = await listRuntimeContextNodesQuery(projectId);
            if (nodes.ok) setContextPages(nodes.data.pages);
          }
          return res;
        }}
        onCreateModule={async (payload) => {
          const res = await createRuntimeModuleAction(payload);
          if (res.ok) {
            const nodes = await listRuntimeContextNodesQuery(projectId);
            if (nodes.ok) setContextPages(nodes.data.pages);
          }
          return res;
        }}
      />
    </>
  );
}
