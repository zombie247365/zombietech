import { requireAuth } from '../../../lib/auth';
import { api } from '../../../lib/api';
import { TopBar } from '../../../components/layout/TopBar';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { formatDate, formatZAR } from '../../../lib/format';
import Link from 'next/link';
import { Banknote, TrendingUp } from 'lucide-react';

export default async function SettlementsPage() {
  const token = requireAuth();
  let settlements: Awaited<ReturnType<typeof api.settlements.list>>['data'] = [];
  let disputes: Awaited<ReturnType<typeof api.disputes.list>>['data'] = [];
  try {
    const [sr, dr] = await Promise.allSettled([
      api.settlements.list(token),
      api.disputes.list(token),
    ]);
    if (sr.status === 'fulfilled') settlements = sr.value.data;
    if (dr.status === 'fulfilled') disputes = dr.value.data;
  } catch { /* show empty */ }

  const totalPaid = settlements
    .filter((s) => s.status === 'released')
    .reduce((sum, s) => sum + Number(s.operator_payout_cents), 0);

  return (
    <>
      <TopBar title="Financials" />
      <main className="flex-1 p-6 max-w-3xl">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total earned', val: formatZAR(totalPaid), icon: TrendingUp, color: '#1d9e75' },
            { label: 'Pending settlement', val: formatZAR(settlements.find((s) => s.status === 'ready')?.operator_payout_cents ?? 0), icon: Banknote, color: '#1e40af' },
            { label: 'Open disputes', val: disputes.filter((d) => ['open', 'under_review'].includes(d.status)).length.toString(), icon: Banknote, color: '#92400e' },
          ].map(({ label, val, icon: Icon, color }) => (
            <div key={label} className="card-white">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4" style={{ color }} />
                <span className="text-[10px] text-[#888]">{label}</span>
              </div>
              <div className="text-xl font-medium" style={{ color }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Settlements list */}
        <div className="section-title">Settlement history</div>
        {settlements.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="No settlements yet"
            description="Settlements appear here after your first zombie session completes."
          />
        ) : (
          <div className="space-y-2 mb-6">
            {settlements.map((s) => (
              <Link key={s.id} href={`/settlements/${s.id}`}>
                <div className="card-white hover:border-[#1d9e75] transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{s.settlement_ref}</p>
                      <p className="text-xs text-[#888]">{formatDate(s.period_start)} – {formatDate(s.period_end)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium" style={{ color: '#1d9e75' }}>{formatZAR(s.operator_payout_cents)}</p>
                      <Badge status={s.status} />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Disputes */}
        {disputes.length > 0 && (
          <>
            <div className="section-title mt-4">Disputes</div>
            <div className="space-y-2">
              {disputes.map((d) => (
                <div key={d.id} className="card-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{d.dispute_ref}</p>
                      <p className="text-xs text-[#888] capitalize">{d.claim_type.replace('_', ' ')} · {formatZAR(d.claim_amount_cents)}</p>
                    </div>
                    <div className="text-right">
                      {d.awarded_amount_cents && (
                        <p className="text-xs font-medium text-green-700">Awarded: {formatZAR(d.awarded_amount_cents)}</p>
                      )}
                      <Badge status={d.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
