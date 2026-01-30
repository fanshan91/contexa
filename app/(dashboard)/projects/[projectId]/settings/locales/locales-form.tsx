'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionState } from '@/lib/auth/middleware';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FormError } from '@/components/form-error';
import { addProjectLocalesAction } from '../actions';
import { LocaleSelect } from '@/components/locale-select';
import { getProjectLocaleLabel, projectLocaleOptions } from '@/lib/locales';

export function ProjectSettingsLocalesForm({
  projectId,
  sourceLocale,
  targetLocales,
  canEdit
}: {
  projectId: number;
  sourceLocale: string;
  targetLocales: string[];
  canEdit: boolean;
}) {
  const t = useTranslations('projectSettingsLocales');
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addProjectLocalesAction,
    { error: '' }
  );

  const sourceLabel = useMemo(() => getProjectLocaleLabel(sourceLocale), [sourceLocale]);

  const availableOptions = useMemo(() => {
    const existing = new Set(targetLocales.map((l) => l.trim()).filter(Boolean));
    return projectLocaleOptions.filter((opt) => opt.value !== sourceLocale && !existing.has(opt.value));
  }, [sourceLocale, targetLocales]);

  const parsedStateValues = useMemo(() => {
    const raw = typeof state.localesText === 'string' ? state.localesText : '';
    if (!raw) return [];
    const incoming = raw
      .split(/[\s,，]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
    const unique = Array.from(new Set(incoming));
    const allowed = new Set(availableOptions.map((o) => o.value));
    return unique.filter((v) => allowed.has(v));
  }, [availableOptions, state.localesText]);

  const [selectedLocales, setSelectedLocales] = useState<string[]>(parsedStateValues);

  useEffect(() => {
    setSelectedLocales(parsedStateValues);
  }, [parsedStateValues]);

  return (
    <form className="space-y-4" action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <div className="max-w-2xl">
        <Label htmlFor="localesText">{t('addLabel')}</Label>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,360px)_auto] md:items-start">
          <LocaleSelect
            key={`${availableOptions.map((o) => o.value).join(',')}|${state.localesText ?? ''}`}
            id="localesText"
            name="localesText"
            multiple
            defaultValues={parsedStateValues}
            disabled={!canEdit || availableOptions.length === 0}
            options={availableOptions}
            placeholder={t('addPlaceholder')}
            onValuesChange={setSelectedLocales}
            className="w-full"
          />
          <Button
            type="submit"
            disabled={pending || !canEdit || availableOptions.length === 0 || selectedLocales.length === 0}
            className="h-10 w-28 justify-center"
          >
            {pending ? t('adding') : t('add')}
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t('addHelp')}</p>
      </div>

      <FormError message={state?.error} />
    </form>
  );
}
