'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, RefreshCw, RotateCcw, Unplug, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-primitives';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, type TableColumn } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { TargetLocaleSelect } from '@/components/target-locale-select';
import { useEnhancedAvailability } from '@/lib/hooks/use-enhanced-availability';
import { cn } from '@/lib/utils';
import {
  applyRuntimeDiffAction,
  createRuntimeModuleAction,
  createRuntimePageAction,
  getRuntimeRouteDiffQuery,
  listRuntimeContextNodesQuery,
  listRuntimeEventsQuery,
  manualReconnectEnhancedAction,
  rotateRuntimeTokenAction,
  toggleRuntimeTokenAction,
  type ContextPageNode,
  type RuntimeEventsPage,
  type RuntimeRouteDiff,
  type RuntimeSyncBootstrap,
  type RuntimeSyncTopStatus,
  type RuntimeTokenInfo
} from './actions';
import { RuntimeSyncDrawer } from '@/app/(dashboard)/projects/[projectId]/runtime-sync/runtime-sync-drawer';

function StatusPill({ status, lastReportedAt }: { status: RuntimeSyncTopStatus; lastReportedAt: string | null }) {
  const meta =
    status === 'connected'
      ? { label: '已接入', icon: CheckCircle2, cls: 'border-success/30 text-success' }
      : status === 'expired'
        ? { label: '已到期', icon: XCircle, cls: 'border-destructive/30 text-destructive' }
        : status === 'not_connected'
          ? { label: '未接入', icon: Unplug, cls: 'border-border text-muted-foreground' }
          : status === 'error'
            ? { label: '异常', icon: AlertTriangle, cls: 'border-warning/40 text-warning' }
            : { label: '未检测到增强服务', icon: Unplug, cls: 'border-border text-muted-foreground' };

  const Icon = meta.icon;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className={cn('inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm', meta.cls)}>
        <Icon className="h-4 w-4" />
        <span className="font-medium">{meta.label}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        最近上报：{lastReportedAt ? new Date(lastReportedAt).toLocaleString() : '—'}
      </div>
    </div>
  );
}

function TranslationPill({ status }: { status: string | null }) {
  const meta =
    status === 'approved'
      ? { label: '已定版', cls: 'border-success/30 text-success' }
      : status === 'needs_review' || status === 'ready'
        ? { label: '待核对', cls: 'border-warning/40 text-warning' }
        : status === 'needs_update'
          ? { label: '待更新', cls: 'border-info/30 text-info' }
          : status === 'pending'
            ? { label: '待翻译', cls: 'border-border text-muted-foreground' }
            : { label: '—', cls: 'border-border text-muted-foreground' };
  return <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs', meta.cls)}>{meta.label}</span>;
}

