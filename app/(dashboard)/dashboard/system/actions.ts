'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { validatedActionWithUser } from '@/lib/auth/middleware';
import { getTranslations } from 'next-intl/server';
import { activateEnhancedLicense } from '@/lib/enhanced/client';

const activationSchema = z.object({
  licenseKey: z.string().min(1)
});

export const activateSystemLicense = validatedActionWithUser(
  activationSchema,
  async (data, _, user) => {
    const t = await getTranslations('systemActivation');
    if (!user.isSystemAdmin) {
      return { error: t('noPermission') };
    }

    const res = await activateEnhancedLicense({ licenseKey: data.licenseKey });
    if (!res.connected) {
      return { error: t('enhancedNotConnected') };
    }

    redirect('/dashboard');
  }
);

