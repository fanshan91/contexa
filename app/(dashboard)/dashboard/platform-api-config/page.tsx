import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { requireUser } from '@/lib/auth/guards';
import { getTranslations } from 'next-intl/server';
import { getEnhancedSystemStatus } from '@/lib/enhanced/client';
import { prisma } from '@/lib/db/prisma';
import { PlatformApiConfigForm } from './config-form';

export default async function PlatformApiConfigPage() {
  const t = await getTranslations('platformApi');
  const user = await requireUser();
  const enhancedStatus = await getEnhancedSystemStatus();
  const isProjectAdmin = !!(await prisma.projectMember.findFirst({
    where: { userId: user.id, role: 'admin' },
    select: { id: true }
  }));
  const hasPermission = user.isSystemAdmin || isProjectAdmin;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
        <Button asChild variant="secondary" className="rounded-full">
          <Link href="/dashboard">{t('back')}</Link>
        </Button>
      </div>

      {!hasPermission ? (
        <div className="mt-6 text-sm text-gray-600">{t('noPermission')}</div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="text-sm text-gray-600">
            {enhancedStatus.connected ? t('connectedHint') : t('disconnectedHint')}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{t('formTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <PlatformApiConfigForm />
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}

