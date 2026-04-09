export function formatZAR(cents: number | string | bigint | null | undefined): string {
  if (cents === null || cents === undefined) return 'R0.00';
  const n = Number(cents);
  if (isNaN(n)) return 'R0.00';
  return 'R' + (n / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function statusPill(status: string): string {
  const map: Record<string, string> = {
    active: 'pill-green', completed: 'pill-green', released: 'pill-green',
    approved: 'pill-green', pass: 'pill-green', clean: 'pill-green',
    open: 'pill-amber', pending: 'pill-amber', ready: 'pill-blue',
    scheduled: 'pill-blue', under_review: 'pill-blue', in_notice: 'pill-amber',
    flagged: 'pill-red', disputed: 'pill-red', failed: 'pill-red',
    declined: 'pill-red', rejected: 'pill-red', breach: 'pill-red',
    cancelled: 'pill-gray', terminated: 'pill-gray', expired: 'pill-gray',
    held: 'pill-purple', inconclusive: 'pill-amber',
  };
  return map[status] ?? 'pill-gray';
}

export function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatPct(pct: number | string | null | undefined): string {
  if (pct === null || pct === undefined) return '—';
  return Number(pct).toFixed(2).replace(/\.00$/, '') + '%';
}
