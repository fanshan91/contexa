import Link from 'next/link';
import { Card } from '@/components/ui/card';
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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground lg:text-2xl">{t('title')}</h1>
        </div>
        <Button asChild variant="secondary">
          <Link href="/dashboard">{t('back')}</Link>
        </Button>
      </div>

      {!hasPermission ? (
        <div className="text-sm text-muted-foreground">{t('noPermission')}</div>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {enhancedStatus.connected ? t('connectedHint') : t('disconnectedHint')}
          </div>
          <Card title={t('formTitle')}>
            <PlatformApiConfigForm />
          </Card>
        </div>
      )}
    </div>
  );
}
