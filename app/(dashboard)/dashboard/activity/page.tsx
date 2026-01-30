import { Card } from '@/components/ui/card';
import {
  Settings,
  LogOut,
  UserPlus,
  Lock,
  UserCog,
  AlertCircle,
  UserMinus,
  Mail,
  CheckCircle,
  type LucideIcon,
} from 'lucide-react';
import { ActivityType } from '@/lib/db/types';
import { getActivityLogs } from '@/lib/db/queries';
import { getLocale, getTranslations } from 'next-intl/server';

const iconMap: Record<ActivityType, LucideIcon> = {
  [ActivityType.SIGN_UP]: UserPlus,
  [ActivityType.SIGN_IN]: UserCog,
  [ActivityType.SIGN_OUT]: LogOut,
  [ActivityType.UPDATE_PASSWORD]: Lock,
  [ActivityType.DELETE_ACCOUNT]: UserMinus,
  [ActivityType.UPDATE_ACCOUNT]: Settings,
  [ActivityType.CREATE_TEAM]: UserPlus,
  [ActivityType.REMOVE_TEAM_MEMBER]: UserMinus,
  [ActivityType.INVITE_TEAM_MEMBER]: Mail,
  [ActivityType.ACCEPT_INVITATION]: CheckCircle,
};

function getRelativeTime(date: Date, locale: string, t: (key: string, values?: any) => string) {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return t('time.justNow');
  if (diffInSeconds < 3600)
    return t('time.minutesAgo', { minutes: Math.floor(diffInSeconds / 60) });
  if (diffInSeconds < 86400)
    return t('time.hoursAgo', { hours: Math.floor(diffInSeconds / 3600) });
  if (diffInSeconds < 604800)
    return t('time.daysAgo', { days: Math.floor(diffInSeconds / 86400) });
  return date.toLocaleDateString(locale);
}

function formatAction(action: ActivityType, t: (key: string, values?: any) => string): string {
  switch (action) {
    case ActivityType.SIGN_UP:
      return t('actions.signUp');
    case ActivityType.SIGN_IN:
      return t('actions.signIn');
    case ActivityType.SIGN_OUT:
      return t('actions.signOut');
    case ActivityType.UPDATE_PASSWORD:
      return t('actions.updatePassword');
    case ActivityType.DELETE_ACCOUNT:
      return t('actions.deleteAccount');
    case ActivityType.UPDATE_ACCOUNT:
      return t('actions.updateAccount');
    case ActivityType.CREATE_TEAM:
      return t('actions.createTeam');
    case ActivityType.REMOVE_TEAM_MEMBER:
      return t('actions.removeTeamMember');
    case ActivityType.INVITE_TEAM_MEMBER:
      return t('actions.inviteTeamMember');
    case ActivityType.ACCEPT_INVITATION:
      return t('actions.acceptInvitation');
    default:
      return t('actions.unknown');
  }
}

export default async function ActivityPage() {
  const locale = await getLocale();
  const t = await getTranslations('activity');
  const logs: Awaited<ReturnType<typeof getActivityLogs>> = await getActivityLogs();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground lg:text-2xl">{t('title')}</h1>
      <Card title={t('recentActivity')}>
        {logs.length > 0 ? (
          <ul className="space-y-4">
            {logs.map((log) => {
              const Icon = iconMap[log.action as ActivityType] || Settings;
              const formattedAction = formatAction(log.action as ActivityType, t);

              return (
                <li key={log.id} className="flex items-center space-x-4">
                  <div className="bg-secondary rounded-full p-2">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {formattedAction}
                      {log.ipAddress && t('fromIp', { ip: log.ipAddress })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {getRelativeTime(new Date(log.timestamp), locale, t)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-12">
            <AlertCircle className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {t('emptyTitle')}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {t('emptyDescription')}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
