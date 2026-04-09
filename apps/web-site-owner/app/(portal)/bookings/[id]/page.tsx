import { requireAuth } from '../../../../lib/auth';
import { api } from '../../../../lib/api';
import { TopBar } from '../../../../components/layout/TopBar';
import { Badge } from '../../../../components/ui/Badge';
import { formatDate, formatZAR } from '../../../../lib/format';
import { BookingActions } from './BookingActions';
import { ChevronLeft, Star, Calendar, Repeat } from 'lucide-react';
import Link from 'next/link';

interface Props { params: { id: string } }

export default async function BookingDetailPage({ params }: Props) {
  const token = requireAuth();
  let booking: Awaited<ReturnType<typeof api.bookings.get>>['data'] | null = null;

  try {
    const res = await api.bookings.get(params.id, token);
    booking = res.data;
  } catch {
    return (
      <>
        <TopBar title="Booking request" />
        <main className="p-6"><p className="text-sm text-red-600">Booking not found.</p></main>
      </>
    );
  }

  const b = booking;
  const slot = b.site_slot;
  const operator = b.operator;

  return (
    <>
      <TopBar
        title="Booking request"
        actions={
          <Link href="/bookings" className="btn-secondary text-xs px-3 py-1.5">
            <ChevronLeft className="w-3.5 h-3.5" /> All requests
          </Link>
        }
      />
      <main className="flex-1 p-6 max-w-2xl">
        {/* Header card */}
        <div
          className="rounded-xl border p-5 mb-4"
          style={{ background: '#eff6ff', borderColor: '#93c5fd' }}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-base font-medium" style={{ color: '#1e40af' }}>
                {operator?.trading_concept ?? 'Unnamed concept'}
              </h2>
              <p className="text-xs text-[#888] mt-0.5">
                {operator?.user?.full_name} · {operator?.user?.mobile}
              </p>
            </div>
            <Badge status={b.status} />
          </div>

          {b.concept_summary && (
            <p className="text-sm text-[#555] leading-relaxed italic mb-3">
              &ldquo;{b.concept_summary}&rdquo;
            </p>
          )}

          <div className="flex gap-4 text-xs text-[#888]">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Starts {formatDate(b.requested_start_date)}
            </span>
            <span className="flex items-center gap-1">
              <Repeat className="w-3.5 h-3.5" />
              {b.recurring ? 'Recurring weekly' : 'One-time'}
            </span>
            {operator?.trust_score != null && (
              <span className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5" />
                Trust score: {operator.trust_score}/100
              </span>
            )}
          </div>
        </div>

        {/* Slot details */}
        {slot && (
          <div className="card-white mb-4">
            <div className="section-title">Requested slot</div>
            {[
              { label: 'Site', val: slot.site?.trading_name ?? '—' },
              { label: 'Day', val: slot.day_of_week ?? '—' },
              { label: 'Hours', val: `${slot.slot_start_time} – ${slot.slot_end_time}` },
              { label: 'Session fee', val: formatZAR(slot.base_fee_cents_per_session) },
              { label: 'Upside model', val: slot.upside_model === 'fixed' ? `Fixed ${slot.upside_fixed_pct}%` : `Variable ${slot.upside_variable_pct}%` },
            ].map(({ label, val }) => (
              <div key={label} className="row-item text-xs">
                <span className="text-[#666]">{label}</span>
                <span className="font-medium capitalize">{val}</span>
              </div>
            ))}
          </div>
        )}

        {/* Operator info */}
        {operator && (
          <div className="card-white mb-4">
            <div className="section-title">Operator profile</div>
            {[
              { label: 'Name', val: operator.user?.full_name ?? '—' },
              { label: 'Food category', val: (operator as { food_category?: string }).food_category ?? '—' },
              { label: 'Trust score', val: `${operator.trust_score}/100` },
            ].map(({ label, val }) => (
              <div key={label} className="row-item text-xs">
                <span className="text-[#666]">{label}</span>
                <span className="font-medium">{val}</span>
              </div>
            ))}
          </div>
        )}

        {/* Deadline */}
        {b.status === 'pending' && (
          <div className="rounded-xl p-3 mb-4" style={{ background: '#fdf6e3', borderColor: '#f0d9a0', border: '1px solid' }}>
            <p className="text-xs" style={{ color: '#92400e' }}>
              This request expires on <strong>{formatDate(b.expires_at)}</strong>. If you don&apos;t respond, it will expire automatically.
            </p>
          </div>
        )}

        {/* Actions */}
        {b.status === 'pending' && <BookingActions bookingId={b.id} />}
      </main>
    </>
  );
}
