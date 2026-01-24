import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function ProjectWorkbenchPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const t = await getTranslations('projectWorkbench');
  const { projectId } = await params;
  const id = Number(projectId);
  if (!Number.isFinite(id)) return null;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('subtitle')}</p>
        </div>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('placeholderTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600">{t('placeholderDesc')}</CardContent>
        </Card>
      </div>
    </main>
  );
}

