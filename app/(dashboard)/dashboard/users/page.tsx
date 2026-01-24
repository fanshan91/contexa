import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {t('promotedCount', { count: promotedCount, limit: 5 })}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('listTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr className="border-b">
                  <th className="py-2 pr-4">{t('email')}</th>
                  <th className="py-2 pr-4">{t('name')}</th>
                  <th className="py-2 pr-4">{t('isSystemAdmin')}</th>
                  <th className="py-2 pr-4">{t('createdAt')}</th>
                  <th className="py-2 pr-4">{t('operations')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b align-top">
                    <td className="py-3 pr-4 font-medium text-gray-900">
                      {u.email}
                    </td>
                    <td className="py-3 pr-4 text-gray-700">{u.name || t('empty')}</td>
                    <td className="py-3 pr-4 text-gray-700">
                      {u.isSystemAdmin ? t('yes') : t('no')}
                    </td>
                    <td className="py-3 pr-4 text-gray-700">
                      {new Date(u.createdAt).toLocaleString(locale, {
                        hour12: false
                      })}
                    </td>
                    <td className="py-3 pr-4">
                      <UserActionsMenu
                        userId={u.id}
                        canPromote={
                          canPromote &&
                          !u.isSystemAdmin &&
                          !SUPER_ADMIN_ACCOUNTS.has(u.email)
                        }
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
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
