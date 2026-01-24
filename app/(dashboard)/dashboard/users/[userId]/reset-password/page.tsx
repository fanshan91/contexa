import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-sm text-gray-600">{t('noPermission')}</div>
      </main>
    );
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, deletedAt: true }
  });

  if (!target || target.deletedAt) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-sm text-gray-600">{t('userNotFound')}</div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">{t('resetPasswordTitle')}</h1>
        <Button asChild variant="secondary" className="rounded-full">
          <Link href="/dashboard/users">{t('back')}</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('confirmAction')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-gray-600">
            {t('targetUser')}: {target.email}
          </div>
          <ResetPasswordForm userId={target.id} />
        </CardContent>
      </Card>
    </main>
  );
}

