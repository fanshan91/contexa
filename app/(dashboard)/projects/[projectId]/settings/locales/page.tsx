import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/guards';
import { ProjectSettingsLocalesForm } from './locales-form';

export default async function ProjectSettingsLocalesPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const t = await getTranslations('projectSettingsLocales');
  const { projectId } = await params;
  const id = Number(projectId);
  if (!Number.isFinite(id)) return null;

  const user = await requireUser();
  const [project, member, locales] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      select: { id: true, sourceLocale: true }
    }),
    prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: user.id } }
    }),
    prisma.projectLocale.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'asc' },
      select: { locale: true }
    })
  ]);

  if (!project) return null;

  const canEdit = member?.role === 'admin';
  const targetLocales = locales
    .map((l) => l.locale)
    .filter((l) => l !== project.sourceLocale);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('listTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700">
          <div>
            <div className="text-gray-600">{t('sourceLocale')}</div>
            <div className="mt-1">{project.sourceLocale}</div>
          </div>
          <div>
            <div className="text-gray-600">{t('targetLocales')}</div>
            {targetLocales.length === 0 ? (
              <div className="mt-1 text-gray-500">{t('noTargetLocales')}</div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {targetLocales.map((l) => (
                  <span
                    key={l}
                    className="px-3 py-1 rounded-full bg-gray-100 text-gray-800"
                  >
                    {l}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-2 text-sm text-gray-600">{t('removePolicy')}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('addTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectSettingsLocalesForm projectId={project.id} canEdit={canEdit} />
        </CardContent>
      </Card>
    </div>
  );
}

