export function sdkV2UpgradeGone(path: string) {
  return Response.json(
    {
      ok: false,
      error: {
        code: 'SDK_V2_REQUIRED',
        message: `Endpoint ${path} has been removed. Please upgrade SDK to V2 endpoints under /api/sdk/v2/*`,
        upgrade_hint: {
          docs: '/docs/SDK',
          open: '/api/sdk/v2/session/open',
          heartbeat: '/api/sdk/v2/session/heartbeat',
          capture: '/api/sdk/v2/capture/batch',
          close: '/api/sdk/v2/session/close',
          status: '/api/sdk/v2/session/status'
        }
      }
    },
    { status: 410 }
  );
}
