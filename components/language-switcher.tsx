'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { LanguagesIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { AppLocale, locales } from '@/i18n/routing';

const labels: Record<AppLocale, string> = {
  'zh-CN': 'common.chineseSimplified',
  en: 'common.english'
};
/** 平台界面文案语言切换Select */
export function LanguageSwitcher({
  variant = 'outline',
  size = 'sm'
}: {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}) {
  const t = useTranslations();
  const { push } = useToast();
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function setLocale(nextLocale: AppLocale) {
    try {
      const res = await fetch('/api/locale', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ locale: nextLocale })
      });
      if (!res.ok) {
        push({ variant: 'destructive', message: t('actions.switchLocaleFailed') });
        return;
      }
    } catch {
      push({ variant: 'destructive', message: t('actions.switchLocaleFailed') });
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <DropdownMenu
      trigger={
        <Button variant={variant} size={size} disabled={pending}>
          <LanguagesIcon className="size-4" />
          {t(labels[locale])}
        </Button>
      }
      contentProps={{ align: 'end' }}
      items={[
        {
          type: 'radio-group',
          value: locale,
          onValueChange: (value) => setLocale(value as AppLocale),
          items: locales.map((l) => ({ value: l, label: t(labels[l]) }))
        }
      ]}
    />
  );
}
