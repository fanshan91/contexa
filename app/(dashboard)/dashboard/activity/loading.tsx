import { Card } from '@/components/ui/card';
import { getTranslations } from 'next-intl/server';

export default async function ActivityPageSkeleton() {
  const t = await getTranslations('activity');
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground lg:text-2xl">{t('title')}</h1>
      <Card title={t('recentActivity')} contentClassName="min-h-[88px]">
        {' '}
      </Card>
    </div>
  );
}
