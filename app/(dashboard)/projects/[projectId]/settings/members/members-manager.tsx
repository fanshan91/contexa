'use client';

import { useActionState, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionState } from '@/lib/auth/middleware';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

function RoleSelect({
  value,
  onChange,
  disabled,
  canManageAdmins
}: {
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
  canManageAdmins: boolean;
}) {
  const t = useTranslations('projectRoles');

  const options = useMemo(
    () =>
      [
        { value: 'developer', label: t('developer') },
        { value: 'translator', label: t('translator') },
        ...(canManageAdmins ? [{ value: 'admin', label: t('admin') }] : [])
      ] as const,
    [canManageAdmins, t]
  );

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-9 rounded-full border border-gray-300 bg-white px-3 text-sm text-gray-900 disabled:bg-gray-50"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
      {!canManageAdmins && value === 'admin' ? (
        <option value="admin">{t('admin')}</option>
      ) : null}
    </select>
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
  const [role, setRole] = useState(row.role);
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
  const roleEditingDisabled = !canManageMembers || (!canManageAdmins && row.role === 'admin');
  const removeDisabled = !canManageMembers || isCreator;

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-medium text-gray-900 truncate">
            {row.name || row.email}
            {isCreator ? (
              <span className="ml-2 text-xs text-gray-600">{t('creatorBadge')}</span>
            ) : null}
          </div>
          <div className="text-sm text-gray-600 truncate">{row.email}</div>
        </div>
        <div className="text-sm text-gray-600 shrink-0">{row.createdAt}</div>
      </div>

      <form className="flex flex-col gap-3" action={updateAction}>
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="userId" value={row.userId} />
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{t('role')}</span>
            <input type="hidden" name="role" value={role} />
            <RoleSelect
              value={role}
              onChange={(next) => {
                setRole(next);
                if (next !== 'translator') setCanReview(false);
              }}
              disabled={roleEditingDisabled}
              canManageAdmins={canManageAdmins}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="canReview"
              checked={canReview}
              onChange={(e) => setCanReview(e.target.checked)}
              disabled={!canManageMembers || role !== 'translator'}
            />
            {t('canReview')}
          </label>

          <Button
            type="submit"
            className="rounded-full"
            disabled={updating || roleEditingDisabled}
          >
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
          className="rounded-full"
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
  const [newRole, setNewRole] = useState('developer');
  const [newCanReview, setNewCanReview] = useState(false);
  const [addState, addAction, adding] = useActionState<ActionState, FormData>(
    addProjectMemberAction,
    { error: '' }
  );

  return (
    <div className="space-y-4">
      <div className="border border-gray-200 rounded-xl p-4">
        <h2 className="text-base font-medium text-gray-900">{t('addTitle')}</h2>
        <p className="mt-1 text-sm text-gray-600">{t('addSubtitle')}</p>

        <form className="mt-4 space-y-4" action={addAction}>
          <input type="hidden" name="projectId" value={projectId} />

          <div>
            <Label htmlFor="email" className="block text-sm font-medium text-gray-700">
              {t('email')}
            </Label>
            <div className="mt-1">
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={addState.email ?? ''}
                required
                maxLength={200}
                disabled={!canManageMembers}
                list="project-member-email-options"
                className="appearance-none rounded-full relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm disabled:bg-gray-50"
                placeholder={t('emailPlaceholder')}
              />
              <datalist id="project-member-email-options">
                {allUsers.map((u) => (
                  <option key={u.id} value={u.email}>
                    {u.name ? `${u.name} <${u.email}>` : u.email}
                  </option>
                ))}
              </datalist>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{t('role')}</span>
              <RoleSelect
                value={newRole}
                onChange={(next) => {
                  setNewRole(next);
                  if (next !== 'translator') setNewCanReview(false);
                }}
                disabled={!canManageMembers}
                canManageAdmins={canManageAdmins}
              />
              <input type="hidden" name="role" value={newRole} />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="canReview"
                checked={newCanReview}
                onChange={(e) => setNewCanReview(e.target.checked)}
                disabled={!canManageMembers || newRole !== 'translator'}
              />
              {t('canReview')}
            </label>

            <Button type="submit" className="rounded-full" disabled={adding || !canManageMembers}>
              {adding ? t('adding') : t('add')}
            </Button>
          </div>

          <FormError message={addState?.error} />
        </form>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-medium text-gray-900">{t('membersTitle')}</h2>
        {members.length === 0 ? (
          <div className="text-sm text-gray-600">{t('membersEmpty')}</div>
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
        <h2 className="text-base font-medium text-gray-900">{t('invitationsTitle')}</h2>
        {invitations.length === 0 ? (
          <div className="text-sm text-gray-600">{t('invitationsEmpty')}</div>
        ) : (
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="border border-gray-200 rounded-xl p-4 text-sm text-gray-700 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">{inv.email}</div>
                  <div className="mt-1 text-gray-600">
                    {t('invitedAs')}：
                    {inv.role === 'admin'
                      ? tr('admin')
                      : inv.role === 'translator'
                        ? tr('translator')
                        : tr('developer')}
                    {inv.role === 'translator' ? (
                      <span className="ml-2">
                        {t('canReview')}：{inv.canReview ? t('yes') : t('no')}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-gray-600">
                    {t('status')}：{inv.status}
                  </div>
                </div>
                <div className="shrink-0 text-gray-600">{inv.createdAt}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
