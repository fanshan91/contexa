import 'server-only';

import { env } from '@/lib/env';

export type EnhancedConnectionState =
  | { connected: false; reason: 'not_configured' | 'unreachable' }
  | { connected: true };

export type EnhancedSystemStatus =
  | (EnhancedConnectionState & {
      licenseStatus: 'unknown';
    })
  | (EnhancedConnectionState & {
      licenseStatus: 'unactivated' | 'active' | 'expired';
      expiresAt?: string | null;
    });

function getHeaders() {
  const headers: Record<string, string> = {
    'content-type': 'application/json'
  };

  if (env.ENHANCED_CORE_SECRET) {
    headers['x-core-secret'] = env.ENHANCED_CORE_SECRET;
  }
  if (env.CORE_INSTANCE_ID) {
    headers['x-core-instance-id'] = env.CORE_INSTANCE_ID;
  }
  return headers;
}

export async function getEnhancedSystemStatus(): Promise<EnhancedSystemStatus> {
  if (!env.ENHANCED_SERVICE_URL) {
    return { connected: false, reason: 'not_configured', licenseStatus: 'unknown' };
  }

  try {
    const res = await fetch(`${env.ENHANCED_SERVICE_URL}/api/system/status`, {
      method: 'GET',
      headers: getHeaders(),
      cache: 'no-store'
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      return { connected: false, reason: 'unreachable', licenseStatus: 'unknown' };
    }
    return {
      connected: true,
      licenseStatus: json.data?.licenseStatus ?? 'unknown',
      expiresAt: json.data?.expiresAt ?? null
    };
  } catch {
    return { connected: false, reason: 'unreachable', licenseStatus: 'unknown' };
  }
}

export async function activateEnhancedLicense(input: {
  licenseKey: string;
}): Promise<EnhancedConnectionState> {
  if (!env.ENHANCED_SERVICE_URL) {
    return { connected: false, reason: 'not_configured' };
  }

  try {
    const res = await fetch(`${env.ENHANCED_SERVICE_URL}/api/system/activate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(input),
      cache: 'no-store'
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      return { connected: false, reason: 'unreachable' };
    }
    return { connected: true };
  } catch {
    return { connected: false, reason: 'unreachable' };
  }
}

export type PlatformApiConfigInput = {
  llmProvider?: string;
  llmBaseUrl?: string;
  llmApiKey?: string;
  llmModel?: string;
  mtProvider?: string;
  mtBaseUrl?: string;
  mtApiKey?: string;
};

export async function savePlatformApiConfig(
  input: PlatformApiConfigInput
): Promise<EnhancedConnectionState> {
  if (!env.ENHANCED_SERVICE_URL) {
    return { connected: false, reason: 'not_configured' };
  }

  try {
    const res = await fetch(`${env.ENHANCED_SERVICE_URL}/api/system/platform-api-config`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(input),
      cache: 'no-store'
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      return { connected: false, reason: 'unreachable' };
    }
    return { connected: true };
  } catch {
    return { connected: false, reason: 'unreachable' };
  }
}

