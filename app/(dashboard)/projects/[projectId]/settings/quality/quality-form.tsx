'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionState } from '@/lib/auth/middleware';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FormError } from '@/components/form-error';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { updateProjectQualityAction } from '../actions';

export function ProjectSettingsQualityForm({
  projectId,
  initialQualityMode,
  initialAdapter,
  canEdit
}: {
  projectId: number;
  initialQualityMode: string;
  initialAdapter: string;
  canEdit: boolean;
}) {
  const t = useTranslations('projectSettingsQuality');
  const [qualityMode, setQualityMode] = useState(initialQualityMode);
  const [adapter, setAdapter] = useState(initialAdapter);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateProjectQualityAction,
    { error: '' }
  );

  return (
    <form className="space-y-6" action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="qualityMode" value={qualityMode} />
      <input type="hidden" name="translationAdapter" value={adapter} />

      <div className="space-y-2">
        <Label className="block text-sm font-medium text-gray-700">{t('mode')}</Label>
        <RadioGroup
          value={qualityMode}
          onValueChange={(v) => setQualityMode(v)}
          className="grid gap-3"
          disabled={!canEdit}
        >
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <RadioGroupItem value="standard" />
            <span>{t('modeStandard')}</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <RadioGroupItem value="lenient" />
            <span>{t('modeLenient')}</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <RadioGroupItem value="strict" />
            <span>{t('modeStrict')}</span>
          </label>
        </RadioGroup>
        <p className="text-sm text-gray-600">{t('modeHelp')}</p>
      </div>

      <div className="space-y-2">
        <Label className="block text-sm font-medium text-gray-700">{t('adapter')}</Label>
        <select
          value={adapter}
          onChange={(e) => setAdapter(e.target.value)}
          disabled={!canEdit}
          className="h-9 rounded-full border border-gray-300 bg-white px-3 text-sm text-gray-900 disabled:bg-gray-50"
        >
          <option value="tbd">{t('adapterTbd')}</option>
          <option value="vue-i18n">{t('adapterVueI18n')}</option>
          <option value="kiwi">{t('adapterKiwi')}</option>
          <option value="i18next">{t('adapterI18next')}</option>
          <option value="printf">{t('adapterPrintf')}</option>
          <option value="custom">{t('adapterCustom')}</option>
        </select>
        <p className="text-sm text-gray-600">{t('adapterHelp')}</p>
      </div>

      <FormError message={state?.error} />

      <div>
        <Button type="submit" className="rounded-full" disabled={pending || !canEdit}>
          {pending ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  );
}

