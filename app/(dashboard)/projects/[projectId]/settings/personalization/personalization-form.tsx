'use client';

import { useActionState, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionState } from '@/lib/auth/middleware';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/form-error';
import { saveProjectLocalePreferencesAction } from '../actions';

export function ProjectSettingsPersonalizationForm({
  projectId,
  targetLocales,
  initialSelected
}: {
  projectId: number;
  targetLocales: string[];
  initialSelected: string[];
}) {
  const t = useTranslations('projectSettingsPersonalization');
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveProjectLocalePreferencesAction,
    { error: '' }
  );

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const toggleLocale = (locale: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(locale)) {
        next.delete(locale);
        return Array.from(next);
      }
      if (next.size >= 3) {
        return prev;
      }
      next.add(locale);
      return Array.from(next);
    });
  };

  return (
    <form className="space-y-6" action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="localesJson" value={JSON.stringify(selected)} />

      <div className="text-sm text-gray-600">
        {t('selectedCount', { selected: selected.length, max: 3 })}
      </div>

      <div className="space-y-2">
        {targetLocales.map((locale) => (
          <label key={locale} className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={selectedSet.has(locale)}
              onChange={() => toggleLocale(locale)}
            />
            <span>{locale}</span>
          </label>
        ))}
      </div>

      <FormError message={state?.error} />

      <div>
        <Button type="submit" className="rounded-full" disabled={pending}>
          {pending ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  );
}

