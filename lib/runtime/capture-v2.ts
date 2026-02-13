import crypto from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { RUNTIME_SESSION_STALE_MS } from '@/lib/runtime/session';

export type RuntimeDiffTypeV2 = 'new_key' | 'text_changed' | 'none';

export const runtimeCaptureSessionV2 = (prisma as any).runtimeCaptureSessionV2;
export const runtimeCaptureBatchV2 = (prisma as any).runtimeCaptureBatchV2;
export const runtimeCaptureItemV2 = (prisma as any).runtimeCaptureItemV2;
export const runtimeCaptureRouteStatV2 = (prisma as any).runtimeCaptureRouteStatV2;
export const runtimeCaptureApplyRunV2 = (prisma as any).runtimeCaptureApplyRunV2;

export function ensureRuntimeCaptureV2Models() {
  if (!runtimeCaptureSessionV2 || !runtimeCaptureBatchV2 || !runtimeCaptureItemV2 || !runtimeCaptureRouteStatV2 || !runtimeCaptureApplyRunV2) {
    throw new Error('runtime_capture_v2_unavailable');
  }
}

export function parsePositiveInt(raw: string | undefined, fallback: number) {
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

export function hashSourceText(text: string) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

export function isSessionExpired(lastSeenAt: Date | null | undefined, now: Date) {
  if (!lastSeenAt) return true;
  return now.getTime() - lastSeenAt.getTime() > RUNTIME_SESSION_STALE_MS;
}

export function computeDiffType(sourceText: string, entrySourceText: string | null): RuntimeDiffTypeV2 {
  if (entrySourceText == null) return 'new_key';
  if (entrySourceText.trim() !== sourceText.trim()) return 'text_changed';
  return 'none';
}
