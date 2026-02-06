'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup } from '@/components/ui/radio-group';
import { FormError } from '@/components/form-error';
import { ActionState } from '@/lib/auth/middleware';
import { activateSystemLicense, manualConnectEnhanced, saveEnhancedConfig, testEnhancedConnection } from './actions';

export function SystemActivationDialog({
  triggerLabel,
  disabled
}: {
  triggerLabel: string;
  disabled?: boolean;
}) {
  const t = useTranslations('systemActivation');
  const [open, setOpen] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [formState, formAction, pending] = useActionState<ActionState, FormData>(
    activateSystemLicense,
    { error: '' }
  );

  const canSubmit = Boolean(licenseKey.trim());

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} disabled={disabled}>
        {triggerLabel}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setLicenseKey('');
          }
        }}
        title={t('formTitle')}
        description={t('connectedHint')}
        closeOnOverlayClick
        footer={
          <Button type="submit" form="system-activation-form" disabled={disabled || pending || !canSubmit}>
            {t('submit')}
          </Button>
        }
      >
        <form id="system-activation-form" action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="licenseKey">{t('licenseKeyLabel')}</Label>
            <Input
              id="licenseKey"
              name="licenseKey"
              placeholder={t('licenseKeyPlaceholder')}
              value={licenseKey}
              onChange={(event) => setLicenseKey(event.target.value)}
              disabled={disabled || pending}
              autoComplete="off"
            />
          </div>
          <FormError message={formState?.error} />
        </form>
      </Dialog>
    </>
  );
}

export function ManualConnectButton({
  label,
  disabled
}: {
  label: string;
  disabled?: boolean;
}) {
  const t = useTranslations('dashboardEnhanced');
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    manualConnectEnhanced,
    { error: '' }
  );
  const hasRefreshed = useRef(false);
  const statusMessage = pending ? t('manualConnectPending') : state?.success;

  useEffect(() => {
    if (pending) {
      hasRefreshed.current = false;
      return;
    }
    if (state?.success && !hasRefreshed.current) {
      hasRefreshed.current = true;
      router.refresh();
    }
  }, [pending, router, state?.success]);

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <Button type="submit" variant="secondary" disabled={disabled || pending}>
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {pending ? t('manualConnectPending') : label}
      </Button>
      <FormError message={state?.error} />
      {statusMessage ? (
        <div className={pending ? 'text-sm text-muted-foreground' : 'text-sm text-success'}>
          {statusMessage}
        </div>
      ) : null}
    </form>
  );
}

type EnhancedConfigFormProps = {
  initialConfig: {
    endpoint: string;
    authMode: 'shared_secret' | 'client_credentials';
    clientId: string;
    hasSharedSecret: boolean;
    hasClientSecret: boolean;
  };
  disabled?: boolean;
};

export function EnhancedConfigForm({ initialConfig, disabled }: EnhancedConfigFormProps) {
  const t = useTranslations('dashboardEnhanced');
  const [authMode, setAuthMode] = useState(initialConfig.authMode);
  const [endpoint, setEndpoint] = useState(initialConfig.endpoint);
  const [clientId, setClientId] = useState(initialConfig.clientId);
  const [sharedSecret, setSharedSecret] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [saveState, saveAction, savePending] = useActionState<ActionState, FormData>(
    saveEnhancedConfig,
    { error: '' }
  );
  const [testState, testAction, testPending] = useActionState<ActionState, FormData>(
    testEnhancedConnection,
    { error: '' }
  );

  const sharedSecretPlaceholder = initialConfig.hasSharedSecret
    ? t('secretConfiguredPlaceholder')
    : t('secretPlaceholder');
  const clientSecretPlaceholder = initialConfig.hasClientSecret
    ? t('secretConfiguredPlaceholder')
    : t('secretPlaceholder');

  const isSharedSecret = authMode === 'shared_secret';
  const isClientCredentials = authMode === 'client_credentials';
  const trimmedEndpoint = endpoint.trim();
  const hasSharedSecret = Boolean(sharedSecret.trim()) || initialConfig.hasSharedSecret;
  const hasClientId = Boolean(clientId.trim());
  const hasClientSecret = Boolean(clientSecret.trim()) || initialConfig.hasClientSecret;
  const canTest = Boolean(trimmedEndpoint) && (isSharedSecret ? hasSharedSecret : hasClientId && hasClientSecret);

  return (
    <div className="space-y-4">
      <form action={saveAction} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="endpoint" className="mb-2">
              {t('endpointLabel')}
            </Label>
            <Input
              id="endpoint"
              name="endpoint"
              placeholder={t('endpointPlaceholder')}
              value={endpoint}
              onChange={(event) => setEndpoint(event.target.value)}
              disabled={disabled}
              autoComplete="off"
            />
          </div>

          <div className="sm:col-span-2 space-y-2">
            <Label>{t('authModeLabel')}</Label>
            <RadioGroup
              name="authMode"
              value={authMode}
              onValueChange={(value) =>
                setAuthMode(value === 'client_credentials' ? 'client_credentials' : 'shared_secret')
              }
              disabled={disabled}
              options={[
                { value: 'shared_secret', label: <span>{t('authModeShared')}</span> },
                { value: 'client_credentials', label: <span>{t('authModeClient')}</span> }
              ]}
            />
          </div>

          {isSharedSecret ? (
            <div className="sm:col-span-2">
              <Label htmlFor="sharedSecret" className="mb-2">
                {t('sharedSecretLabel')}
              </Label>
              <Input
                id="sharedSecret"
                name="sharedSecret"
                type="password"
                placeholder={sharedSecretPlaceholder}
                value={sharedSecret}
                onChange={(event) => setSharedSecret(event.target.value)}
                disabled={disabled}
                autoComplete="off"
              />
            </div>
          ) : null}

          {isClientCredentials ? (
            <>
              <div>
                <Label htmlFor="clientId" className="mb-2">
                  {t('clientIdLabel')}
                </Label>
                <Input
                  id="clientId"
                  name="clientId"
                  placeholder={t('clientIdPlaceholder')}
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  disabled={disabled}
                  autoComplete="off"
                />
              </div>
              <div>
                <Label htmlFor="clientSecret" className="mb-2">
                  {t('clientSecretLabel')}
                </Label>
                <Input
                  id="clientSecret"
                  name="clientSecret"
                  type="password"
                  placeholder={clientSecretPlaceholder}
                  value={clientSecret}
                  onChange={(event) => setClientSecret(event.target.value)}
                  disabled={disabled}
                  autoComplete="off"
                />
              </div>
            </>
          ) : null}
        </div>

        <FormError message={saveState?.error} />
        {saveState?.success ? (
          <div className="text-sm text-muted-foreground">{saveState.success}</div>
        ) : null}

        <Button type="submit" disabled={disabled || savePending}>
          {t('save')}
        </Button>
      </form>

      <form action={testAction} className="flex flex-col gap-2">
        <input type="hidden" name="endpoint" value={endpoint} />
        <input type="hidden" name="authMode" value={authMode} />
        <input type="hidden" name="sharedSecret" value={sharedSecret} />
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="clientSecret" value={clientSecret} />
        <FormError message={testState?.error} />
        {testState?.success ? (
          <div className="text-sm text-muted-foreground">{testState.success}</div>
        ) : null}
        <div>
          <Button type="submit" variant="secondary" disabled={disabled || testPending || !canTest}>
            {t('testConnection')}
          </Button>
        </div>
      </form>
    </div>
  );
}
