import { requireAuth } from '../../../../lib/auth';
import { api } from '../../../../lib/api';
import { TopBar } from '../../../../components/layout/TopBar';
import { Badge } from '../../../../components/ui/Badge';
import { formatDate, formatZAR } from '../../../../lib/format';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface Props { params: { id: string } }

export default async function SettlementDetailPage({ params }: Props) {
  const token = requireAuth();
  let settlement: Awaited<ReturnType<typeof api.settlements.get>>['data'] | null = null;
  try {
    const res = await api.settlements.get(params.id, token);
    settlement = res.data;
  } catch {
    return (
      <>
        <TopBar title="Settlement" />
        <main className="p-6"><p className="text-sm text-red-600">Settlement not found.</p></main>
      </>
    );
  }

  const s = settlement;

  return (
    <>
      <TopBar
        title={s.settlement_ref}
        actions={
          <Link href="/settlements" className="btn-secondary text-xs px-3 py-1.5">
            <ChevronLeft className="w-3.5 h-3.5" /> All settlements
          </Link>
        }
      />
      <main className="flex-1 p-6 max-w-2xl">
        {/* Summary */}
        <div className="card-white mb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-base font-medium">{s.settlement_ref}</h2>
              <p className="text-xs text-[#888]">{formatDate(s.period_start)} – {formatDate(s.period_end)}</p>
            </div>
            <Badge status={s.status} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Gross revenue', val: formatZAR(s.gross_revenue_cents), color: '#1a1a1a' },
              { label: 'Platform fee', val: `−${formatZAR(s.platform_fee_cents)}`, color: '#991b1b' },
              { label: 'Site fees', val: `−${formatZAR(s.site_fees_cents)}`, color: '#991b1b' },
              { label: 'Landlord share', val: `−${formatZAR(s.landlord_share_cents)}`, color: '#6b7280' },
              { label: 'Activation deduction', val: `−${formatZAR(s.activation_deduction_cents)}`, color: '#6b7280' },
              { label: 'Penalties', val: `−${formatZAR(s.penalty_deductions_cents)}`, color: '#991b1b' },
            ].map(({ label, val, color }) => (
              <div key={label} className="rounded-lg p-2.5" style={{ background: '#f2f2f0' }}>
                <div className="text-[10px] text-[#888] mb-0.5">{label}</div>
                <div className="text-sm font-medium" style={{ color }}>{val}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-[#e8e8e8]">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Operator payout</span>
              <span className="text-xl font-medium" style={{ color: '#1d9e75' }}>{formatZAR(s.operator_payout_cents)}</span>
            </div>
            {s.released_at && (
              <p className="text-xs text-[#888] mt-1">Released {formatDate(s.released_at)}</p>
            )}
          </div>
        </div>

        {/* Line items */}
        {s.line_items && s.line_items.length > 0 && (
          <div className="card-white">
            <div className="section-title">Line items ({s.line_items.length})</div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {s.line_items.map((li) => (
                <div key={li.id} className="row-item text-xs">
                  <span className="text-[#666] flex-1">{li.description}</span>
                  <span
                    className="font-medium ml-3"
                    style={{ color: Number(li.amount_cents) >= 0 ? '#166534' : '#991b1b' }}
                  >
                    {Number(li.amount_cents) >= 0 ? '+' : ''}{formatZAR(li.amount_cents)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
