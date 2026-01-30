import { prisma } from '@/lib/db/prisma';
import { ProjectSettingsLocalesPageClient } from './locales-page-client';

export default async function ProjectSettingsLocalesPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const id = Number(projectId);
  if (!Number.isFinite(id)) return null;

  const [project, locales] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      select: { id: true, sourceLocale: true }
    }),
    prisma.projectLocale.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'asc' },
      select: { locale: true }
    })
  ]);

  if (!project) return null;

  const targetLocales = locales
    .map((l) => l.locale)
    .filter((l) => l !== project.sourceLocale);

  return (
    <ProjectSettingsLocalesPageClient
      projectId={project.id}
      sourceLocale={project.sourceLocale}
      targetLocales={targetLocales}
    />
  );
}
