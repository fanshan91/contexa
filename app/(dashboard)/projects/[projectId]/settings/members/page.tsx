import { getTranslations, getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/guards';
import { ProjectMembersManager } from './members-manager';

async function getCreatorId(projectId: number) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { createdByUserId: true }
  });

  if (project?.createdByUserId) return project.createdByUserId;

  const firstAdmin = await prisma.projectMember.findFirst({
    where: { projectId, role: 'admin' },
    orderBy: { createdAt: 'asc' },
    select: { userId: true }
  });

  return firstAdmin?.userId ?? null;
}

export default async function ProjectSettingsMembersPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const t = await getTranslations('projectSettingsMembers');
  const locale = await getLocale();
  const { projectId } = await params;
  const id = Number(projectId);
  if (!Number.isFinite(id)) return null;

  const user = await requireUser();
  const [member, members, invitations, creatorId, users] = await Promise.all([
    prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: user.id } }
    }),
    prisma.projectMember.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'asc' },
      select: {
        userId: true,
        role: true,
        canReview: true,
        createdAt: true,
        user: { select: { email: true, name: true } }
      }
    }),
    prisma.projectInvitation.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' }
    }),
    getCreatorId(id),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true }
    })
  ] as const);

  const canManageMembers = user.isSystemAdmin || member?.role === 'admin';
  const canManageAdmins = !!creatorId && user.id === creatorId;

  return (
    <div className="space-y-4">
      {!canManageMembers ? (
        <div className="text-sm text-gray-600">{t('readOnlyHint')}</div>
      ) : null}

      <ProjectMembersManager
        projectId={id}
        members={members.map((m) => ({
          userId: m.userId,
          email: m.user.email,
          name: m.user.name,
          role: m.role,
          canReview: m.canReview,
          createdAt: new Date(m.createdAt).toLocaleString(locale, { hour12: false })
        }))}
        invitations={invitations.map((inv) => ({
          id: inv.id,
          email: inv.email,
          role: inv.role,
          canReview: inv.canReview,
          status: inv.status,
          createdAt: new Date(inv.createdAt).toLocaleString(locale, { hour12: false })
        }))}
        allUsers={users.map((u) => ({ id: u.id, email: u.email, name: u.name }))}
        canManageMembers={canManageMembers}
        canManageAdmins={canManageAdmins}
        creatorId={creatorId}
      />
    </div>
  );
}
