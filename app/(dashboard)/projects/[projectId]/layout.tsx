import Link from 'next/link';
import { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/guards';
import { ProjectSidebar } from './project-sidebar';

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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('invalidProjectIdTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="text-sm text-gray-600">{t('invalidProjectIdDesc')}</div>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/dashboard">{t('backToProjects')}</Link>
            </Button>
          </CardContent>
        </Card>
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('noAccessTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="text-sm text-gray-600">{t('noAccessDesc')}</div>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/dashboard">{t('backToProjects')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, sourceLocale: true }
  });

  if (!project) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('notFoundTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="text-sm text-gray-600">{t('notFoundDesc')}</div>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/dashboard">{t('backToProjects')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-68px)] max-w-7xl mx-auto w-full">
      <div className="flex flex-1 overflow-hidden h-full">
        <ProjectSidebar projectId={project.id} projectName={project.name} />
        <main className="flex-1 overflow-y-auto p-0 lg:p-4">{children}</main>
      </div>
    </div>
  );
}

