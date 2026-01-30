'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { useTranslations } from 'next-intl';

export function UserActionsMenu({
  userId,
  canPromote,
  canDemote
}: {
  userId: number;
  canPromote: boolean;
  canDemote: boolean;
}) {
  const t = useTranslations('users');

  return (
    <DropdownMenu
      trigger={
        <Button size="sm" variant="outline">
          {t('actions')}
        </Button>
      }
      contentProps={{ align: 'end', className: 'flex flex-col gap-1' }}
      items={[
        {
          type: 'item',
          asChild: true,
          className: 'cursor-pointer',
          label: (
            <Link href={`/dashboard/users/${userId}/reset-password`}>
              {t('resetPassword')}
            </Link>
          )
        },
        canPromote
          ? {
              type: 'item',
              asChild: true,
              className: 'cursor-pointer',
              label: <Link href={`/dashboard/users/${userId}/promote`}>{t('promote')}</Link>
            }
          : {
              type: 'item',
              disabled: true,
              className: 'opacity-50',
              label: t('promote')
            },
        canDemote
          ? {
              type: 'item',
              asChild: true,
              className: 'cursor-pointer',
              label: <Link href={`/dashboard/users/${userId}/demote`}>{t('demote')}</Link>
            }
          : {
              type: 'item',
              disabled: true,
              className: 'opacity-50',
              label: t('demote')
            }
      ]}
    />
  );
}
