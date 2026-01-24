'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

type TabItem = { href: string; label: string };

export function ProjectSettingsTabs({ projectId }: { projectId: number }) {
  const pathname = usePathname();
  const t = useTranslations('projectSettingsTabs');

  const base = `/projects/${projectId}/settings`;
  const tabs: TabItem[] = [
    { href: `${base}/basic`, label: t('basic') },
    { href: `${base}/locales`, label: t('locales') },
    { href: `${base}/members`, label: t('members') },
    { href: `${base}/quality`, label: t('quality') },
    { href: `${base}/personalization`, label: t('personalization') }
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <Button
          asChild
          key={tab.href}
          variant={isActive(tab.href) ? 'secondary' : 'ghost'}
          className={`rounded-full shadow-none ${isActive(tab.href) ? 'bg-gray-100' : ''}`}
        >
          <Link href={tab.href}>{tab.label}</Link>
        </Button>
      ))}
    </div>
  );
}

