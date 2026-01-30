'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ActionState } from '@/lib/auth/middleware';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FormError } from '@/components/form-error';
import { RadioGroup } from '@/components/ui/radio-group';
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
        <Label>{t('mode')}</Label>
        <RadioGroup
          value={qualityMode}
          onValueChange={(v) => setQualityMode(v)}
          className="grid gap-3"
          disabled={!canEdit}
          optionClassName="text-foreground"
          options={[
            { value: 'standard', label: <span>{t('modeStandard')}</span> },
            { value: 'lenient', label: <span>{t('modeLenient')}</span> },
            { value: 'strict', label: <span>{t('modeStrict')}</span> }
          ]}
        />
        <p className="text-sm text-muted-foreground">{t('modeHelp')}</p>
      </div>

      <div className="space-y-2">
        <Label>{t('adapter')}</Label>
        <select
          value={adapter}
          onChange={(e) => setAdapter(e.target.value)}
          disabled={!canEdit}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="tbd">{t('adapterTbd')}</option>
          <option value="vue-i18n">{t('adapterVueI18n')}</option>
          <option value="kiwi">{t('adapterKiwi')}</option>
          <option value="i18next">{t('adapterI18next')}</option>
          <option value="printf">{t('adapterPrintf')}</option>
          <option value="custom">{t('adapterCustom')}</option>
        </select>
        <p className="text-sm text-muted-foreground">{t('adapterHelp')}</p>
      </div>

      <FormError message={state?.error} />

      <div>
        <Button type="submit" disabled={pending || !canEdit}>
          {pending ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  );
}
