import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { getLocale, getTranslations } from 'next-intl/server';
import { getEnhancedSystemStatus } from '@/lib/enhanced/client';
import { getEnhancedConfig } from '@/lib/enhanced/state';
import { EnhancedConfigForm, ManualConnectButton, SystemActivationDialog } from './config-form';

export default async function SystemSettingsPage() {
  const t = await getTranslations('dashboardEnhanced');
  const locale = await getLocale();
  const user = await requireUser();
  const enhancedStatus = await getEnhancedSystemStatus();
  const enhancedConfig = await getEnhancedConfig();
  const isProjectAdmin = !!(await prisma.projectMember.findFirst({
    where: { userId: user.id, role: 'admin' },
    select: { id: true }
  }));
  const canSeePlatformApiConfig = user.isSystemAdmin || isProjectAdmin;
  const hasStoredConfig =
    Boolean(enhancedConfig.endpoint) &&
    (enhancedConfig.authMode === 'shared_secret'
      ? Boolean(enhancedConfig.sharedSecret)
      : Boolean(enhancedConfig.clientId) && Boolean(enhancedConfig.clientSecret));
  const licenseLabel =
    enhancedStatus.licenseStatus === 'active'
      ? t('licenseActive')
      : enhancedStatus.licenseStatus === 'expired'
        ? t('licenseExpired')
        : enhancedStatus.licenseStatus === 'unactivated'
          ? t('licenseUnactivated')
          : enhancedStatus.licenseStatus === 'trial'
            ? t('licenseTrial')
            : enhancedStatus.licenseStatus === 'locked'
              ? t('licenseLocked')
              : t('licenseUnknown');
  const licenseExpiresAt =
    (enhancedStatus.licenseStatus === 'active' || enhancedStatus.licenseStatus === 'trial') &&
    enhancedStatus.expiresAt
      ? (() => {
          const parsed = new Date(enhancedStatus.expiresAt);
          const formatted = Number.isNaN(parsed.getTime())
            ? enhancedStatus.expiresAt
            : parsed.toLocaleString(locale, { hour12: false });
          return t('licenseExpiresAt', { date: formatted });
        })()
      : null;
  const remainingDays = (() => {
    if (!enhancedStatus.expiresAt) return null;
    const now = enhancedStatus.serverTime ? new Date(enhancedStatus.serverTime) : new Date();
    const end = new Date(enhancedStatus.expiresAt);
    if (Number.isNaN(end.getTime())) return null;
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return null;
    return diff;
  })();

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
                <SystemActivationDialog triggerLabel={t('activate')} />
              ) : (
                <Button disabled>{t('activate')}</Button>
              )
            ) : null}
            {user.isSystemAdmin && !enhancedStatus.connected && hasStoredConfig ? (
              <ManualConnectButton label={t('manualConnect')} />
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
          {t('licenseStatus')}：{licenseLabel}
          {licenseExpiresAt ? <span className="text-muted-foreground">（{licenseExpiresAt}）</span> : null}
          {remainingDays != null ? (
            <span className="text-muted-foreground">（{t('remainingDays', { days: remainingDays })}）</span>
          ) : null}
        </div>
        {enhancedStatus.instanceId ? (
          <div>
            {t('instanceId')}：{enhancedStatus.instanceId}
            {enhancedStatus.lastSeenAt ? (
              <span className="text-muted-foreground">
                （{t('lastSeenAt', {
                  date: new Date(enhancedStatus.lastSeenAt).toLocaleString(locale, { hour12: false })
                })}）
              </span>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card
        title={<span className="text-base">{t('configTitle')}</span>}
        contentClassName="space-y-4"
      >
        {user.isSystemAdmin ? (
          <>
            <div className="text-sm text-muted-foreground">{t('configHint')}</div>
            <EnhancedConfigForm
              initialConfig={{
                endpoint: enhancedConfig.endpoint ?? '',
                authMode: enhancedConfig.authMode,
                clientId: enhancedConfig.clientId ?? '',
                hasSharedSecret: Boolean(enhancedConfig.sharedSecret),
                hasClientSecret: Boolean(enhancedConfig.clientSecret)
              }}
            />
          </>
        ) : (
          <div className="text-sm text-muted-foreground">{t('noPermission')}</div>
        )}
      </Card>
    </div>
  );
}
