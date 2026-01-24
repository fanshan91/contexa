'use client';

import { useEffect, useRef } from 'react';

type SessionResponse =
  | { ok: true; data: { expires: string } }
  | { ok: false; error?: unknown };

function parseExpires(payload: unknown) {
  const data = payload as SessionResponse | null | undefined;
  if (!data || data.ok !== true) return null;
  if (!data.data || typeof data.data.expires !== 'string') return null;
  return data.data.expires;
}

function computeDelayMs(expires: string) {
  const remainingMs = new Date(expires).getTime() - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 0;
  return Math.max(1000, Math.floor(remainingMs / 3));
}

export function SessionKeepAlive() {
  const stateRef = useRef<{
    timeoutId: ReturnType<typeof setTimeout> | null;
    listening: boolean;
    refreshing: boolean;
  }>({ timeoutId: null, listening: false, refreshing: false });

  useEffect(() => {
    let cancelled = false;

    const removeListeners = () => {
      if (!stateRef.current.listening) return;
      stateRef.current.listening = false;
      window.removeEventListener('mousemove', onUserActivity);
      window.removeEventListener('keydown', onUserActivity);
      window.removeEventListener('mousedown', onUserActivity);
      window.removeEventListener('touchstart', onUserActivity);
    };

    const schedule = (expires: string | null) => {
      if (stateRef.current.timeoutId) clearTimeout(stateRef.current.timeoutId);
      removeListeners();
      if (!expires) return;
      const delayMs = computeDelayMs(expires);
      stateRef.current.timeoutId = setTimeout(() => {
        if (cancelled) return;
        stateRef.current.listening = true;
        window.addEventListener('mousemove', onUserActivity, { passive: true });
        window.addEventListener('keydown', onUserActivity, { passive: true });
        window.addEventListener('mousedown', onUserActivity, { passive: true });
        window.addEventListener('touchstart', onUserActivity, { passive: true });
      }, delayMs);
    };

    const refresh = async () => {
      if (stateRef.current.refreshing) return;
      stateRef.current.refreshing = true;
      try {
        const res = await fetch('/session/refresh', {
          method: 'POST',
          cache: 'no-store'
        });
        const json = await res.json().catch(() => null);
        const expires = parseExpires(json);
        if (!cancelled) schedule(expires);
      } finally {
        stateRef.current.refreshing = false;
      }
    };

    const onUserActivity = () => {
      removeListeners();
      void refresh();
    };

    const bootstrap = async () => {
      const res = await fetch('/session', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      schedule(parseExpires(json));
    };

    void bootstrap();

    return () => {
      cancelled = true;
      if (stateRef.current.timeoutId) clearTimeout(stateRef.current.timeoutId);
      removeListeners();
    };
  }, []);

  return null;
}

