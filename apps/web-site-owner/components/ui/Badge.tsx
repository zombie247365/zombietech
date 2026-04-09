'use client';
import { statusLabel, statusPill } from '../../lib/format';

interface BadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function Badge({ status, label, className = '' }: BadgeProps) {
  return (
    <span className={`${statusPill(status)} ${className}`}>
      {label ?? statusLabel(status)}
    </span>
  );
}
