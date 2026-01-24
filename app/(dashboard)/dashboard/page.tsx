import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { getLocale, getTranslations } from 'next-intl/server';

type ProjectListItem = {
  id: number;
  name: string;
  description: string | null;
  sourceLocale: string;
  createdAt: Date;
  _count: { entries: number };
};

export default async function DashboardProjectsPage() {
  const locale = await getLocale();
  const t = await getTranslations('dashboardProjects');
  const user = await requireUser();

  const projects: ProjectListItem[] = await prisma.project.findMany({
    where: user.isSystemAdmin
      ? undefined
      : {
          members: {
            some: { userId: user.id }
          }
        },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      sourceLocale: true,
      createdAt: true,
      _count: { select: { entries: true } }
    }
  });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {user.isSystemAdmin
              ? t('subtitleSystemAdmin')
              : t('subtitleMember')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user.isSystemAdmin ? (
            <Button asChild className="rounded-full">
              <Link href="/projects/new">{t('createProject')}</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>
                {user.isSystemAdmin
                  ? t('emptyTitleSystemAdmin')
                  : t('emptyTitleMember')}
              </CardTitle>
              <CardDescription>
                {user.isSystemAdmin
                  ? t('emptyDescSystemAdmin')
                  : t('emptyDescMember')}
              </CardDescription>
              {user.isSystemAdmin ? (
                <CardAction>
                  <Button asChild className="rounded-full">
                    <Link href="/projects/new">{t('createProject')}</Link>
                  </Button>
                </CardAction>
              ) : null}
            </CardHeader>
          </Card>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="block">
              <Card className="h-full hover:border-gray-300 transition-colors">
                <CardHeader>
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {p.description || '—'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-gray-600 flex flex-col gap-1">
                  <div>
                    {t('sourceLocale')}：{p.sourceLocale}
                  </div>
                  <div>
                    {t('entryCount')}：{p._count.entries}
                  </div>
                  <div>
                    {t('createdAt')}：
                    {new Date(p.createdAt).toLocaleString(locale, {
                      hour12: false
                    })}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
