'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/form-error';
import { promoteSystemAdmin } from './actions';
import { ActionState } from '@/lib/auth/middleware';
import { useTranslations } from 'next-intl';

export function PromoteForm({
  userId,
  disabled
}: {
  userId: number;
  disabled?: boolean;
}) {
  const t = useTranslations('users');
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    promoteSystemAdmin,
    { error: '' }
  );

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="userId" value={String(userId)} />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        className="rounded-full"
        disabled={disabled || pending}
      >
        {t('promote')}
      </Button>
      <FormError message={state?.error} />
    </form>
  );
}
