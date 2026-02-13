import 'server-only';

import { createHmac } from 'node:crypto';
import { env } from '@/lib/env';
import { getCoreInstanceId, getEnhancedConfig, getEnhancedSessionTokens, setEnhancedSessionTokens, setLastSuccessfulHeartbeat } from '@/lib/enhanced/state';
import type { EnhancedAuthMode, EnhancedConfig } from '@/lib/enhanced/state';
import type { RuntimeDiffApplyStats } from '@/lib/runtime/apply-runtime-diff';

export type EnhancedDisconnectReason =
  | 'not_configured'
  | 'unreachable'
  | 'unauthorized'
  | 'forbidden'
  | 'conflict'
  | 'locked'
  | 'invalid';

export type EnhancedConnectionState =
  | {
      connected: false;
      reason: EnhancedDisconnectReason;
    }
  | { connected: true };

export type EnhancedSystemStatus = EnhancedConnectionState & {
  licenseStatus: 'unknown' | 'unactivated' | 'trial' | 'active' | 'expired' | 'locked';
  expiresAt?: string | null;
  serverTime?: string | null;
  instanceId?: string | null;
  lastSeenAt?: string | null;
};

type RequestContextOptions = {
  includeSessionToken?: boolean;
  method: string;
  path: string;
  endpointOverride?: string | null;
  configOverride?: Partial<EnhancedConfig> & {
    endpoint?: string | null;
    authMode?: EnhancedAuthMode;
  };
};

async function getRequestContext(options: RequestContextOptions) {
  const stored = await getEnhancedConfig();
  const config = options.configOverride ? { ...stored, ...options.configOverride } : stored;
  const override =
    typeof options.endpointOverride === 'string'
      ? options.endpointOverride.trim()
      : typeof options.configOverride?.endpoint === 'string'
        ? options.configOverride.endpoint.trim()
        : '';
  const endpoint = override || config.endpoint || env.ENHANCED_SERVICE_URL || null;
  const headers: Record<string, string> = {
    'content-type': 'application/json'
  };

  const instanceId = await getCoreInstanceId();

  headers['x-core-instance-id'] = instanceId;

  if (config.authMode === 'client_credentials') {
    if (config.clientId && config.clientSecret) {
      const timestamp = new Date().toISOString();
      const payload = [options.method, options.path, instanceId, timestamp].join('\n');
      const signature = createHmac('sha256', config.clientSecret).update(payload).digest('hex');
      headers['x-core-client-id'] = config.clientId;
      headers['x-core-signature'] = signature;
      headers['x-core-timestamp'] = timestamp;
    }
  } else {
    const secret = config.sharedSecret || env.ENHANCED_CORE_SECRET;
    if (secret) {
      headers['x-core-secret'] = secret;
    }
  }

  if (options.includeSessionToken) {
    const { currentToken } = await getEnhancedSessionTokens();
    if (currentToken) {
      headers['x-tms-session-token'] = currentToken;
    }
  }
  return { endpoint, headers };
}

function resolveFailureReason(status: number): EnhancedDisconnectReason {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 409) return 'conflict';
  if (status === 423) return 'locked';
  if (status === 422) return 'invalid';
  return 'unreachable';
}

