import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { SWRConfig } from 'swr';
import { ToastProvider } from '@/components/ui/toast';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import DeviceGuard from '@/components/device-guard';

export const metadata: Metadata = {
  title: 'Contexa TMS (Core)',
  description: 'Context-driven translation management platform (Core).'
};

export const viewport: Viewport = {
  maximumScale: 1
};

const manrope = Manrope({ subsets: ['latin'] });

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`bg-white dark:bg-gray-950 text-black dark:text-white ${manrope.className}`}
    >
      <body className="min-h-[100dvh] bg-gray-50">
        <ToastProvider>
          <SWRConfig
            value={{
              fallback: {
                '/api/user': getUser(),
                '/api/team': getTeamForUser()
              }
            }}
          >
            <NextIntlClientProvider locale={locale} messages={messages}>
              <DeviceGuard />
              {children}
            </NextIntlClientProvider>
          </SWRConfig>
        </ToastProvider>
      </body>
    </html>
  );
}
