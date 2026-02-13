import { getTranslations } from 'next-intl/server';
import { getRuntimeCaptureSessionBootstrapQuery, getRuntimeSyncBootstrapQuery, listRuntimeSessionEventsQuery } from '../actions';
import { ProjectRuntimeSyncEventsClient } from '../events/runtime-events-client';

export default async function ProjectRuntimeSyncSessionPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const t = await getTranslations('projectRuntimeSync');
  const { projectId } = await params;
  const id = Number(projectId);
  if (!Number.isFinite(id)) return null;

  const bootstrap = await getRuntimeSyncBootstrapQuery(id);
  if (!bootstrap.ok) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-foreground lg:text-2xl">{t('title')}</h1>
        </div>
        <div className="text-sm text-muted-foreground">{bootstrap.error}</div>
      </div>
    );
  }

  const capture = await getRuntimeCaptureSessionBootstrapQuery(id);
  if (!capture.ok) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-foreground lg:text-2xl">{t('title')}</h1>
        </div>
        <div className="text-sm text-muted-foreground">{capture.error}</div>
      </div>
    );
  }

  const viewSessionId = capture.data.session?.id ?? bootstrap.data.unsavedSession?.session.id ?? null;
  const sessionEvents = viewSessionId
    ? await listRuntimeSessionEventsQuery({ projectId: id, sessionId: viewSessionId, page: 1, pageSize: 20, onlyDiff: true })
    : { ok: true as const, data: { page: 1, pageSize: 20, total: 0, items: [], lastReportedAt: null } };
  if (!sessionEvents.ok) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-foreground lg:text-2xl">{t('title')}</h1>
        </div>
        <div className="text-sm text-muted-foreground">{sessionEvents.error}</div>
      </div>
    );
  }

  const bootstrapForSession = { ...bootstrap.data, events: sessionEvents.data };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-foreground lg:text-2xl">{t('title')} · 采集会话</h1>
          <div className="text-sm text-muted-foreground">仅展示当前采集会话内的数据，用于对齐并保存到页面/模块</div>
        </div>
      </div>
      <ProjectRuntimeSyncEventsClient projectId={id} bootstrap={bootstrapForSession} capture={capture.data} />
    </div>
  );
}
