import { getProjectLocaleLabel } from '@/lib/locales';

export function randomShortId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID().slice(0, 8);
  return Math.random().toString(16).slice(2, 10);
}

export function formatDateTime(iso: string) {
  const ms = Date.parse(iso);
  const date = Number.isFinite(ms) ? new Date(ms) : new Date();
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function buildLocaleOptions(sourceLocale: string, targetLocales: string[]) {
  const seen = new Set<string>();
  const out: Array<{ code: string; label: string; kind: 'source' | 'target' }> = [];
  const add = (code: string, kind: 'source' | 'target') => {
    const trimmed = code.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push({ code: trimmed, label: getProjectLocaleLabel(trimmed), kind });
  };
  add(sourceLocale, 'source');
  for (const l of targetLocales) add(l, 'target');
  return out;
}
