'use client';

import { useActionState, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionState } from '@/lib/auth/middleware';
import { ProjectRoles } from '@/lib/auth/project-permissions';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FormError } from '@/components/form-error';
import { addProjectMemberAction, removeProjectMemberAction, updateProjectMemberAction } from '../actions';

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

type ProjectRoleValue = (typeof ProjectRoles)[keyof typeof ProjectRoles];

function normalizeProjectRole(role: string): ProjectRoleValue {
  if (role === 'developer') return ProjectRoles.internal;
  if (role === ProjectRoles.admin) return ProjectRoles.admin;
  if (role === ProjectRoles.internal) return ProjectRoles.internal;
  if (role === ProjectRoles.translator) return ProjectRoles.translator;
  return ProjectRoles.internal;
}

function getUserLabel(user: UserOption) {
  return user.name ? user.name : user.email;
}

function RoleSelect({
  value,
  onChange,
  disabled,
  canManageAdmins
}: {
  value: ProjectRoleValue;
  onChange: (next: ProjectRoleValue) => void;
  disabled: boolean;
  canManageAdmins: boolean;
}) {
  const t = useTranslations('projectRoles');

  const options = useMemo(
    () =>
      [
        { value: ProjectRoles.internal, label: t('internal') },
        { value: ProjectRoles.translator, label: t('translator') },
        ...(canManageAdmins ? [{ value: ProjectRoles.admin, label: t('admin') }] : [])
      ] as const,
    [canManageAdmins, t]
  );

  const mergedOptions = useMemo(() => {
    const base = [...options] as Array<{ value: ProjectRoleValue; label: string; disabled?: boolean }>;
    if (!canManageAdmins && value === ProjectRoles.admin) {
      base.push({ value: ProjectRoles.admin, label: t('admin'), disabled: true });
    }
    return base;
  }, [canManageAdmins, options, t, value]);

  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as ProjectRoleValue)}
      disabled={disabled}
      className="h-9 w-[180px]"
      options={mergedOptions}
    />
  );
}

function MemberRow({
  projectId,
  row,
  canManageMembers,
  canManageAdmins,
  creatorId
}: {
  projectId: number;
  row: MemberRowData;
  canManageMembers: boolean;
  canManageAdmins: boolean;
  creatorId: number | null;
}) {
  const t = useTranslations('projectSettingsMembers');
  const [role, setRole] = useState<ProjectRoleValue>(() => normalizeProjectRole(row.role));
  const [canReview, setCanReview] = useState(row.canReview);
  const [updateState, updateAction, updating] = useActionState<ActionState, FormData>(
    updateProjectMemberAction,
    { error: '' }
  );
  const [removeState, removeAction, removing] = useActionState<ActionState, FormData>(
    removeProjectMemberAction,
    { error: '' }
  );

  const isCreator = creatorId ? row.userId === creatorId : false;
  const roleEditingDisabled =
    !canManageMembers || (!canManageAdmins && normalizeProjectRole(row.role) === ProjectRoles.admin);
  const removeDisabled = !canManageMembers || isCreator;

  return (
    <div className="border border-border rounded-xl bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-medium text-foreground truncate">
            {row.name || row.email}
            {isCreator ? (
              <span className="ml-2 text-xs text-muted-foreground">
                {t('creatorBadge')}
              </span>
            ) : null}
          </div>
          <div className="text-sm text-muted-foreground truncate">{row.email}</div>
        </div>
        <div className="text-sm text-muted-foreground shrink-0">{row.createdAt}</div>
      </div>

      <form className="flex flex-col gap-3" action={updateAction}>
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="userId" value={row.userId} />
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('role')}</span>
            <input type="hidden" name="role" value={role} />
            <RoleSelect
              value={role}
              onChange={(next) => {
                setRole(next);
                setCanReview(next === ProjectRoles.translator ? true : false);
              }}
              disabled={roleEditingDisabled}
              canManageAdmins={canManageAdmins}
            />
          </div>

          {role === ProjectRoles.translator ? (
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={canReview}
                onCheckedChange={(next: boolean | 'indeterminate') => setCanReview(Boolean(next))}
                disabled={!canManageMembers}
              />
              <span>{t('canReview')}</span>
              {canReview ? <input type="hidden" name="canReview" value="on" /> : null}
            </div>
          ) : null}

          <Button type="submit" disabled={updating || roleEditingDisabled}>
            {updating ? t('saving') : t('save')}
          </Button>
        </div>
        <FormError message={updateState?.error} />
      </form>

      <form action={removeAction}>
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="userId" value={row.userId} />
        <Button
          type="submit"
          variant="outline"
          disabled={removing || removeDisabled}
        >
          {removing ? t('removing') : t('remove')}
        </Button>
        <FormError message={removeState?.error} />
      </form>
    </div>
  );
}

