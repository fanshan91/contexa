import Link from 'next/link';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
        </div>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>
              {enhancedStatus.connected ? t('connectedDesc') : t('disconnectedDesc')}
            </CardDescription>
            <CardAction className="flex items-center gap-2">
              {user.isSystemAdmin ? (
                enhancedStatus.connected ? (
                  <Button asChild className="rounded-full">
                    <Link href="/dashboard/system-activation">{t('activate')}</Link>
                  </Button>
                ) : (
                  <Button className="rounded-full" disabled>
                    {t('activate')}
                  </Button>
                )
              ) : null}
              {canSeePlatformApiConfig ? (
                enhancedStatus.connected ? (
                  <Button asChild variant="secondary" className="rounded-full">
                    <Link href="/dashboard/platform-api-config">{t('platformApiConfig')}</Link>
                  </Button>
                ) : (
                  <Button variant="secondary" className="rounded-full" disabled>
                    {t('platformApiConfig')}
                  </Button>
                )
              ) : null}
            </CardAction>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 flex flex-col gap-1">
            <div>
              {t('connection')}：
              {enhancedStatus.connected ? t('connectionConnected') : t('connectionDisconnected')}
            </div>
            <div>
              {t('licenseStatus')}：{t('licenseUnknown')}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

