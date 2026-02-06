'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { validatedActionWithUser } from '@/lib/auth/middleware';
import { getTranslations } from 'next-intl/server';
import {
  activateEnhancedLicense,
  getEnhancedSystemStatus,
  heartbeatEnhanced,
  type EnhancedDisconnectReason
} from '@/lib/enhanced/client';
import { getEnhancedConfig, setEnhancedConfig } from '@/lib/enhanced/state';

const activationSchema = z.object({
  licenseKey: z.string().trim().min(1)
});

function resolveActivationError(
  t: (key: string) => string,
  reason: EnhancedDisconnectReason
) {
  if (reason === 'not_configured') return t('enhancedNotConnected');
  if (reason === 'unauthorized') return t('unauthorized');
  if (reason === 'forbidden') return t('forbidden');
  if (reason === 'locked') return t('locked');
  if (reason === 'invalid') return t('invalid');
  return t('activationFailed');
}

function resolveManualConnectError(
  t: (key: string) => string,
  reason: EnhancedDisconnectReason
) {
  if (reason === 'not_configured') return t('connectionTestNotConfigured');
  if (reason === 'unauthorized') return t('connectionTestUnauthorized');
  if (reason === 'forbidden') return t('connectionTestForbidden');
  if (reason === 'conflict') return t('connectionTestConflict');
  if (reason === 'locked') return t('connectionTestLocked');
  if (reason === 'invalid') return t('connectionTestInvalid');
  return t('connectionTestFailed');
}

export const activateSystemLicense = validatedActionWithUser(
  activationSchema,
  async (data, _, user) => {
    const t = await getTranslations('systemActivation');
    if (!user.isSystemAdmin) {
      return { error: t('noPermission') };
    }

    const res = await activateEnhancedLicense({ licenseKey: data.licenseKey });
    if (!res.connected) {
      if (res.reason === 'conflict') {
        const replaced = await activateEnhancedLicense({
          licenseKey: data.licenseKey,
          replace: true
        });
        if (replaced.connected) {
          redirect('/dashboard');
        }
        return { error: t('replaceFailed') };
      }
      return { error: resolveActivationError(t, res.reason) };
    }

    redirect('/dashboard');
  }
);

const enhancedConfigSchema = z.object({
  endpoint: z.string().trim().min(1, 'dashboardEnhanced.endpointRequired').url('dashboardEnhanced.endpointInvalid'),
  authMode: z.enum(['shared_secret', 'client_credentials']),
  sharedSecret: z.string().trim().optional(),
  clientId: z.string().trim().optional(),
  clientSecret: z.string().trim().optional()
});

export const saveEnhancedConfig = validatedActionWithUser(
  enhancedConfigSchema,
  async (data, _, user) => {
    const t = await getTranslations('dashboardEnhanced');
    if (!user.isSystemAdmin) {
      return { error: t('noPermission') };
    }

    const existing = await getEnhancedConfig();
    const sharedSecret = data.sharedSecret?.trim();
    const clientId = data.clientId?.trim();
    const clientSecret = data.clientSecret?.trim();

    if (data.authMode === 'shared_secret') {
      const hasSecret = Boolean(sharedSecret) || Boolean(existing.sharedSecret);
      if (!hasSecret) {
        return { error: t('sharedSecretRequired') };
      }
    }

    if (data.authMode === 'client_credentials') {
      const hasClientId = Boolean(clientId) || Boolean(existing.clientId);
      const hasClientSecret = Boolean(clientSecret) || Boolean(existing.clientSecret);
      if (!hasClientId || !hasClientSecret) {
        return { error: t('clientCredentialRequired') };
      }
    }

    await setEnhancedConfig({
      endpoint: data.endpoint.trim(),
      authMode: data.authMode,
      sharedSecret: sharedSecret || undefined,
      clientId: clientId || undefined,
      clientSecret: clientSecret || undefined
    });

    return { success: t('saved') };
  }
);

export const testEnhancedConnection = validatedActionWithUser(
  z.object({}),
  async (_, formData, user) => {
    const t = await getTranslations('dashboardEnhanced');
    if (!user.isSystemAdmin) {
      return { error: t('noPermission') };
    }

    const endpointValue = formData.get('endpoint');
    const authModeValue = formData.get('authMode');
    const sharedSecretValue = formData.get('sharedSecret');
    const clientIdValue = formData.get('clientId');
    const clientSecretValue = formData.get('clientSecret');

    const endpoint = typeof endpointValue === 'string' ? endpointValue.trim() : '';
    if (!endpoint) {
      return { error: t('connectionTestNotConfigured') };
    }

    const authMode = authModeValue === 'client_credentials' ? 'client_credentials' : 'shared_secret';
    const sharedSecret = typeof sharedSecretValue === 'string' ? sharedSecretValue.trim() : '';
    const clientId = typeof clientIdValue === 'string' ? clientIdValue.trim() : '';
    const clientSecret = typeof clientSecretValue === 'string' ? clientSecretValue.trim() : '';

    if (authMode === 'shared_secret' && !sharedSecret) {
      return { error: t('sharedSecretRequired') };
    }
    if (authMode === 'client_credentials' && (!clientId || !clientSecret)) {
      return { error: t('clientCredentialRequired') };
    }

    const result = await getEnhancedSystemStatus({
      configOverride: {
        endpoint,
        authMode,
        sharedSecret: sharedSecret || null,
        clientId: clientId || null,
        clientSecret: clientSecret || null
      }
    });
    if (!result.connected) {
      if (result.reason === 'not_configured') {
        return { error: t('connectionTestNotConfigured') };
      }
      if (result.reason === 'unauthorized') {
        return { error: t('connectionTestUnauthorized') };
      }
      if (result.reason === 'forbidden') {
        return { error: t('connectionTestForbidden') };
      }
      if (result.reason === 'conflict') {
        return { error: t('connectionTestConflict') };
      }
      if (result.reason === 'locked') {
        return { error: t('connectionTestLocked') };
      }
      if (result.reason === 'invalid') {
        return { error: t('connectionTestInvalid') };
      }
      return {
        error: t('connectionTestFailed')
      };
    }

    return { success: t('connectionTestSuccess') };
  }
);

export const manualConnectEnhanced = validatedActionWithUser(
  z.object({}),
  async (_, __, user) => {
    const t = await getTranslations('dashboardEnhanced');
    if (!user.isSystemAdmin) {
      return { error: t('noPermission') };
    }

    const result = await heartbeatEnhanced();
    if (!result.connected) {
      return { error: resolveManualConnectError(t, result.reason) };
    }
    return { success: t('manualConnectSuccess') };
  }
);
