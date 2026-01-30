import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { getTranslations } from 'next-intl/server';
import { getEnhancedSystemStatus } from '@/lib/enhanced/client';

export default async function SystemSettingsPage() {
  const t = await getTranslations('dashboardEnhanced');
  const user = await requireUser();
  const enhancedStatus = await getEnhancedSystemStatus();
  const isProjectAdmin = !!(await prisma.projectMember.findFirst({
    where: { userId: user.id, role: 'admin' },
    select: { id: true }
  }));
  const canSeePlatformApiConfig = user.isSystemAdmin || isProjectAdmin;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground lg:text-2xl">{t('title')}</h1>
      </div>

      <Card
        title={<span className="text-base">{t('title')}</span>}
        description={enhancedStatus.connected ? t('connectedDesc') : t('disconnectedDesc')}
        action={
          <div className="flex items-center gap-2">
            {user.isSystemAdmin ? (
              enhancedStatus.connected ? (
                <Button asChild>
                  <Link href="/dashboard/system-activation">{t('activate')}</Link>
                </Button>
              ) : (
                <Button disabled>{t('activate')}</Button>
              )
            ) : null}
            {canSeePlatformApiConfig ? (
              enhancedStatus.connected ? (
                <Button asChild variant="secondary">
                  <Link href="/dashboard/platform-api-config">{t('platformApiConfig')}</Link>
                </Button>
              ) : (
                <Button variant="secondary" disabled>
                  {t('platformApiConfig')}
                </Button>
              )
            ) : null}
          </div>
        }
        contentClassName="flex flex-col gap-1 text-sm text-muted-foreground"
      >
        <div>
          {t('connection')}：
          {enhancedStatus.connected ? t('connectionConnected') : t('connectionDisconnected')}
        </div>
        <div>
          {t('licenseStatus')}：{t('licenseUnknown')}
        </div>
      </Card>
    </div>
  );
}
