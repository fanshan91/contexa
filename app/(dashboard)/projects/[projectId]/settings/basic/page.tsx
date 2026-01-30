import { prisma } from '@/lib/db/prisma';
import { ProjectSettingsBasicPageClient } from './basic-page-client';

export default async function ProjectSettingsBasicPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const id = Number(projectId);
  
  if (!Number.isFinite(id)) return null;

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      sourceLocale: true
    }
  });

  if (!project) return null;

  return (
    <ProjectSettingsBasicPageClient
      projectId={project.id}
      initialName={project.name}
      initialDescription={project.description}
      sourceLocale={project.sourceLocale}
    />
  );
}
