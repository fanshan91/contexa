'use client';

import { createContext, useContext, useMemo } from 'react';
import type { ProjectAllowedRole } from '@/lib/auth/project-permissions';

type ProjectPermissionSnapshot = {
  userId: number;
  isSystemAdmin: boolean;
  memberRole: string | null;
  creatorId: number | null;
};

const ProjectPermissionContext = createContext<ProjectPermissionSnapshot | null>(null);

export function ProjectPermissionProvider({
  value,
  children
}: {
  value: ProjectPermissionSnapshot;
  children: React.ReactNode;
}) {
  const memoValue = useMemo(() => value, [value]);
  return (
    <ProjectPermissionContext.Provider value={memoValue}>
      {children}
    </ProjectPermissionContext.Provider>
  );
}

export function useProjectPermissionSnapshot() {
  const ctx = useContext(ProjectPermissionContext);
  if (!ctx) {
    throw new Error('ProjectPermissionProvider is missing');
  }
  return ctx;
}

export function useCan(allowedRoles: ProjectAllowedRole[]) {
  const { userId, isSystemAdmin, memberRole, creatorId } = useProjectPermissionSnapshot();

  if (isSystemAdmin) return true;

  if (allowedRoles.length === 1 && allowedRoles[0] === 'creator') {
    return Boolean(creatorId && creatorId === userId);
  }

  if (memberRole === 'admin') return true;
  if (allowedRoles.includes('creator') && creatorId && creatorId === userId) return true;
  if (!memberRole) return false;
  return allowedRoles.includes(memberRole as ProjectAllowedRole);
}
