'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormError } from '@/components/form-error';
import { resetUserPassword } from './actions';
import { ActionState } from '@/lib/auth/middleware';
import { useTranslations } from 'next-intl';

export function ResetPasswordForm({ userId }: { userId: number }) {
  const t = useTranslations('users');
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    resetUserPassword,
    { error: '' }
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="userId" value={String(userId)} />
      <div className="flex items-center gap-2">
        <Input
          name="password"
          type="password"
          required
          minLength={6}
          maxLength={100}
          pattern="[A-Za-z0-9.@]+"
          className="h-9 rounded-full"
          placeholder={t('newPasswordPlaceholder')}
        />
        <Button
          type="submit"
          size="sm"
          className="rounded-full"
          disabled={pending}
        >
          {t('reset')}
        </Button>
      </div>
      <FormError message={state?.error} />
    </form>
  );
}