export function ProjectRuntimeSyncClient({
  projectId,
  bootstrap
}: {
  projectId: number;
  bootstrap: RuntimeSyncBootstrap;
}) {
  const [token, setToken] = useState<RuntimeTokenInfo | null>(bootstrap.token);
  const [tokenTtlMonths, setTokenTtlMonths] = useState('6');
  const [targetLocale, setTargetLocale] = useState<string>(bootstrap.defaultTargetLocale ?? '');
  const [onlyDiff, setOnlyDiff] = useState(true);
  const [search, setSearch] = useState('');
  const [events, setEvents] = useState<RuntimeEventsPage>(bootstrap.events);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRoute, setDrawerRoute] = useState<string>('');
  const [drawerData, setDrawerData] = useState<RuntimeRouteDiff | null>(null);
  const [contextPages, setContextPages] = useState<ContextPageNode[]>([]);

  const [pending, startTransition] = useTransition();
  const { push } = useToast();

  const enhanced = useEnhancedAvailability({
    connected: bootstrap.enhancedConnected,
    licenseStatus: bootstrap.enhancedLicenseStatus
  });

  const canMutate = bootstrap.canManage && bootstrap.status !== 'expired' && enhanced.available;
  const canReadEnhanced = true;

  const refreshEvents = (opts?: { page?: number }) => {
    if (!canReadEnhanced) return;
    startTransition(async () => {
      const res = await listRuntimeEventsQuery({
        projectId,
        targetLocale: targetLocale || null,
        search: search.trim() || undefined,
        page: opts?.page ?? events.page,
        pageSize: events.pageSize,
        onlyDiff,
        route: undefined
      });
      if (!res.ok) return;
      setEvents(res.data);
    });
  };

  useEffect(() => {
    refreshEvents({ page: 1 });
  }, [targetLocale, onlyDiff]);

  useEffect(() => {
    if (!autoRefresh) return;
    if (!canReadEnhanced) return;
    if (bootstrap.status !== 'connected') return;

    const id = window.setInterval(() => {
      refreshEvents();
    }, 5000);
    return () => window.clearInterval(id);
  }, [autoRefresh, canReadEnhanced, bootstrap.status, events.page, events.pageSize, targetLocale, onlyDiff, search]);

  const tokenDisabled = !canMutate;

  const tokenExists = Boolean(token?.token);

  const columns = useMemo((): Array<TableColumn<any>> => {
    return [
      {
        key: 'lastSeenAt',
        title: '时间',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-muted-foreground',
        render: (_: unknown, record: any) => (
          <div className="whitespace-nowrap text-xs">{new Date(record.lastSeenAt).toLocaleString()}</div>
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
            ) : null}
          </div>
        )
      },
      {
        key: 'sourceText',
        title: '源文案',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top text-foreground',
        render: (_: unknown, record: any) => <div className="max-w-[420px] break-words">{record.sourceText}</div>
      },
      {
        key: 'translationStatus',
        title: '目标语言状态',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top',
        render: (_: unknown, record: any) => <TranslationPill status={record.translationStatus} />
      },
      {
        key: 'actions',
        title: '操作',
        headerClassName: 'bg-card px-3 py-2 text-left font-medium text-muted-foreground',
        cellClassName: 'px-3 py-2 align-top',
        render: (_: unknown, record: any) => {
          const canTranslate = Boolean(targetLocale) && Boolean(record.key);
          const params = new URLSearchParams();
          if (canTranslate) {
            params.set('locale', targetLocale);
            params.set('search', record.key);
            if (record.pageId) params.set('pageId', String(record.pageId));
            if (record.moduleId) params.set('moduleId', String(record.moduleId));
          }
          const translateHref = canTranslate ? `/projects/${projectId}/workbench?${params.toString()}` : `/projects/${projectId}/workbench`;
          return (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm" className="shadow-none">
                <Link href={translateHref}>立即去翻译</Link>
              </Button>
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
                关联页面/模块
              </Button>
            </div>
          );
        }
      }
    ];
  }, [projectId, targetLocale, canReadEnhanced]);

  useEffect(() => {
    if (!drawerOpen || !drawerRoute) {
      setDrawerData(null);
      return;
    }
    startTransition(async () => {
      const [diff, nodes] = await Promise.all([
        getRuntimeRouteDiffQuery({ projectId, route: drawerRoute }),
        listRuntimeContextNodesQuery(projectId)
      ]);
      if (diff.ok) setDrawerData(diff.data);
      if (nodes.ok) setContextPages(nodes.data.pages);
    });
  }, [drawerOpen, drawerRoute, projectId]);

  const refreshDrawer = () => {
    if (!drawerRoute) return;
    startTransition(async () => {
      const [diff, nodes] = await Promise.all([
        getRuntimeRouteDiffQuery({ projectId, route: drawerRoute }),
        listRuntimeContextNodesQuery(projectId)
      ]);
      if (diff.ok) setDrawerData(diff.data);
      if (nodes.ok) setContextPages(nodes.data.pages);
    });
  };

  const enhancedStatusCard = !enhanced.available ? (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">增强能力状态</CardTitle>
          <div className="text-sm text-muted-foreground">请联系系统管理员开通或配置增强服务。</div>
        </div>
        {bootstrap.isSystemAdmin ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="shadow-none">
              <Link href="/dashboard/system">前往配置</Link>
            </Button>
            <Button
              variant="outline"
              className="shadow-none"
              onClick={() => {
                startTransition(async () => {
                  await manualReconnectEnhancedAction(projectId);
                  refreshEvents();
                });
              }}
            >
              <RotateCcw className={cn('mr-2 h-4 w-4', pending ? 'animate-spin' : '')} />
              重新检测
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <StatusPill status={bootstrap.status} lastReportedAt={events.lastReportedAt} />
      </CardContent>
    </Card>
  ) : null;

  return (
    <>
      {enhancedStatusCard}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">接入状态与访问令牌</CardTitle>
            <div className="text-sm text-muted-foreground">SDK 通过此令牌访问采集/拉取接口</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={tokenTtlMonths}
              disabled={tokenDisabled}
              className="h-9 w-[120px] justify-between"
              options={[
                { value: '1', label: '1 个月' },
                { value: '3', label: '3 个月' },
                { value: '6', label: '6 个月' }
              ]}
              onValueChange={setTokenTtlMonths}
            />
            <ConfirmDialog
              disabled={tokenDisabled}
              title={tokenExists ? '确认更换令牌？' : '确认创建令牌？'}
              description={tokenExists ? '更换后旧令牌将立即失效。' : '创建后即可接入 SDK。'}
              confirmText={tokenExists ? '确认更换' : '确认创建'}
              confirmVariant={tokenExists ? 'destructive' : 'default'}
              trigger={
                <Button variant="outline" className="shadow-none" disabled={tokenDisabled}>
                  {tokenExists ? '更换令牌' : '创建令牌'}
                </Button>
              }
              onConfirm={() => {
                startTransition(async () => {
                  const ttl = Number(tokenTtlMonths);
                  const res = await rotateRuntimeTokenAction({ projectId, ttlMonths: ttl === 1 ? 1 : ttl === 3 ? 3 : 6 });
                  if (!res.ok) {
                    push({ variant: 'destructive', message: res.error });
                    return;
                  }
                  setToken(res.data);
                  push({ variant: 'default', message: tokenExists ? '令牌已更换' : '令牌已创建' });
                });
              }}
            />
            <Button
              variant="outline"
              className="shadow-none"
              disabled={!tokenExists || tokenDisabled}
              onClick={() => {
                startTransition(async () => {
                  if (!token) return;
                  const res = await toggleRuntimeTokenAction({ projectId, enabled: !token.enabled });
                  if (!res.ok) {
                    push({ variant: 'destructive', message: res.error });
                    return;
                  }
                  setToken(res.data);
                  push({ variant: 'default', message: res.data.enabled ? '令牌已启用' : '令牌已禁用' });
                });
              }}
            >
              {token?.enabled ? '禁用' : '启用'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-card p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">项目 ID</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <code className="max-w-full truncate rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground">
                    {projectId}
                  </code>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">SDK 初始化时需要此 ID</div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="shadow-none"
                  onClick={async () => {
                    await navigator.clipboard.writeText(String(projectId));
                  }}
                >
                  复制
                </Button>
              </div>
            </div>
          </div>
          {token ? (
            <div className="rounded-lg border bg-card p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">当前生效令牌</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <code className="max-w-full truncate rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground">
                      {token.token}
                    </code>
                    <span className={cn('text-xs', token.enabled ? 'text-success' : 'text-muted-foreground')}>
                      {token.enabled ? '启用' : '已禁用'}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    最近使用：{token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : '—'} · 更换时间：
                    {new Date(token.rotatedAt).toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    到期时间：{token.expiresAt ? new Date(token.expiresAt).toLocaleString() : '—'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="shadow-none"
                    disabled={!token.enabled}
                    onClick={async () => {
                      await navigator.clipboard.writeText(token.token);
                    }}
                  >
                    复制
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">尚未创建令牌。创建后即可接入 SDK。</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">事件列表</CardTitle>
            <div className="text-sm text-muted-foreground">默认仅展示新增与差异项（不展示未变更数据）</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TargetLocaleSelect
              targetLocales={bootstrap.targetLocales}
              value={targetLocale}
              onValueChange={setTargetLocale}
              disabled={bootstrap.targetLocales.length === 0}
              className="w-[220px]"
            />
            <Button
              variant="outline"
              className="shadow-none"
              disabled={!canReadEnhanced}
              onClick={() => refreshEvents({ page: 1 })}
            >
              <RefreshCw className={cn('mr-2 h-4 w-4', pending ? 'animate-spin' : '')} />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <Input
                value={search}
                placeholder="搜索 Key / 源文案"
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') refreshEvents({ page: 1 });
                }}
                className="max-w-[420px]"
              />
              <Button variant="outline" className="shadow-none" onClick={() => refreshEvents({ page: 1 })}>
                搜索
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={onlyDiff} onCheckedChange={setOnlyDiff} />
              <div className="text-sm text-muted-foreground">仅差异</div>
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} disabled={bootstrap.status !== 'connected'} />
              <div className="text-sm text-muted-foreground">自动刷新</div>
            </div>
          </div>

          <Table
            columns={columns}
            data={events.items}
            rowKey={(r: any) => `${r.route}:${r.key}`}
            emptyText={
              canReadEnhanced
                ? '暂无上报记录。可触发页面并通过 /api/runtime/events 上报。'
                : '增强服务不可用。请先配置并连接增强服务。'
            }
          />

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <div>
              共 {events.total} 条 · 当前 {events.items.length} 条
            </div>
            <div className="flex items-center gap-2">
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
        </CardContent>
      </Card>

      <RuntimeSyncDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        projectId={projectId}
        route={drawerRoute}
        canManage={canMutate}
        diff={drawerData}
        contextPages={contextPages}
        onRefresh={() => {
          refreshDrawer();
        }}
        onCreatePage={async (payload: Parameters<typeof createRuntimePageAction>[0]) => {
          const res = await createRuntimePageAction(payload);
          if (res.ok) {
            await Promise.all([
              listRuntimeContextNodesQuery(projectId).then((n) => n.ok && setContextPages(n.data.pages)),
              getRuntimeRouteDiffQuery({ projectId, route: drawerRoute }).then((d) => d.ok && setDrawerData(d.data))
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
        onApply={async (ops: Parameters<typeof applyRuntimeDiffAction>[0]['operations']) => {
          const res = await applyRuntimeDiffAction({
            projectId,
            route: drawerRoute,
            operations: ops
          });
          if (res.ok) {
            refreshDrawer();
            refreshEvents();
          }
          return res;
        }}
      />
    </>
  );
}
