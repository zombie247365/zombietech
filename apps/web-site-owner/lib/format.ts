/**
 * Formatting utilities for ZombieTech site owner portal.
 * All monetary values from the API are cents (bigint sent as string).
 */

/** Format cents (as number or string) to ZAR display: R1,234.56 */
export function formatZAR(cents: number | string | bigint | null | undefined): string {
  if (cents === null || cents === undefined) return 'R0.00';
  const n = Number(cents);
  if (isNaN(n)) return 'R0.00';
  return 'R' + (n / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format a date string to a human-readable date */
export function formatDate(d: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-ZA', {
    year: 'numeric', month: 'short', day: 'numeric',
    ...opts,
  });
}

/** Format a datetime string */
export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('en-ZA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Format time only */
export function formatTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}

/** Status pill helper → returns CSS class name */
export function statusPill(status: string): string {
  const map: Record<string, string> = {
    active: 'pill-green',
    completed: 'pill-green',
    released: 'pill-green',
    approved: 'pill-green',
    open: 'pill-amber',
    scheduled: 'pill-blue',
    pending: 'pill-amber',
    ready: 'pill-blue',
    in_notice: 'pill-amber',
    disputed: 'pill-red',
    cancelled: 'pill-gray',
    terminated: 'pill-gray',
    expired: 'pill-gray',
    held: 'pill-purple',
    failed: 'pill-red',
    declined: 'pill-red',
    rejected: 'pill-red',
    under_review: 'pill-blue',
    resolved: 'pill-gray',
  };
  return map[status] ?? 'pill-gray';
}

/** Pretty-print a status string */
export function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format percentage: 10.00 → "10%" */
export function formatPct(pct: number | string | null | undefined): string {
  if (pct === null || pct === undefined) return '—';
  return Number(pct).toFixed(2).replace(/\.00$/, '') + '%';
}