export function ProjectMembersManager({
  projectId,
  members,
  invitations,
  allUsers,
  canManageMembers,
  canManageAdmins,
  creatorId
}: {
  projectId: number;
  members: MemberRowData[];
  invitations: InvitationRowData[];
  allUsers: UserOption[];
  canManageMembers: boolean;
  canManageAdmins: boolean;
  creatorId: number | null;
}) {
  const t = useTranslations('projectSettingsMembers');
  const tr = useTranslations('projectRoles');
  const memberUserIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);
  const availableUsers = useMemo(
    () => allUsers.filter((u) => !memberUserIds.has(u.id)),
    [allUsers, memberUserIds]
  );

  const [newUserId, setNewUserId] = useState(() => availableUsers[0]?.id?.toString() ?? '');
  const [newRole, setNewRole] = useState<ProjectRoleValue>(ProjectRoles.internal);
  const [newCanReview, setNewCanReview] = useState(false);
  const [addState, addAction, adding] = useActionState<ActionState, FormData>(
    addProjectMemberAction,
    { error: '' }
  );

  return (
    <div className="space-y-4">
      <div className="border border-border rounded-xl bg-card p-4">
        <h2 className="text-base font-medium text-foreground">{t('addTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('addSubtitle')}</p>

        <form className="mt-4 space-y-4" action={addAction}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="userId" value={newUserId} />

          <div>
            <Label htmlFor="project-member-user">{t('user')}</Label>
            <div className="mt-1">
              <Select
                id="project-member-user"
                value={newUserId}
                onValueChange={setNewUserId}
                disabled={!canManageMembers || availableUsers.length === 0}
                placeholder={t('userPlaceholder')}
                className="h-10 w-[290px]"
                options={availableUsers.map((u) => ({
                  value: u.id.toString(),
                  label: getUserLabel(u)
                }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('role')}</span>
              <RoleSelect
                value={newRole}
                onChange={(next) => {
                  setNewRole(next);
                  setNewCanReview(next === ProjectRoles.translator ? true : false);
                }}
                disabled={!canManageMembers}
                canManageAdmins={canManageAdmins}
              />
              <input type="hidden" name="role" value={newRole} />
            </div>

            {newRole === ProjectRoles.translator ? (
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={newCanReview}
                  onCheckedChange={(next: boolean | 'indeterminate') => setNewCanReview(Boolean(next))}
                  disabled={!canManageMembers}
                />
                <span>{t('canReview')}</span>
                {newCanReview ? <input type="hidden" name="canReview" value="on" /> : null}
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={adding || !canManageMembers || availableUsers.length === 0 || !newUserId}
            >
              {adding ? t('adding') : t('add')}
            </Button>
          </div>

          <FormError message={addState?.error} />
        </form>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-medium text-foreground">{t('membersTitle')}</h2>
        {members.length === 0 ? (
          <div className="text-sm text-muted-foreground">{t('membersEmpty')}</div>
        ) : (
          <div className="space-y-3">
            {members.map((m) => (
              <MemberRow
                key={m.userId}
                projectId={projectId}
                row={m}
                canManageMembers={canManageMembers}
                canManageAdmins={canManageAdmins}
                creatorId={creatorId}
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-medium text-foreground">{t('invitationsTitle')}</h2>
        {invitations.length === 0 ? (
          <div className="text-sm text-muted-foreground">{t('invitationsEmpty')}</div>
        ) : (
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="border border-border rounded-xl bg-card p-4 text-sm flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">{inv.email}</div>
                  <div className="mt-1 text-muted-foreground">
                    {t('invitedAs')}：
                    {normalizeProjectRole(inv.role) === ProjectRoles.admin
                      ? tr('admin')
                      : normalizeProjectRole(inv.role) === ProjectRoles.translator
                        ? tr('translator')
                        : tr('internal')}
                    {normalizeProjectRole(inv.role) === ProjectRoles.translator ? (
                      <span className="ml-2">
                        {t('canReview')}：{inv.canReview ? t('yes') : t('no')}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {t('status')}：{inv.status}
                  </div>
                </div>
                <div className="shrink-0 text-muted-foreground">{inv.createdAt}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
