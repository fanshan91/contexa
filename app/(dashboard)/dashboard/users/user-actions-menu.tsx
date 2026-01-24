'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-full">
          {t('actions')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="flex flex-col gap-1">
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href={`/dashboard/users/${userId}/reset-password`}>
            {t('resetPassword')}
          </Link>
        </DropdownMenuItem>
        {canPromote ? (
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href={`/dashboard/users/${userId}/promote`}>{t('promote')}</Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled className="opacity-50">
            {t('promote')}
          </DropdownMenuItem>
        )}
        {canDemote ? (
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href={`/dashboard/users/${userId}/demote`}>{t('demote')}</Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled className="opacity-50">
            {t('demote')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
