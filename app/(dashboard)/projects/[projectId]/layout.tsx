import Link from 'next/link';
import { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/guards';
import { ProjectPermissionProvider } from '@/lib/auth/project-permissions-context';
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
          <Card
            title={<span className="text-base">{t('invalidProjectIdTitle')}</span>}
            contentClassName="flex items-center justify-between gap-4"
          >
            <div className="text-sm text-muted-foreground">{t('invalidProjectIdDesc')}</div>
            <Button asChild variant="outline">
              <Link href="/dashboard">{t('backToProjects')}</Link>
            </Button>
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
          <Card
            title={<span className="text-base">{t('noAccessTitle')}</span>}
            contentClassName="flex items-center justify-between gap-4"
          >
            <div className="text-sm text-muted-foreground">{t('noAccessDesc')}</div>
            <Button asChild variant="outline">
              <Link href="/dashboard">{t('backToProjects')}</Link>
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, sourceLocale: true, createdByUserId: true }
  });

  if (!project) {
    return (
      <div className="h-[calc(100dvh-68px)] overflow-y-auto bg-muted/30 px-4 py-6 lg:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <Card
            title={<span className="text-base">{t('notFoundTitle')}</span>}
            contentClassName="flex items-center justify-between gap-4"
          >
            <div className="text-sm text-muted-foreground">{t('notFoundDesc')}</div>
            <Button asChild variant="outline">
              <Link href="/dashboard">{t('backToProjects')}</Link>
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const creatorId = project.createdByUserId
    ? project.createdByUserId
    : (
        await prisma.projectMember.findFirst({
          where: { projectId: project.id, role: 'admin' },
          orderBy: { createdAt: 'asc' },
          select: { userId: true }
        })
      )?.userId ?? null;

  return (
    <ProjectPermissionProvider
      value={{
        userId: user.id,
        isSystemAdmin: user.isSystemAdmin,
        memberRole: member?.role ?? null,
        creatorId
      }}
    >
      <ProjectShell projectId={project.id} projectName={project.name}>
        {children}
      </ProjectShell>
    </ProjectPermissionProvider>
  );
}
