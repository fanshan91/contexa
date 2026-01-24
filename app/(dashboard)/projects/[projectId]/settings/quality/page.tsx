import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/guards';
import { ProjectSettingsQualityForm } from './quality-form';

export default async function ProjectSettingsQualityPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const t = await getTranslations('projectSettingsQuality');
  const { projectId } = await params;
  const id = Number(projectId);
  if (!Number.isFinite(id)) return null;

  const user = await requireUser();
  const [project, member] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      select: { id: true, qualityMode: true, translationAdapter: true }
    }),
    prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: user.id } }
    })
  ]);

  if (!project) return null;
  const canEdit = member?.role === 'admin';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('cardTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ProjectSettingsQualityForm
          projectId={project.id}
          initialQualityMode={project.qualityMode}
          initialAdapter={project.translationAdapter}
          canEdit={canEdit}
        />
      </CardContent>
    </Card>
  );
}

