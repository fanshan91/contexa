import { redirect } from 'next/navigation';

export default async function LegacyRuntimeSyncEventsPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/projects/${encodeURIComponent(String(projectId))}/runtime-sync/session`);
}
