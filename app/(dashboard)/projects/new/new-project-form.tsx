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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

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
          <Label htmlFor="name" className="block text-sm font-medium text-gray-700">
            {t('nameLabel')}
          </Label>
          <div className="mt-1">
            <Input
              id="name"
              name="name"
              type="text"
              defaultValue={state.name}
              required
              maxLength={100}
              className="h-10 rounded-full border-gray-300"
              placeholder={t('namePlaceholder')}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="sourceLocale" className="block text-sm font-medium text-gray-700">
            {t('sourceLocaleLabel')}
          </Label>
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
          <Label
            htmlFor="translationAdapter"
            className="block text-sm font-medium text-gray-700"
          >
            {t('adapterLabel')}
          </Label>
          <div className="mt-1">
            <DropdownMenu>
              <input
                id="translationAdapter"
                name="translationAdapter"
                type="hidden"
                value={adapter}
                required
              />
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="relative h-10 w-full justify-between rounded-full border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
                >
                  <span className="truncate">{adapterLabel}</span>
                  <ChevronDownIcon className="size-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                style={{ width: 'var(--radix-popper-anchor-width)' }}
              >
                <DropdownMenuRadioGroup value={adapter} onValueChange={setAdapter}>
                  {adapterOptions.map((opt) => (
                    <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="description" className="block text-sm font-medium text-gray-700">
            {t('descriptionLabel')}
          </Label>
          <div className="mt-1">
            <Input
              id="description"
              name="description"
              type="text"
              defaultValue={state.description}
              maxLength={2000}
              className="h-10 rounded-full border-gray-300"
              placeholder={t('descriptionPlaceholder')}
            />
          </div>
        </div>
      </div>

      <FormError message={state?.error} />

      <div>
        <Button
          type="submit"
          className={cn(
            'w-full rounded-full bg-orange-600 text-white shadow-sm hover:bg-orange-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2'
          )}
          disabled={pending}
        >
          {pending ? t('submitting') : t('submit')}
        </Button>
      </div>
    </form>
  );
}
