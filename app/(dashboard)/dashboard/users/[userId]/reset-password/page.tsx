import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { ResetPasswordForm } from '../../reset-password-form';
import { getTranslations } from 'next-intl/server';

export default async function ResetPasswordPage({
  params
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const id = Number(userId);
  const t = await getTranslations('users');
  const currentUser = await requireUser();

  if (!currentUser.isSystemAdmin) {
    return (
      <div className="text-sm text-muted-foreground">{t('noPermission')}</div>
    );
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, deletedAt: true }
  });

  if (!target || target.deletedAt) {
    return (
      <div className="text-sm text-muted-foreground">{t('userNotFound')}</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-xl font-semibold text-foreground lg:text-2xl">
          {t('resetPasswordTitle')}
        </h1>
        <Button asChild variant="secondary">
          <Link href="/dashboard/users">{t('back')}</Link>
        </Button>
      </div>

      <Card title={t('confirmAction')} contentClassName="space-y-4">
          <div className="text-sm text-muted-foreground">
            {t('targetUser')}: {target.email}
          </div>
          <ResetPasswordForm userId={target.id} />
      </Card>
    </div>
  );
}
