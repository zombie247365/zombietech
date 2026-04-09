import { requireAuth } from '../../../lib/auth';
import { api } from '../../../lib/api';
import { TopBar } from '../../../components/layout/TopBar';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { formatDate } from '../../../lib/format';
import Link from 'next/link';
import { BookOpen, Star } from 'lucide-react';

export default async function BookingsPage() {
  const token = requireAuth();
  let bookings: Awaited<ReturnType<typeof api.bookings.list>>['data'] = [];
  try {
    const res = await api.bookings.list(token);
    bookings = res.data;
  } catch { /* show empty */ }

  const pending = bookings.filter((b) => b.status === 'pending');
  const other = bookings.filter((b) => b.status !== 'pending');

  return (
    <>
      <TopBar title="Booking requests" />
      <main className="flex-1 p-6 max-w-3xl">
        {bookings.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No booking requests yet"
            description="When zombie operators request to use your kitchen, their requests will appear here."
          />
        ) : (
          <>
            {pending.length > 0 && (
              <div className="mb-6">
                <div className="section-title">Awaiting your response ({pending.length})</div>
                <div className="space-y-3">
                  {pending.map((b) => (
                    <BookingCard key={b.id} booking={b} highlight />
                  ))}
                </div>
              </div>
            )}
            {other.length > 0 && (
              <div>
                <div className="section-title">Previous requests</div>
                <div className="space-y-2">
                  {other.map((b) => (
                    <BookingCard key={b.id} booking={b} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

function BookingCard({ booking: b, highlight = false }: { booking: Awaited<ReturnType<typeof api.bookings.list>>['data'][0]; highlight?: boolean }) {
  return (
    <Link href={`/bookings/${b.id}`}>
      <div
        className={`rounded-xl border p-4 transition-colors hover:border-[#1d9e75] cursor-pointer ${highlight ? 'border-[1.5px]' : ''}`}
        style={highlight
          ? { background: '#eff6ff', borderColor: '#93c5fd' }
          : { background: '#fff', borderColor: '#e8e8e8' }}
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-sm font-medium" style={highlight ? { color: '#1e40af' } : {}}>
              {b.operator?.trading_concept ?? 'Unnamed concept'}
            </p>
            <p className="text-xs text-[#888] mt-0.5">
              {b.site_slot?.site?.trading_name ?? '—'} · {b.site_slot?.day_of_week ?? '—'}
            </p>
          </div>
          <Badge status={b.status} />
        </div>

        {b.concept_summary && (
          <p className="text-xs text-[#666] leading-relaxed mb-2 italic">&ldquo;{b.concept_summary}&rdquo;</p>
        )}

        <div className="flex items-center gap-4 text-[10px] text-[#aaa]">
          <span>Requested: {formatDate(b.requested_start_date)}</span>
          {b.status === 'pending' && <span>Expires: {formatDate(b.expires_at)}</span>}
          {b.operator?.trust_score != null && (
            <span className="flex items-center gap-0.5">
              <Star className="w-3 h-3" /> Trust score: {b.operator.trust_score}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
