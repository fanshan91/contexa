import type { ProjectMember } from '@prisma/client';
import type { User } from '@/lib/db/types';

export const ProjectRoles = {
  admin: 'admin',
  internal: 'internal',
  translator: 'translator'
} as const;

export type ProjectRole = (typeof ProjectRoles)[keyof typeof ProjectRoles];
export type ProjectAllowedRole = ProjectRole | 'creator';

type ProjectPermissionContext = {
  user: User;
  member: ProjectMember | null;
  creatorId?: number | null;
};

export function createProjectPermissionChecker({
  user,
  member,
  creatorId
}: ProjectPermissionContext) {
  const can = (allowedRoles: ProjectAllowedRole[]) => {
    if (user.isSystemAdmin) return true;
    if (allowedRoles.length === 1 && allowedRoles[0] === 'creator') {
      return Boolean(creatorId && creatorId === user.id);
    }
    if (member?.role === 'admin') return true;
    if (allowedRoles.includes('creator') && creatorId && creatorId === user.id) return true;
    if (!member) return false;
    return allowedRoles.includes(member.role as ProjectAllowedRole);
  };

  return { can };
}
