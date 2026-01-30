import { getTranslations } from 'next-intl/server';
import { getUser } from '@/lib/db/queries';
import DashboardShell from './dashboard-shell-client';

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations('sidebar');
  const user = await getUser();

  const navItems = (
    [
    { href: '/dashboard', icon: 'users', label: t('projects') },
    { href: '/dashboard/users', icon: 'users', label: t('users') },
    { href: '/dashboard/general', icon: 'settings', label: t('general') },
    { href: '/dashboard/system', icon: 'settings', label: t('settings') },
    { href: '/dashboard/activity', icon: 'scroll-text', label: t('activity') }
    ] satisfies Array<{
      href: string;
      icon: 'users' | 'settings' | 'scroll-text';
      label: string;
    }>
  ).filter((item) =>
    item.href === '/dashboard/users' ? Boolean(user?.isSystemAdmin) : true
  );

  return <DashboardShell navItems={navItems}>{children}</DashboardShell>;
}
