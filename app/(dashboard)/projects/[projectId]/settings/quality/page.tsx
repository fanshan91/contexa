import { prisma } from '@/lib/db/prisma';
import { ProjectSettingsQualityPageClient } from './quality-page-client';

export default async function ProjectSettingsQualityPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const id = Number(projectId);
  if (!Number.isFinite(id)) return null;

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, qualityMode: true, translationAdapter: true }
  });

  if (!project) return null;

  return (
    <ProjectSettingsQualityPageClient
      projectId={project.id}
      initialQualityMode={project.qualityMode}
      initialAdapter={project.translationAdapter}
    />
  );
}
