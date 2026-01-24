'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormError } from '@/components/form-error';
import { activateSystemLicense } from './actions';
import { ActionState } from '@/lib/auth/middleware';
import { useTranslations } from 'next-intl';

export function ActivationForm() {
  const t = useTranslations('systemActivation');
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    activateSystemLicense,
    { error: '' }
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="licenseKey" className="mb-2">
          {t('licenseKeyLabel')}
        </Label>
        <Input
          id="licenseKey"
          name="licenseKey"
          placeholder={t('licenseKeyPlaceholder')}
          required
        />
      </div>

      <FormError message={state?.error} />

      <Button type="submit" className="rounded-full" disabled={pending}>
        {t('submit')}
      </Button>
    </form>
  );
}

