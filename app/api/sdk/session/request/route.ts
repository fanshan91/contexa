import { sdkV2UpgradeGone } from '@/lib/runtime/sdk-v2-deprecation';

export const runtime = 'nodejs';

export async function POST() {
  return sdkV2UpgradeGone('/api/sdk/session/request');
}
