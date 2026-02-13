import * as React from 'react';

type AdaptivePollingOptions = {
  enabled: boolean;
  poll: () => Promise<{ hasWork: boolean }>;
  delaysMs?: number[];
  pauseWhenHidden?: boolean;
};

export function useAdaptivePolling(options: AdaptivePollingOptions) {
  const { enabled, poll, delaysMs = [2000, 5000, 10_000, 30_000], pauseWhenHidden = true } = options;

  const pollRef = React.useRef(poll);
  pollRef.current = poll;

  const delaysRef = React.useRef(delaysMs);
  delaysRef.current = delaysMs;

  const pauseWhenHiddenRef = React.useRef(pauseWhenHidden);
  pauseWhenHiddenRef.current = pauseWhenHidden;

  const stepRef = React.useRef(0);
  const inFlightRef = React.useRef(false);
  const timerRef = React.useRef<number | null>(null);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current == null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const schedule = React.useCallback(
    (delayMs: number) => {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        void run('timer');
      }, delayMs);
    },
    [clearTimer]
  );

  const run = React.useCallback(
    async (_reason: 'timer' | 'focus' | 'visibility' | 'start') => {
      if (!enabled) return;
      if (pauseWhenHiddenRef.current && typeof document !== 'undefined' && document.hidden) return;
      if (inFlightRef.current) return;

      inFlightRef.current = true;
      try {
        const res = await pollRef.current();
        if (res.hasWork) {
          stepRef.current = 0;
        } else {
          stepRef.current = Math.min(stepRef.current + 1, Math.max(0, delaysRef.current.length - 1));
        }
      } finally {
        inFlightRef.current = false;
      }

      const delay = delaysRef.current[Math.min(stepRef.current, delaysRef.current.length - 1)] ?? 2000;
      schedule(delay);
    },
    [enabled, schedule]
  );

  React.useEffect(() => {
    if (!enabled) {
      clearTimer();
      return;
    }

    stepRef.current = 0;
    void run('start');

    const onFocus = () => {
      stepRef.current = 0;
      void run('focus');
    };

    const onVisibilityChange = () => {
      if (pauseWhenHiddenRef.current && document.hidden) {
        clearTimer();
        return;
      }
      stepRef.current = 0;
      void run('visibility');
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearTimer();
    };
  }, [enabled, clearTimer, run]);
}

