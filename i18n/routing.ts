export const locales = ['zh-CN', 'en'] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = 'zh-CN';

export function isAppLocale(value: string): value is AppLocale {
  return (locales as readonly string[]).includes(value);
}

