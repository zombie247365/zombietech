'use client';
import { statusLabel, statusPill } from '../../lib/format';

export function Badge({ status, label }: { status: string; label?: string }) {
  return <span className={statusPill(status)}>{label ?? statusLabel(status)}</span>;
}
