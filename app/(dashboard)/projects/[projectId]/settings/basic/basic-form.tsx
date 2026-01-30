'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionState } from '@/lib/auth/middleware';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { FormError } from '@/components/form-error';
import { deleteProjectAction, updateProjectBasicAction } from '../actions';

export function ProjectSettingsBasicForm({
  projectId,
  initialName,
  initialDescription,
  sourceLocale,
  canEdit,
  canDelete
}: {
  projectId: number;
  initialName: string;
  initialDescription: string | null;
  sourceLocale: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations('projectSettingsBasic');
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateProjectBasicAction,
    { error: '' }
  );
  const [deleteState, deleteAction, deletePending] = useActionState<ActionState, FormData>(
    deleteProjectAction,
    { error: '' }
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const confirmMatched = confirmName === initialName;

  return (
    <div className="space-y-10">
      <form className="space-y-6" action={formAction}>
        <input type="hidden" name="projectId" value={projectId} />

        <div>
          <Label htmlFor="name">{t('projectName')}</Label>
          <div className="mt-1">
            <Input
              id="name"
              name="name"
              type="text"
              defaultValue={state.name ?? initialName}
              required
              maxLength={100}
              disabled={!canEdit}
              className="h-10"
              placeholder={t('projectNamePlaceholder')}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="description">{t('projectDescription')}</Label>
          <div className="mt-1">
            <Input
              id="description"
              name="description"
              type="text"
              defaultValue={state.description ?? initialDescription ?? ''}
              maxLength={2000}
              disabled={!canEdit}
              className="h-10"
              placeholder={t('projectDescriptionPlaceholder')}
            />
          </div>
        </div>

        <div>
          <Label>{t('sourceLocale')}</Label>
          <div className="mt-1 text-sm text-foreground">{sourceLocale}</div>
        </div>

        <FormError message={state?.error} />

        <div>
          <Button type="submit" disabled={pending || !canEdit}>
            {pending ? t('saving') : t('save')}
          </Button>
        </div>
      </form>

      <Alert
        variant="destructive"
        title={t('dangerZoneTitle')}
        description={
          <>
            <p>{t('deleteProjectDesc')}</p>
            {!canDelete ? (
              <p className="mt-1">{t('deleteProjectPermissionHint')}</p>
            ) : null}
          </>
        }
        actions={
          <Button
            type="button"
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={!canDelete}
          >
            {t('deleteProjectButton')}
          </Button>
        }
      />

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setConfirmName('');
        }}
        title={t('deleteProjectDialogTitle')}
        description={
          <div className="space-y-2">
            <p>{t('deleteProjectDialogDesc')}</p>
            <p className="font-medium text-foreground">{initialName}</p>
          </div>
        }
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deletePending}
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              form="delete-project-form"
              variant="destructive"
              disabled={!canDelete || deletePending || !confirmMatched}
            >
              {deletePending ? t('deleteProjectDeleting') : t('deleteProjectConfirmButton')}
            </Button>
          </>
        }
      >
        <form id="delete-project-form" className="space-y-4" action={deleteAction}>
            <input type="hidden" name="projectId" value={projectId} />

            <div className="space-y-2">
              <Label htmlFor="confirmName">{t('deleteProjectConfirmLabel')}</Label>
              <Input
                id="confirmName"
                name="confirmName"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                maxLength={100}
                placeholder={t('deleteProjectConfirmPlaceholder')}
                disabled={deletePending}
              />
            </div>

            <FormError message={deleteState?.error} />
          </form>
      </Dialog>
    </div>
  );
}
