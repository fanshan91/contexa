import { getRuntimeCaptureGateOpenInfo, RUNTIME_CAPTURE_GATE_PRESENCE_TTL_MS } from '@/lib/runtime/session';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function run() {
  const t0 = new Date('2026-01-01T00:00:00.000Z');

  {
    const info = getRuntimeCaptureGateOpenInfo({
      status: 'open',
      sessionId: 1,
      openedAt: t0,
      userLastSeenAt: t0,
      now: new Date(t0.getTime() + 1000)
    });
    assert(info.open === true, 'expected gate open');
    assert(info.reason === 'open', 'expected reason open');
  }

  {
    const info = getRuntimeCaptureGateOpenInfo({
      status: 'closed',
      sessionId: 1,
      openedAt: t0,
      userLastSeenAt: t0,
      now: new Date(t0.getTime() + 1000)
    });
    assert(info.open === false, 'expected gate closed');
    assert(info.reason === 'status_not_open', 'expected status_not_open');
  }

  {
    const info = getRuntimeCaptureGateOpenInfo({
      status: 'open',
      sessionId: null,
      openedAt: t0,
      userLastSeenAt: t0,
      now: new Date(t0.getTime() + 1000)
    });
    assert(info.open === false, 'expected gate closed (missing session)');
    assert(info.reason === 'missing_session', 'expected missing_session');
  }

  {
    const info = getRuntimeCaptureGateOpenInfo({
      status: 'open',
      sessionId: 1,
      openedAt: new Date(t0.getTime() - (RUNTIME_CAPTURE_GATE_PRESENCE_TTL_MS + 1)),
      userLastSeenAt: t0,
      now: t0
    });
    assert(info.open === false, 'expected gate expired');
    assert(info.reason === 'expired', 'expected expired');
  }
}

run();
