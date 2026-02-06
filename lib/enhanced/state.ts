import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/lib/env';

const KEYS = {
  instanceId: 'core.instance_id',
  sessionCurrent: 'core.enhanced.session.current',
  sessionPrevious: 'core.enhanced.session.previous',
  lastHeartbeatSuccess: 'core.enhanced.heartbeat.last_success',
  enhancedEndpoint: 'core.enhanced.endpoint',
  enhancedAuthMode: 'core.enhanced.auth_mode',
  enhancedSharedSecret: 'core.enhanced.shared_secret',
  enhancedClientId: 'core.enhanced.client_id',
  enhancedClientSecret: 'core.enhanced.client_secret'
} as const;

async function getMetaValue(key: string): Promise<string | null> {
  const row = await prisma.systemMeta.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function setMetaValue(key: string, value: string): Promise<void> {
  await prisma.systemMeta.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  });
}

export async function getCoreInstanceId(): Promise<string> {
  if (env.CORE_INSTANCE_ID) return env.CORE_INSTANCE_ID;

  const existing = await getMetaValue(KEYS.instanceId);
  if (existing) return existing;

  const created = randomUUID();
  await setMetaValue(KEYS.instanceId, created);
  return created;
}

export async function getEnhancedSessionTokens(): Promise<{
  currentToken: string | null;
  previousToken: string | null;
}> {
  const [currentToken, previousToken] = await Promise.all([
    getMetaValue(KEYS.sessionCurrent),
    getMetaValue(KEYS.sessionPrevious)
  ]);
  return { currentToken, previousToken };
}

export async function setEnhancedSessionTokens(input: {
  currentToken: string;
  previousToken: string | null;
}): Promise<void> {
  await Promise.all([
    setMetaValue(KEYS.sessionCurrent, input.currentToken),
    input.previousToken === null
      ? prisma.systemMeta.delete({ where: { key: KEYS.sessionPrevious } }).catch(() => null)
      : setMetaValue(KEYS.sessionPrevious, input.previousToken)
  ]);
}

export async function setLastSuccessfulHeartbeat(at: Date): Promise<void> {
  await setMetaValue(KEYS.lastHeartbeatSuccess, at.toISOString());
}

export async function getLastSuccessfulHeartbeat(): Promise<Date | null> {
  const value = await getMetaValue(KEYS.lastHeartbeatSuccess);
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export type EnhancedAuthMode = 'shared_secret' | 'client_credentials';

export type EnhancedConfig = {
  endpoint: string | null;
  authMode: EnhancedAuthMode;
  sharedSecret: string | null;
  clientId: string | null;
  clientSecret: string | null;
};

export async function getEnhancedConfig(): Promise<EnhancedConfig> {
  const [endpoint, authMode, sharedSecret, clientId, clientSecret] = await Promise.all([
    getMetaValue(KEYS.enhancedEndpoint),
    getMetaValue(KEYS.enhancedAuthMode),
    getMetaValue(KEYS.enhancedSharedSecret),
    getMetaValue(KEYS.enhancedClientId),
    getMetaValue(KEYS.enhancedClientSecret)
  ]);

  return {
    endpoint,
    authMode: authMode === 'client_credentials' ? 'client_credentials' : 'shared_secret',
    sharedSecret,
    clientId,
    clientSecret
  };
}

export async function setEnhancedConfig(input: {
  endpoint: string;
  authMode: EnhancedAuthMode;
  sharedSecret?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
}): Promise<void> {
  await setMetaValue(KEYS.enhancedEndpoint, input.endpoint);
  await setMetaValue(KEYS.enhancedAuthMode, input.authMode);

  if (typeof input.sharedSecret === 'string') {
    await setMetaValue(KEYS.enhancedSharedSecret, input.sharedSecret);
  }
  if (typeof input.clientId === 'string') {
    await setMetaValue(KEYS.enhancedClientId, input.clientId);
  }
  if (typeof input.clientSecret === 'string') {
    await setMetaValue(KEYS.enhancedClientSecret, input.clientSecret);
  }
}
