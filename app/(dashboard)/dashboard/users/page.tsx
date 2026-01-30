import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { Card } from '@/components/ui/card';
import { prisma } from '@/lib/db/prisma';
import { getLocale, getTranslations } from 'next-intl/server';
import { UserActionsMenu } from './user-actions-menu';

const SUPER_ADMIN_ACCOUNTS = new Set(['admin', 'admin@contexa.local']);

export default async function UsersPage() {
  const user = await requireUser();
  const locale = await getLocale();
  const t = await getTranslations('users');

  if (!user.isSystemAdmin) {
    redirect('/dashboard');
  }

  const users: Array<{
    id: number;
    email: string;
    name: string | null;
    isSystemAdmin: boolean;
    createdAt: Date;
  }> = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      isSystemAdmin: true,
      createdAt: true
    }
  });

  const promotedCount = await prisma.user.count({
    where: {
      deletedAt: null,
      isSystemAdmin: true,
      email: { notIn: Array.from(SUPER_ADMIN_ACCOUNTS) }
    }
  });

  const canPromote = SUPER_ADMIN_ACCOUNTS.has(user.email) && promotedCount < 5;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground lg:text-2xl">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('promotedCount', { count: promotedCount, limit: 5 })}
        </p>
      </div>

      <Card
        title={<span className="text-base">{t('listTitle')}</span>}
        contentClassName="overflow-x-auto"
      >
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-4">{t('email')}</th>
                <th className="py-2 pr-4">{t('name')}</th>
                <th className="py-2 pr-4">{t('isSystemAdmin')}</th>
                <th className="py-2 pr-4">{t('createdAt')}</th>
                <th className="py-2 pr-4">{t('operations')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 align-top">
                  <td className="py-3 pr-4 font-medium text-foreground">{u.email}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{u.name || t('empty')}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {u.isSystemAdmin ? t('yes') : t('no')}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">
                    {new Date(u.createdAt).toLocaleString(locale, { hour12: false })}
                  </td>
                  <td className="py-3 pr-4">
                    <UserActionsMenu
                      userId={u.id}
                      canPromote={canPromote && !u.isSystemAdmin && !SUPER_ADMIN_ACCOUNTS.has(u.email)}
                      canDemote={
                        SUPER_ADMIN_ACCOUNTS.has(user.email) &&
                        u.isSystemAdmin &&
                        !SUPER_ADMIN_ACCOUNTS.has(u.email)
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </Card>
    </div>
  );
}
