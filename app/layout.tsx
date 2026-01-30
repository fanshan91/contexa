import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
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
      className={manrope.className}
    >
      <body className="min-h-[100dvh]">
        <ToastProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <DeviceGuard />
            {children}
          </NextIntlClientProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
