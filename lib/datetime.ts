export function formatDateTimeShanghai(input: string | number | Date | null | undefined): string {
  if (!input) return '—';
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '—';

  const shanghaiMs = date.getTime() + 8 * 60 * 60 * 1000;
  const shanghai = new Date(shanghaiMs);
  const year = shanghai.getUTCFullYear();
  const month = String(shanghai.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shanghai.getUTCDate()).padStart(2, '0');
  const hours = String(shanghai.getUTCHours()).padStart(2, '0');
  const minutes = String(shanghai.getUTCMinutes()).padStart(2, '0');
  const seconds = String(shanghai.getUTCSeconds()).padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}
