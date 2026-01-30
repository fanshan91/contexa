import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { DemoteForm } from '../../demote-form';
import { getTranslations } from 'next-intl/server';

const SUPER_ADMIN_ACCOUNTS = new Set(['admin', 'admin@contexa.local']);

export default async function DemoteUserPage({
  params
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const id = Number(userId);
  const t = await getTranslations('users');
  const currentUser = await requireUser();

  if (!currentUser.isSystemAdmin || !SUPER_ADMIN_ACCOUNTS.has(currentUser.email)) {
    return (
      <div className="text-sm text-muted-foreground">{t('noPermission')}</div>
    );
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, isSystemAdmin: true, deletedAt: true }
  });

  if (!target || target.deletedAt) {
    return (
      <div className="text-sm text-muted-foreground">{t('userNotFound')}</div>
    );
  }

  const isProtected = SUPER_ADMIN_ACCOUNTS.has(target.email);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-xl font-semibold text-foreground lg:text-2xl">
          {t('demoteTitle')}
        </h1>
        <Button asChild variant="secondary">
          <Link href="/dashboard/users">{t('back')}</Link>
        </Button>
      </div>

      <Card title={t('confirmAction')} contentClassName="space-y-4">
          <div className="text-sm text-muted-foreground">
            {t('targetUser')}: {target.email}
          </div>
          <DemoteForm userId={target.id} disabled={!target.isSystemAdmin || isProtected} />
      </Card>
    </div>
  );
}
