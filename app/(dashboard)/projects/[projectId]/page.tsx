import { redirect } from 'next/navigation';

export default async function ProjectPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const id = Number(projectId);
  if (!Number.isFinite(id)) {
    return null;
  }

  redirect(`/projects/${id}/overview`);
}
