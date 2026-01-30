'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { signIn, signUp } from './actions';
import { ActionState } from '@/lib/auth/middleware';
import { FormError } from '@/components/form-error';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Card } from '@/components/ui/card';
import { LogoMark } from '@/components/brand/logo-mark';

const REMEMBER_FLAG_KEY = 'contexa_login_remember';
const REMEMBER_EMAIL_KEY = 'contexa_login_email';
const REMEMBER_PASSWORD_KEY = 'contexa_login_password';

export function Login({ mode = 'signin' }: { mode?: 'signin' | 'signup' }) {
  const t = useTranslations('login');
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');
  const priceId = searchParams.get('priceId');
  const inviteId = searchParams.get('inviteId');
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    mode === 'signin' ? signIn : signUp,
    { error: '' }
  );
  const [email, setEmail] = useState(state.email ?? '');
  const [password, setPassword] = useState(state.password ?? '');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (state.email !== undefined) {
      setEmail(state.email);
    }
    if (state.password !== undefined) {
      setPassword(state.password);
    }
  }, [state.email, state.password]);

  useEffect(() => {
    if (mode !== 'signin') return;
    if (typeof window === 'undefined') return;

    const storedFlag = window.localStorage.getItem(REMEMBER_FLAG_KEY);
    if (storedFlag === '1') {
      setRememberMe(true);
      const storedEmail = window.localStorage.getItem(REMEMBER_EMAIL_KEY);
      const storedPassword = window.localStorage.getItem(REMEMBER_PASSWORD_KEY);
      if (!state.email && storedEmail) {
        setEmail(storedEmail);
      }
      if (!state.password && storedPassword) {
        setPassword(storedPassword);
      }
    } else {
      setRememberMe(true);
    }
  }, [mode, state.email, state.password]);

  useEffect(() => {
    if (mode !== 'signin') return;
    if (typeof window === 'undefined') return;

    if (!rememberMe) {
      window.localStorage.removeItem(REMEMBER_FLAG_KEY);
      window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
      window.localStorage.removeItem(REMEMBER_PASSWORD_KEY);
      return;
    }

    window.localStorage.setItem(REMEMBER_FLAG_KEY, '1');
    window.localStorage.setItem(REMEMBER_EMAIL_KEY, email || '');
    window.localStorage.setItem(REMEMBER_PASSWORD_KEY, password || '');
  }, [mode, rememberMe, email, password]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-end pb-4">
          <LanguageSwitcher />
        </div>

        <Card
          headerClassName="gap-3"
          header={
            <>
              <div className="flex items-center justify-center gap-2">
                <LogoMark className="h-8 w-8 text-primary" />
                <span className="text-lg font-semibold">Contexa</span>
              </div>
              <div className="text-center text-2xl leading-none font-semibold">
                {mode === 'signin' ? t('titleSignIn') : t('titleSignUp')}
              </div>
            </>
          }
          contentClassName="space-y-6"
        >
            <form className="space-y-4" action={formAction}>
              <input type="hidden" name="redirect" value={redirect || ''} />
              <input type="hidden" name="priceId" value={priceId || ''} />
              <input type="hidden" name="inviteId" value={inviteId || ''} />

              <div className="space-y-2">
                <Label htmlFor="email">{t('accountLabel')}</Label>
                <Input
                  id="email"
                  name="email"
                  type="text"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  minLength={mode === 'signin' ? 5 : 6}
                  maxLength={50}
                  pattern="[A-Za-z0-9.@]+"
                  placeholder={t('accountPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t('passwordLabel')}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={
                      mode === 'signin' ? 'current-password' : 'new-password'
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    maxLength={100}
                    pattern="[A-Za-z0-9.@]+"
                    placeholder={t('passwordPlaceholder')}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? t('passwordHide') : t('passwordShow')}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {mode === 'signin' ? (
                  <p className="text-sm text-muted-foreground">
                    {t('forgotPasswordHint')}
                  </p>
                ) : null}
              </div>

              {mode === 'signin' ? (
                <label
                  htmlFor="rememberMe"
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <input
                    id="rememberMe"
                    name="rememberMe"
                    type="checkbox"
                    className="size-4 rounded border border-input bg-transparent text-primary outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>{t('rememberMeLabel')}</span>
                </label>
              ) : null}

              <FormError message={state?.error} />

              <Button type="submit" className="w-full" size="lg" disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    {t('submitLoading')}
                  </>
                ) : mode === 'signin' ? (
                  t('submitSignIn')
                ) : (
                  t('submitSignUp')
                )}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-card px-2 text-muted-foreground">
                  {mode === 'signin'
                    ? t('switchPromptSignIn')
                    : t('switchPromptSignUp')}
                </span>
              </div>
            </div>

            <Button asChild variant="outline" className="w-full" size="lg">
              <Link
                href={`${mode === 'signin' ? '/sign-up' : '/sign-in'}${
                  redirect ? `?redirect=${redirect}` : ''
                }${priceId ? `&priceId=${priceId}` : ''}`}
              >
                {mode === 'signin' ? t('switchToSignUp') : t('switchToSignIn')}
              </Link>
            </Button>
        </Card>
      </div>
    </div>
  );
}
