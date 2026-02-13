'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, RotateCcw, Unplug, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-primitives';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { useEnhancedAvailability } from '@/lib/hooks/use-enhanced-availability';
import { formatDateTimeShanghai } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import {
  discardRuntimeSessionAction,
  listRuntimeEventsQuery,
  manualReconnectEnhancedAction,
  rotateRuntimeTokenAction,
  toggleRuntimeTokenAction,
  type RuntimeEventsPage,
  type RuntimeSyncBootstrap,
  type RuntimeSyncTopStatus,
  type RuntimeTokenInfo
} from './actions';

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
        最近上报：{formatDateTimeShanghai(lastReportedAt)}
      </div>
    </div>
  );
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
  const [events, setEvents] = useState<RuntimeEventsPage>(bootstrap.events);

  const [pending, startTransition] = useTransition();
  const { push } = useToast();
  const router = useRouter();

  const enhanced = useEnhancedAvailability({
    connected: bootstrap.enhancedConnected,
    licenseStatus: bootstrap.enhancedLicenseStatus
  });

  const canMutate = bootstrap.canManage && bootstrap.status !== 'expired' && enhanced.available;
  const canReadEnhanced = true;

  const refreshLastReportedAt = () => {
    if (!canReadEnhanced) return;
    startTransition(async () => {
      const res = await listRuntimeEventsQuery({
        projectId,
        page: 1,
        pageSize: 1,
        onlyDiff: false
      });
      if (!res.ok) return;
      setEvents(res.data);
    });
  };

  useEffect(() => {
    refreshLastReportedAt();
  }, [projectId]);

  const tokenDisabled = !canMutate;

  const tokenExists = Boolean(token?.token);

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
                  refreshLastReportedAt();
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
                    最近使用：{formatDateTimeShanghai(token.lastUsedAt)} · 更换时间：{formatDateTimeShanghai(token.rotatedAt)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    到期时间：{formatDateTimeShanghai(token.expiresAt)}
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
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">采集会话</CardTitle>
              {bootstrap.unsavedSession &&
              (bootstrap.unsavedSession.session.status === 'closing' ||
                (bootstrap.unsavedSession.workspaceReady ? bootstrap.unsavedSession.collectedKeys > 0 : Boolean(bootstrap.unsavedSession.session.lastSeenAt))) ? (
                <div className="rounded-md border border-warning/30 bg-warning/5 px-2 py-0.5 text-xs font-medium text-warning">
                  未保存
                </div>
              ) : null}
            </div>
            <div className="text-sm text-muted-foreground">
              {bootstrap.unsavedSession
                ? `会话 #${bootstrap.unsavedSession.session.id} · ${bootstrap.unsavedSession.session.sdkIdentity ?? '—'} · ${
                    bootstrap.unsavedSession.session.env ?? '—'
                  }`
                : '进入采集会话工作区：查看本次采集数据、对齐页面/模块并保存。'}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="shadow-none"
              onClick={() => {
                if (bootstrap.unsavedSession) {
                  router.push(`/projects/${encodeURIComponent(String(projectId))}/runtime-sync/session`);
                  return;
                }

                refreshLastReportedAt();
                router.refresh();
              }}
            >
              {bootstrap.unsavedSession ? '查看会话' : '刷新采集状态'}
            </Button>
            {bootstrap.unsavedSession ? (
              <ConfirmDialog
                disabled={!bootstrap.canManage || pending}
                title="确认清空采集会话？"
                description="清空后会丢弃未保存的会话内数据，并结束当前会话。"
                confirmText="清空"
                confirmVariant="destructive"
                trigger={
                  <Button variant="destructive" disabled={!bootstrap.canManage || pending}>
                    清空
                  </Button>
                }
                onConfirm={() => {
                  const sessionId = bootstrap.unsavedSession?.session.id;
                  if (!sessionId) return;
                  startTransition(async () => {
                    const res = await discardRuntimeSessionAction({ projectId, sessionId });
                    if (!res.ok) {
                      push({ variant: 'destructive', title: '清空失败', message: res.error });
                      return;
                    }
                    push({ variant: 'default', title: '已清空会话', message: `会话 #${sessionId}` });
                    router.refresh();
                  });
                }}
              />
            ) : null}
          </div>
        </CardHeader>
        {bootstrap.unsavedSession &&
        (bootstrap.unsavedSession.session.status === 'closing' ||
          Boolean(bootstrap.unsavedSession.session.lastSeenAt) ||
          (bootstrap.unsavedSession.workspaceReady && bootstrap.unsavedSession.collectedKeys > 0)) ? (
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <div>开始时间：{formatDateTimeShanghai(bootstrap.unsavedSession.session.startedAt)}</div>
              <div>
                最近上报：
                {bootstrap.unsavedSession.session.lastSeenAt ? formatDateTimeShanghai(bootstrap.unsavedSession.session.lastSeenAt) : '—'}
              </div>
              {bootstrap.unsavedSession.workspaceReady ? <div>已采集 Key 数：{bootstrap.unsavedSession.collectedKeys}</div> : null}
            </div>
            {bootstrap.unsavedSession.session.status === 'closing' ? (
              <div className="text-warning">会话处于保存处理中状态，可能是上次保存中断导致。</div>
            ) : null}
          </CardContent>
        ) : null}
      </Card>
    </>
  );
}
