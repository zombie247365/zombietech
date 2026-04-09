import { requireAuth } from '../../../lib/auth';
import { api } from '../../../lib/api';
import { TopBar } from '../../../components/layout/TopBar';
import { formatZAR, statusPill, statusLabel, formatDate } from '../../../lib/format';
import { Badge } from '../../../components/ui/Badge';
import Link from 'next/link';
import { Building2, BookOpen, Clock, Banknote, Plus, ArrowRight, AlertCircle } from 'lucide-react';

export default async function DashboardPage() {
  const token = requireAuth();

  // Fetch data in parallel
  const [sitesRes, bookingsRes, sessionsRes, settlementsRes] = await Promise.allSettled([
    api.sites.list(token),
    api.bookings.list(token, { status: 'pending', limit: '5' }),
    api.sessions.list(token, { limit: '5' }),
    api.settlements.list(token, { limit: '5' }),
  ]);

  const sites = sitesRes.status === 'fulfilled' ? sitesRes.value.data : [];
  const bookings = bookingsRes.status === 'fulfilled' ? bookingsRes.value.data : [];
  const sessions = sessionsRes.status === 'fulfilled' ? sessionsRes.value.data : [];
  const settlements = settlementsRes.status === 'fulfilled' ? settlementsRes.value.data : [];

  const activeSessions = sessions.filter((s) => s.status === 'active');
  const latestSettlement = settlements[0] ?? null;
  const pendingBookings = bookings.length;

  return (
    <>
      <TopBar
        title="Dashboard"
        actions={
          <Link href="/sites/new" className="btn-primary text-xs px-3 py-1.5">
            <Plus className="w-3.5 h-3.5" /> Add site
          </Link>
        }
      />

      <main className="flex-1 p-6 max-w-4xl">
        {/* Hero banner */}
        <div className="rounded-xl p-6 mb-5 text-white" style={{ background: '#085041' }}>
          <h1 className="text-lg font-medium mb-1">Welcome back</h1>
          <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {sites.length === 0
              ? "You don't have any sites listed yet. Add your first site to start earning."
              : `You have ${sites.length} site${sites.length > 1 ? 's' : ''} listed.${activeSessions.length > 0 ? ` ${activeSessions.length} session${activeSessions.length > 1 ? 's' : ''} in progress right now.` : ''}`
            }
          </p>
          <div className="flex gap-6">
            {[
              { val: sites.filter((s) => s.is_listed).length.toString(), lbl: 'Active sites' },
              { val: pendingBookings.toString(), lbl: 'Pending bookings' },
              { val: latestSettlement ? formatZAR(latestSettlement.operator_payout_cents) : 'R0', lbl: 'Last payout' },
            ].map(({ val, lbl }) => (
              <div key={lbl}>
                <div className="text-xl font-medium" style={{ color: '#9fe1cb' }}>{val}</div>
                <div className="text-xs mt-0.5" style={{ color: '#5dcaa5' }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Alert: pending bookings */}
        {pendingBookings > 0 && (
          <Link
            href="/bookings"
            className="flex items-center gap-3 p-3.5 rounded-xl border mb-4 transition-colors hover:bg-yellow-50"
            style={{ background: '#fdf6e3', borderColor: '#f0d9a0' }}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#92400e' }} />
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: '#92400e' }}>
                {pendingBookings} booking request{pendingBookings > 1 ? 's' : ''} awaiting your response
              </p>
              <p className="text-xs" style={{ color: '#b45309' }}>Requests expire in 48 hours</p>
            </div>
            <ArrowRight className="w-4 h-4" style={{ color: '#92400e' }} />
          </Link>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Sites */}
          <div className="card-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#1d9e75]" />
                <span className="text-xs font-medium">My sites</span>
              </div>
              <Link href="/sites" className="text-[10px] text-[#1d9e75]">View all →</Link>
            </div>
            {sites.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-xs text-[#aaa]">No sites yet</p>
                <Link href="/sites/new" className="btn-primary text-xs px-3 py-1.5 mt-3 inline-flex">
                  <Plus className="w-3 h-3" /> Add site
                </Link>
              </div>
            ) : (
              sites.slice(0, 3).map((site) => (
                <Link key={site.id} href={`/sites/${site.id}`} className="block">
                  <div className="row-item">
                    <div>
                      <p className="text-xs font-medium">{site.trading_name}</p>
                      <p className="text-[10px] text-[#aaa]">{site.suburb}, {site.city}</p>
                    </div>
                    <Badge status={site.is_listed ? 'active' : 'pending'} label={site.is_listed ? 'Listed' : 'Unlisted'} />
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Recent sessions */}
          <div className="card-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#1d9e75]" />
                <span className="text-xs font-medium">Recent sessions</span>
              </div>
              <Link href="/sessions" className="text-[10px] text-[#1d9e75]">View all →</Link>
            </div>
            {sessions.length === 0 ? (
              <p className="text-xs text-[#aaa] py-4 text-center">No sessions yet</p>
            ) : (
              sessions.slice(0, 4).map((s) => (
                <Link key={s.id} href={`/sessions/${s.id}`} className="block">
                  <div className="row-item">
                    <div>
                      <p className="text-xs font-medium">{s.session_ref}</p>
                      <p className="text-[10px] text-[#aaa]">{formatDate(s.session_date)}</p>
                    </div>
                    <Badge status={s.status} />
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Pending bookings */}
          <div className="card-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#1d9e75]" />
                <span className="text-xs font-medium">Booking requests</span>
              </div>
              <Link href="/bookings" className="text-[10px] text-[#1d9e75]">View all →</Link>
            </div>
            {bookings.length === 0 ? (
              <p className="text-xs text-[#aaa] py-4 text-center">No pending requests</p>
            ) : (
              bookings.slice(0, 3).map((b) => (
                <Link key={b.id} href={`/bookings/${b.id}`} className="block">
                  <div className="row-item">
                    <div>
                      <p className="text-xs font-medium">{b.operator?.trading_concept ?? 'Operator'}</p>
                      <p className="text-[10px] text-[#aaa]">Expires {formatDate(b.expires_at)}</p>
                    </div>
                    <Badge status={b.status} />
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Settlements */}
          <div className="card-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-[#1d9e75]" />
                <span className="text-xs font-medium">Financials</span>
              </div>
              <Link href="/settlements" className="text-[10px] text-[#1d9e75]">View all →</Link>
            </div>
            {settlements.length === 0 ? (
              <p className="text-xs text-[#aaa] py-4 text-center">No settlements yet</p>
            ) : (
              settlements.slice(0, 4).map((s) => (
                <Link key={s.id} href={`/settlements/${s.id}`} className="block">
                  <div className="row-item">
                    <div>
                      <p className="text-xs font-medium">{s.settlement_ref}</p>
                      <p className="text-[10px] text-[#aaa]">{formatDate(s.period_start)} – {formatDate(s.period_end)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium">{formatZAR(s.operator_payout_cents)}</p>
                      <Badge status={s.status} />
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </main>
    </>
  );
}
