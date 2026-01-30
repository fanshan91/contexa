'use client';

import { useTranslations } from 'next-intl';
import { ProjectRoles, type ProjectAllowedRole } from '@/lib/auth/project-permissions';
import { useCan, useProjectPermissionSnapshot } from '@/lib/auth/project-permissions-context';
import { ProjectMembersManager } from './members-manager';

type MemberRowData = {
  userId: number;
  email: string;
  name: string | null;
  role: string;
  canReview: boolean;
  createdAt: string;
};

type InvitationRowData = {
  id: number;
  email: string;
  role: string;
  canReview: boolean;
  status: string;
  createdAt: string;
};

type UserOption = {
  id: number;
  email: string;
  name: string | null;
};

export function ProjectSettingsMembersPageClient({
  projectId,
  members,
  invitations,
  allUsers
}: {
  projectId: number;
  members: MemberRowData[];
  invitations: InvitationRowData[];
  allUsers: UserOption[];
}) {
  const t = useTranslations('projectSettingsMembers');
  const { creatorId } = useProjectPermissionSnapshot();

  const canManageMembers = useCan([ProjectRoles.admin] satisfies ProjectAllowedRole[]);
  const canManageAdmins = useCan(['creator']);

  return (
    <div className="space-y-4">
      {!canManageMembers ? (
        <div className="text-sm text-muted-foreground">{t('readOnlyHint')}</div>
      ) : null}

      <ProjectMembersManager
        projectId={projectId}
        members={members}
        invitations={invitations}
        allUsers={allUsers}
        canManageMembers={canManageMembers}
        canManageAdmins={canManageAdmins}
        creatorId={creatorId}
      />
    </div>
  );
}