export async function getEnhancedSystemStatus(options?: {
  endpointOverride?: string | null;
  configOverride?: Partial<EnhancedConfig> & {
    endpoint?: string | null;
    authMode?: EnhancedAuthMode;
  };
}): Promise<EnhancedSystemStatus> {
  const ctx = await getRequestContext({
    method: 'GET',
    path: '/api/internal/system/status',
    endpointOverride: options?.endpointOverride,
    configOverride: options?.configOverride
  });
  if (!ctx.endpoint) {
    return { connected: false, reason: 'not_configured', licenseStatus: 'unknown' };
  }

  try {
    const res = await fetch(`${ctx.endpoint}/api/internal/system/status`, {
      method: 'GET',
      headers: ctx.headers,
      cache: 'no-store'
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      return {
        connected: false,
        reason: resolveFailureReason(res.status),
        licenseStatus: 'unknown'
      };
    }
    const data = json.data ?? {};
    return {
      connected: true,
      licenseStatus: data.licenseStatus ?? 'unknown',
      expiresAt: data.expiresAt ?? null,
      serverTime: data.serverTime ?? null,
      instanceId: data.instanceId ?? null,
      lastSeenAt: data.lastSeenAt ?? null
    };
  } catch {
    return { connected: false, reason: 'unreachable', licenseStatus: 'unknown' };
  }
}

export async function activateEnhancedLicense(input: {
  licenseKey: string;
  replace?: boolean;
}): Promise<EnhancedConnectionState> {
  const ctx = await getRequestContext({ method: 'POST', path: '/api/internal/license/activate' });
  if (!ctx.endpoint) {
    return { connected: false, reason: 'not_configured' };
  }

  try {
    const payload = input.replace ? { licenseKey: input.licenseKey, replace: true } : { licenseKey: input.licenseKey };
    const res = await fetch(`${ctx.endpoint}/api/internal/license/activate`, {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify(payload),
      cache: 'no-store'
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      return { connected: false, reason: resolveFailureReason(res.status) };
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
  const ctx = await getRequestContext({ method: 'POST', path: '/api/internal/platform-api-config' });
  if (!ctx.endpoint) {
    return { connected: false, reason: 'not_configured' };
  }

  try {
    const res = await fetch(`${ctx.endpoint}/api/internal/platform-api-config`, {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify(input),
      cache: 'no-store'
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      return { connected: false, reason: resolveFailureReason(res.status) };
    }
    return { connected: true };
  } catch {
    return { connected: false, reason: 'unreachable' };
  }
}

export async function heartbeatEnhanced(): Promise<EnhancedConnectionState> {
  const ctx = await getRequestContext({
    method: 'POST',
    path: '/api/internal/heartbeat',
    includeSessionToken: true
  });
  if (!ctx.endpoint) {
    return { connected: false, reason: 'not_configured' };
  }

  try {
    const res = await fetch(`${ctx.endpoint}/api/internal/heartbeat`, {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify({}),
      cache: 'no-store'
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok || !json?.data?.sessionToken) {
      return { connected: false, reason: resolveFailureReason(res.status) };
    }

    const { currentToken } = await getEnhancedSessionTokens();
    await setEnhancedSessionTokens({
      currentToken: json.data.sessionToken,
      previousToken: currentToken
    });
    await setLastSuccessfulHeartbeat(new Date());

    return { connected: true };
  } catch {
    return { connected: false, reason: 'unreachable' };
  }
}

export async function connectRuntimeSession(input: {
  projectId: number;
  sdkIdentity?: string;
  env?: 'prod' | 'staging' | 'dev';
}): Promise<EnhancedConnectionState & { sessionId?: number }> {
  const ctx = await getRequestContext({ method: 'POST', path: '/api/internal/runtime/session/connect' });
  if (!ctx.endpoint) {
    return { connected: false, reason: 'not_configured' };
  }

  try {
    const res = await fetch(`${ctx.endpoint}/api/internal/runtime/session/connect`, {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify(input),
      cache: 'no-store'
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      return { connected: false, reason: resolveFailureReason(res.status) };
    }
    const data = json.data ?? {};
    return { connected: true, sessionId: typeof data.sessionId === 'number' ? data.sessionId : undefined };
  } catch {
    return { connected: false, reason: 'unreachable' };
  }
}

export async function ingestRuntimeEvent(input: {
  projectId: number;
  sessionId?: number;
  route: string;
  key: string;
  sourceText: string;
  occurredAt?: string;
  meta?: unknown;
}): Promise<EnhancedConnectionState> {
  const ctx = await getRequestContext({ method: 'POST', path: '/api/internal/runtime/events/ingest' });
  if (!ctx.endpoint) {
    return { connected: false, reason: 'not_configured' };
  }

  try {
    const res = await fetch(`${ctx.endpoint}/api/internal/runtime/events/ingest`, {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify(input),
      cache: 'no-store'
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      return { connected: false, reason: resolveFailureReason(res.status) };
    }
    return { connected: true };
  } catch {
    return { connected: false, reason: 'unreachable' };
  }
}

export type RuntimeEventsQuery = {
  projectId: number;
  route?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export type RuntimeEventsResult = {
  page: number;
  pageSize: number;
  total: number;
  items: Array<{
    route: string;
    key: string;
    sourceText: string;
    count: number;
    lastSeenAt: string;
    lastSessionId: number | null;
  }>;
};

export async function listRuntimeEvents(input: RuntimeEventsQuery): Promise<EnhancedConnectionState & { data?: RuntimeEventsResult }> {
  const ctx = await getRequestContext({ method: 'GET', path: '/api/internal/runtime/events' });
  if (!ctx.endpoint) {
    return { connected: false, reason: 'not_configured' };
  }

  const params = new URLSearchParams();
  params.set('projectId', String(input.projectId));
  if (input.route) params.set('route', input.route);
  if (input.search) params.set('search', input.search);
  if (input.from) params.set('from', input.from);
  if (input.to) params.set('to', input.to);
  if (typeof input.page === 'number') params.set('page', String(input.page));
  if (typeof input.pageSize === 'number') params.set('pageSize', String(input.pageSize));

  try {
    const res = await fetch(`${ctx.endpoint}/api/internal/runtime/events?${params.toString()}`, {
      method: 'GET',
      headers: ctx.headers,
      cache: 'no-store'
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok || !json?.data) {
      return { connected: false, reason: resolveFailureReason(res.status) };
    }
    return { connected: true, data: json.data as RuntimeEventsResult };
  } catch {
    return { connected: false, reason: 'unreachable' };
  }
}

export type RuntimeDiffInput = {
  projectId: number;
  sessionId?: number;
  route: string;
  pageId?: number | null;
  sdkKeys: Array<{ key: string; sourceText: string; suggestedModuleName?: string | null }>;
  coreEntries: Array<{ key: string; entryId: number }>;
  corePlacements: Array<{ key: string; entryId: number; moduleId: number; moduleName: string }>;
};

export type RuntimeDiffResult = {
  items: any[];
  summary: { routeCount: number; added: number; moved: number; deleteSuggested: number; total: number };
};

export async function computeRuntimeDiff(input: RuntimeDiffInput): Promise<EnhancedConnectionState & { data?: RuntimeDiffResult }> {
  const ctx = await getRequestContext({ method: 'POST', path: '/api/internal/runtime/diff' });
  if (!ctx.endpoint) {
    return { connected: false, reason: 'not_configured' };
  }

  try {
    const res = await fetch(`${ctx.endpoint}/api/internal/runtime/diff`, {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify(input),
      cache: 'no-store'
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok || !json?.data) {
      return { connected: false, reason: resolveFailureReason(res.status) };
    }
    return { connected: true, data: json.data as RuntimeDiffResult };
  } catch {
    return { connected: false, reason: 'unreachable' };
  }
}

export type RuntimeDiffApplyInput = {
  projectId: number;
  route: string;
  coreBaseUrl: string;
  operations: Array<{
    kind: 'unregistered' | 'add' | 'move' | 'delete_suggestion';
    key: string;
    sourceText?: string;
    entryId?: number | null;
    currentModuleId?: number | null;
    action: 'ignore' | 'bind' | 'delete';
    targetPageId?: number | null;
    targetModuleId?: number | null;
  }>;
};

export async function applyRuntimeDiffViaEnhanced(
  input: RuntimeDiffApplyInput
): Promise<EnhancedConnectionState & { data?: { applyId: string; stats?: RuntimeDiffApplyStats | null } }> {
  const ctx = await getRequestContext({ method: 'POST', path: '/api/internal/runtime/diff/apply' });
  if (!ctx.endpoint) {
    return { connected: false, reason: 'not_configured' };
  }

  try {
    const res = await fetch(`${ctx.endpoint}/api/internal/runtime/diff/apply`, {
      method: 'POST',
      headers: ctx.headers,
      body: JSON.stringify(input),
      cache: 'no-store'
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      return { connected: false, reason: resolveFailureReason(res.status) };
    }
    return { connected: true, data: json.data ?? { applyId: '', stats: null } };
  } catch {
    return { connected: false, reason: 'unreachable' };
  }
}
