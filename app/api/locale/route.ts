import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { defaultLocale, isAppLocale } from '@/i18n/routing';

export async function POST(request: NextRequest) {
  let locale = defaultLocale;

  try {
    const json = (await request.json()) as { locale?: string };
    if (json?.locale && isAppLocale(json.locale)) {
      locale = json.locale;
    }
  } catch {}

  const res = NextResponse.json({ ok: true, locale });
  res.cookies.set('NEXT_LOCALE', locale, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365
  });
  return res;
}

