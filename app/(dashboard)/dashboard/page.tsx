import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground lg:text-2xl">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user.isSystemAdmin
              ? t('subtitleSystemAdmin')
              : t('subtitleMember')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user.isSystemAdmin ? (
            <Button asChild>
              <Link href="/projects/new">{t('createProject')}</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {projects.length === 0 ? (
        <Card
          title={
            <span className="text-base">
              {user.isSystemAdmin ? t('emptyTitleSystemAdmin') : t('emptyTitleMember')}
            </span>
          }
          description={user.isSystemAdmin ? t('emptyDescSystemAdmin') : t('emptyDescMember')}
          action={
            user.isSystemAdmin ? (
              <Button asChild>
                <Link href="/projects/new">{t('createProject')}</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="group block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Card
                className="h-full transition-colors group-hover:bg-muted/30 group-hover:shadow-sm"
                contentClassName="flex min-h-40 flex-col p-4"
              >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground group-hover:underline">
                        {p.name}
                      </div>
                      <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {p.description || '—'}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-xs text-muted-foreground">{t('entryCount')}</div>
                      <div className="mt-1 font-medium tabular-nums text-foreground">
                        {p._count.entries}
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-xs text-muted-foreground">{t('sourceLocale')}</div>
                        <div className="mt-1 truncate text-sm text-foreground">{p.sourceLocale}</div>
                      </div>
                      <div className="sm:text-right">
                        <div className="text-xs text-muted-foreground">{t('createdAt')}</div>
                        <div className="mt-1 whitespace-nowrap text-sm tabular-nums text-foreground">
                          {new Date(p.createdAt).toLocaleString(locale, { hour12: false })}
                        </div>
                      </div>
                    </div>
                  </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
