import Link from 'next/link';
import { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/guards';
import { ProjectShell } from './project-shell';

export default async function ProjectLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const t = await getTranslations('projectLayout');
  const user = await requireUser();
  const { projectId } = await params;
  const id = Number(projectId);

  if (!Number.isFinite(id)) {
    return (
      <div className="h-[calc(100dvh-68px)] overflow-y-auto bg-muted/30 px-4 py-6 lg:px-6">
        <div className="mx-auto w-full max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('invalidProjectIdTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              {t('invalidProjectIdDesc')}
            </div>
            <Button asChild variant="outline">
              <Link href="/dashboard">{t('backToProjects')}</Link>
            </Button>
          </CardContent>
        </Card>
        </div>
      </div>
    );
  }

  const member = user.isSystemAdmin
    ? null
    : await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: id, userId: user.id } }
      });

  if (!user.isSystemAdmin && !member) {
    return (
      <div className="h-[calc(100dvh-68px)] overflow-y-auto bg-muted/30 px-4 py-6 lg:px-6">
        <div className="mx-auto w-full max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('noAccessTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">{t('noAccessDesc')}</div>
            <Button asChild variant="outline">
              <Link href="/dashboard">{t('backToProjects')}</Link>
            </Button>
          </CardContent>
        </Card>
        </div>
      </div>
    );
  }

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, sourceLocale: true }
  });

  if (!project) {
    return (
      <div className="h-[calc(100dvh-68px)] overflow-y-auto bg-muted/30 px-4 py-6 lg:px-6">
        <div className="mx-auto w-full max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('notFoundTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">{t('notFoundDesc')}</div>
            <Button asChild variant="outline">
              <Link href="/dashboard">{t('backToProjects')}</Link>
            </Button>
          </CardContent>
        </Card>
        </div>
      </div>
    );
  }

  return (
    <ProjectShell projectId={project.id} projectName={project.name}>
      {children}
    </ProjectShell>
  );
}
