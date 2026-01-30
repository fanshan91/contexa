import { notFound } from 'next/navigation';
import ProjectContextClient from './context-client';
import { getProjectContextTree } from './actions';

export default async function ProjectContextPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const id = Number(projectId);
  if (!Number.isFinite(id)) {
    notFound();
  }

  const pages = await getProjectContextTree(id);

  return <ProjectContextClient projectId={id} initialPages={pages} />;
}
