'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormError } from '@/components/form-error';
import { useTranslations } from 'next-intl';
import { ActionState } from '@/lib/auth/middleware';
import { savePlatformApiConfigAction } from './actions';

export function PlatformApiConfigForm() {
  const t = useTranslations('platformApi');
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    savePlatformApiConfigAction,
    { error: '' }
  );

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-sm font-medium text-gray-900">{t('llmTitle')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="llmProvider" className="mb-2">
              {t('provider')}
            </Label>
            <Input id="llmProvider" name="llmProvider" placeholder="OpenAI" />
          </div>
          <div>
            <Label htmlFor="llmModel" className="mb-2">
              {t('model')}
            </Label>
            <Input id="llmModel" name="llmModel" placeholder="gpt-4o-mini" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="llmBaseUrl" className="mb-2">
              {t('baseUrl')}
            </Label>
            <Input
              id="llmBaseUrl"
              name="llmBaseUrl"
              placeholder="https://api.openai.com"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="llmApiKey" className="mb-2">
              {t('apiKey')}
            </Label>
            <Input
              id="llmApiKey"
              name="llmApiKey"
              type="password"
              placeholder={t('apiKeyPlaceholder')}
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-medium text-gray-900">{t('mtTitle')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="mtProvider" className="mb-2">
              {t('provider')}
            </Label>
            <Input id="mtProvider" name="mtProvider" placeholder="DeepL" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="mtBaseUrl" className="mb-2">
              {t('baseUrl')}
            </Label>
            <Input id="mtBaseUrl" name="mtBaseUrl" placeholder="https://api.example.com" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="mtApiKey" className="mb-2">
              {t('apiKey')}
            </Label>
            <Input
              id="mtApiKey"
              name="mtApiKey"
              type="password"
              placeholder={t('apiKeyPlaceholder')}
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      <FormError message={state?.error} />

      <Button type="submit" className="rounded-full" disabled={pending}>
        {t('save')}
      </Button>
    </form>
  );
}

