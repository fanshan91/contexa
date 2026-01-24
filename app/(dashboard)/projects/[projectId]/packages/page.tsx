import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/db/prisma';

export default async function ProjectPackagesPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const t = await getTranslations('projectPackages');
  const { projectId } = await params;
  const id = Number(projectId);
  if (!Number.isFinite(id)) return null;

  const project = await prisma.project.findUnique({
    where: { id },
    select: { sourceLocale: true }
  });
  if (!project) return null;

  const locales = await prisma.projectLocale.findMany({
    where: { projectId: id },
    select: { locale: true }
  });

  const targetLocales = locales
    .map((l) => l.locale)
    .filter((locale) => locale !== project.sourceLocale);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('subtitle')}</p>
        </div>
      </div>

      {targetLocales.length === 0 ? (
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>{t('emptyTargetLocalesTitle')}</CardTitle>
              <CardDescription>{t('emptyTargetLocalesDesc')}</CardDescription>
              <CardAction>
                <Button asChild className="rounded-full">
                  <Link href={`/projects/${id}/settings/locales`}>{t('goToSettings')}</Link>
                </Button>
              </CardAction>
            </CardHeader>
          </Card>
        </div>
      ) : (
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('placeholderTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">{t('placeholderDesc')}</CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}

