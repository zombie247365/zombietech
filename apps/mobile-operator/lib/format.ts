export function formatZAR(cents: number | string | null | undefined): string {
  if (cents === null || cents === undefined) return 'R0.00';
  const n = Number(cents);
  if (isNaN(n)) return 'R0.00';
  const abs = Math.abs(n) / 100;
  const formatted = abs.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? '-R' : 'R') + formatted;
}

export function formatZARShort(cents: number | string | null | undefined): string {
  if (cents === null || cents === undefined) return 'R0';
  const n = Number(cents) / 100;
  if (n >= 1000) return `R${(n / 1000).toFixed(0)}k`;
  return `R${n.toFixed(0)}`;
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('en-ZA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}

export function statusLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
