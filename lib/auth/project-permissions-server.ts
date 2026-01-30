import 'server-only';

import { cache } from 'react';
import { prisma } from '@/lib/db/prisma';
import { requireProjectAccess } from '@/lib/auth/guards';
import { createProjectPermissionChecker } from '@/lib/auth/project-permissions';

const getProjectCreatorId = cache(async (projectId: number) => {
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
});

export const getProjectPermissionChecker = cache(
  async (projectId: number, includeCreator: boolean = false) => {
    const { user, member } = await requireProjectAccess(projectId);
    const creatorId = includeCreator ? await getProjectCreatorId(projectId) : null;
    const { can } = createProjectPermissionChecker({ user, member, creatorId });
    return { user, member, creatorId, can };
  }
);
