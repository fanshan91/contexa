import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/guards';
import { ProjectSettingsPersonalizationForm } from './personalization-form';

export default async function ProjectSettingsPersonalizationPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const t = await getTranslations('projectSettingsPersonalization');
  const { projectId } = await params;
  const id = Number(projectId);
  if (!Number.isFinite(id)) return null;

  const user = await requireUser();
  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, sourceLocale: true }
  });
  if (!project) return null;

  const locales = await prisma.projectLocale.findMany({
    where: { projectId: id },
    select: { locale: true },
    orderBy: { createdAt: 'asc' }
  });
  const targetLocales = locales
    .map((l: { locale: string }) => l.locale)
    .filter((l: string) => l !== project.sourceLocale);

  if (targetLocales.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('noTargetLocalesTitle')}</CardTitle>
          <CardDescription>{t('noTargetLocalesDesc')}</CardDescription>
          <CardAction>
            <Button asChild className="rounded-full">
              <Link href={`/projects/${id}/settings/locales`}>{t('goToLocales')}</Link>
            </Button>
          </CardAction>
        </CardHeader>
      </Card>
    );
  }

  const prefs = await prisma.userProjectLocalePreference.findMany({
    where: { projectId: id, userId: user.id },
    select: { locale: true }
  });

  let initialSelected = prefs.map((p: { locale: string }) => p.locale);
  if (initialSelected.length === 0) {
    if (targetLocales.includes('en-US')) initialSelected = ['en-US'];
    else if (targetLocales.includes('en')) initialSelected = ['en'];
    else initialSelected = [targetLocales[0]];
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('cardTitle')}</CardTitle>
        <CardDescription>{t('cardDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ProjectSettingsPersonalizationForm
          projectId={project.id}
          targetLocales={targetLocales}
          initialSelected={initialSelected}
        />
      </CardContent>
    </Card>
  );
}
