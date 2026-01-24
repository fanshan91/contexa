import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth/session';
import createIntlMiddleware from 'next-intl/middleware';
import { defaultLocale, locales } from '@/i18n/routing';

const publicPaths = ['/sign-in', '/sign-up', '/unsupported-device'];
const intlMiddleware = createIntlMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: 'never'
});

function buildRedirectToSignInUrl(request: NextRequest) {
  const url = request.nextUrl.clone();
  const redirectPath = `${url.pathname}${url.search}`;
  url.pathname = '/sign-in';
  url.search = '';
  url.searchParams.set('redirect', redirectPath);
  return url;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('session');
  const isPublicPath = publicPaths.some((p) => pathname === p);
  const requiresAuth = !isPublicPath;

  const ua = request.headers.get('user-agent') || '';
  const hasIPhone = /iPhone|iPod/i.test(ua);
  const isAndroidPhone = /Android/i.test(ua) && /Mobile/i.test(ua);
  const isIPad = /iPad/i.test(ua);
  const isPhoneUA = (hasIPhone || isAndroidPhone) && !isIPad;

  if (!isPublicPath && isPhoneUA) {
    const url = request.nextUrl.clone();
    url.pathname = '/unsupported-device';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (requiresAuth && !sessionCookie) {
    return NextResponse.redirect(buildRedirectToSignInUrl(request));
  }

  // const res = intlMiddleware(request);
  // 由于项目没有 [locale] 目录结构，不能使用 intlMiddleware 进行路由重写，否则会导致 404
  const res = NextResponse.next();

  if (sessionCookie) {
    try {
      await verifyToken(sessionCookie.value);
    } catch {
      res.cookies.delete('session');
      if (requiresAuth) {
        return NextResponse.redirect(buildRedirectToSignInUrl(request));
      }
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
  runtime: 'nodejs'
};
