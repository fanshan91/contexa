'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionState } from '@/lib/auth/middleware';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormError } from '@/components/form-error';
import { updateProjectBasicAction } from '../actions';

export function ProjectSettingsBasicForm({
  projectId,
  initialName,
  initialDescription,
  sourceLocale,
  canEdit
}: {
  projectId: number;
  initialName: string;
  initialDescription: string | null;
  sourceLocale: string;
  canEdit: boolean;
}) {
  const t = useTranslations('projectSettingsBasic');
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateProjectBasicAction,
    { error: '' }
  );

  return (
    <form className="space-y-6" action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />

      <div>
        <Label htmlFor="name" className="block text-sm font-medium text-gray-700">
          {t('projectName')}
        </Label>
        <div className="mt-1">
          <Input
            id="name"
            name="name"
            type="text"
            defaultValue={state.name ?? initialName}
            required
            maxLength={100}
            disabled={!canEdit}
            className="appearance-none rounded-full relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm disabled:bg-gray-50"
            placeholder={t('projectNamePlaceholder')}
          />
        </div>
      </div>

      <div>
        <Label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700"
        >
          {t('projectDescription')}
        </Label>
        <div className="mt-1">
          <Input
            id="description"
            name="description"
            type="text"
            defaultValue={state.description ?? initialDescription ?? ''}
            maxLength={2000}
            disabled={!canEdit}
            className="appearance-none rounded-full relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm disabled:bg-gray-50"
            placeholder={t('projectDescriptionPlaceholder')}
          />
        </div>
      </div>

      <div>
        <Label className="block text-sm font-medium text-gray-700">{t('sourceLocale')}</Label>
        <div className="mt-1 text-sm text-gray-900">{sourceLocale}</div>
      </div>

      <FormError message={state?.error} />

      <div>
        <Button
          type="submit"
          className="rounded-full"
          disabled={pending || !canEdit}
        >
          {pending ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  );
}

