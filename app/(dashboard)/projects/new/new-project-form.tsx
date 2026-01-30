'use client';

import { useActionState, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormError } from '@/components/form-error';
import { createProject } from '../actions';
import { ActionState } from '@/lib/auth/middleware';
import { useTranslations } from 'next-intl';
import { LocaleSelect } from '@/components/locale-select';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { ChevronDownIcon } from 'lucide-react';

export function NewProjectForm() {
  const t = useTranslations('newProject');
  const tq = useTranslations('projectSettingsQuality');
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createProject,
    { error: '' }
  );

  const adapterOptions = useMemo(
    () => [
      { value: 'tbd', label: tq('adapterTbd') },
      { value: 'vue-i18n', label: tq('adapterVueI18n') },
      { value: 'kiwi', label: tq('adapterKiwi') },
      { value: 'i18next', label: tq('adapterI18next') },
      { value: 'printf', label: tq('adapterPrintf') },
      { value: 'custom', label: tq('adapterCustom') }
    ],
    [tq]
  );

  const initialAdapter = useMemo(() => {
    if (state.translationAdapter) return state.translationAdapter;
    return 'tbd';
  }, [state.translationAdapter]);
  const [adapter, setAdapter] = useState(initialAdapter);
  const adapterLabel = useMemo(
    () => adapterOptions.find((o) => o.value === adapter)?.label ?? adapter,
    [adapter, adapterOptions]
  );

  return (
    <form className="space-y-5" action={formAction}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="name">{t('nameLabel')}</Label>
          <div className="mt-1">
            <Input
              id="name"
              name="name"
              type="text"
              defaultValue={state.name}
              required
              maxLength={100}
              className="h-10"
              placeholder={t('namePlaceholder')}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="sourceLocale">{t('sourceLocaleLabel')}</Label>
          <div className="mt-1">
            <LocaleSelect
              id="sourceLocale"
              name="sourceLocale"
              defaultValue={state.sourceLocale || 'zh-CN'}
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="translationAdapter">{t('adapterLabel')}</Label>
          <div className="mt-1">
            <input
              id="translationAdapter"
              name="translationAdapter"
              type="hidden"
              value={adapter}
              required
            />
            <DropdownMenu
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  className="relative h-10 w-full justify-between"
                >
                  <span className="truncate">{adapterLabel}</span>
                  <ChevronDownIcon className="size-4 opacity-60" />
                </Button>
              }
              contentProps={{
                align: 'start',
                style: { width: 'var(--radix-popper-anchor-width)' }
              }}
              items={[
                {
                  type: 'radio-group',
                  value: adapter,
                  onValueChange: setAdapter,
                  items: adapterOptions.map((opt) => ({
                    key: opt.value,
                    value: opt.value,
                    label: opt.label
                  }))
                }
              ]}
            />
          </div>
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="description">{t('descriptionLabel')}</Label>
          <div className="mt-1">
            <Input
              id="description"
              name="description"
              type="text"
              defaultValue={state.description}
              maxLength={2000}
              className="h-10"
              placeholder={t('descriptionPlaceholder')}
            />
          </div>
        </div>
      </div>

      <FormError message={state?.error} />

      <div>
        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending ? t('submitting') : t('submit')}
        </Button>
      </div>
    </form>
  );
}
