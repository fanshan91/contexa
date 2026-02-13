export const RUNTIME_SESSION_STALE_MS = 60_000;
export const RUNTIME_CAPTURE_GATE_PRESENCE_TTL_MS = 2 * 60 * 60 * 1000;

export function isRuntimeSessionStale(input: { lastSeenAt: Date | null | undefined; now: Date; staleMs?: number }) {
  const staleMs = typeof input.staleMs === 'number' ? input.staleMs : RUNTIME_SESSION_STALE_MS;
  const lastSeenAt = input.lastSeenAt;
  if (!lastSeenAt) return true;
  return input.now.getTime() - lastSeenAt.getTime() > staleMs;
}

export function isRuntimeCaptureGateOpen(input: {
  status: string | null | undefined;
  sessionId?: number | null | undefined;
  openedAt?: Date | null | undefined;
  userLastSeenAt?: Date | null | undefined;
  now: Date;
  ttlMs?: number;
}) {
  return getRuntimeCaptureGateOpenInfo(input).open;
}

export function getRuntimeCaptureGateOpenInfo(input: {
  status: string | null | undefined;
  sessionId?: number | null | undefined;
  openedAt?: Date | null | undefined;
  userLastSeenAt?: Date | null | undefined;
  now: Date;
  ttlMs?: number;
}): {
  open: boolean;
  reason: 'open' | 'status_not_open' | 'missing_session' | 'missing_opened_at' | 'expired';
  ttlMs: number;
  expiresAt: Date | null;
} {
  const ttlMs = typeof input.ttlMs === 'number' ? input.ttlMs : RUNTIME_CAPTURE_GATE_PRESENCE_TTL_MS;

  if (input.status !== 'open') {
    return { open: false, reason: 'status_not_open', ttlMs, expiresAt: null };
  }

  const sessionId = input.sessionId ?? null;
  if (!sessionId) {
    return { open: false, reason: 'missing_session', ttlMs, expiresAt: null };
  }

  const openedAt = input.openedAt ?? null;
  if (!openedAt) {
    return { open: false, reason: 'missing_opened_at', ttlMs, expiresAt: null };
  }

  const expiresAt = new Date(openedAt.getTime() + ttlMs);
  const open = input.now.getTime() <= expiresAt.getTime();
  return { open, reason: open ? 'open' : 'expired', ttlMs, expiresAt };
}
