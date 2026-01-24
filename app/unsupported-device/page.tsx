import { getTranslations } from 'next-intl/server';
import { CircleIcon } from 'lucide-react';

export default async function UnsupportedDevicePage() {
  const t = await getTranslations('unsupportedDevice');
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="flex items-center justify-center">
          <CircleIcon className="h-8 w-8 text-orange-500" />
          <span className="ml-2 text-2xl font-semibold text-gray-900">Contexa TMS</span>
        </div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-gray-600">{t('description')}</p>
        <p className="text-gray-500">{t('hint')}</p>
        {/* <a href="/" className="inline-flex px-4 py-2 rounded bg-black text-white">
          {t('backHome')}
        </a> */}
      </div>
    </div>
  );
}
