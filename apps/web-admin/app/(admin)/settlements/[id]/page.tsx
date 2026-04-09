import { requireAdmin } from '../../../../lib/auth';
import { adminApi } from '../../../../lib/api';
import { TopBar } from '../../../../components/layout/TopBar';
import { Badge } from '../../../../components/ui/Badge';
import { formatDate, formatZAR } from '../../../../lib/format';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { ReleaseActions } from './ReleaseActions';

interface Props { params: { id: string } }

export default async function AdminSettlementDetailPage({ params }: Props) {
  const token = requireAdmin();
  let s: Awaited<ReturnType<typeof adminApi.settlements.get>>['data'] | null = null;
  try { s = (await adminApi.settlements.get(params.id, token)).data; } catch {
    return (<><TopBar title="Settlement" /><main className="p-6"><p className="text-sm text-red-600">Not found.</p></main></>);
  }

  const canRelease = s.status === 'ready' || s.status === 'pending';

  const waterfall = [
    { label: 'Gross revenue', val: s.gross_revenue_cents, highlight: false },
    { label: '– Platform fee (10%)', val: `-${s.platform_fee_cents}`, highlight: false },
    { label: '– Site fees', val: `-${s.site_fees_cents}`, highlight: false },
    { label: '– Landlord share', val: `-${s.landlord_share_cents}`, highlight: false },
    { label: '– Activation deduction', val: `-${s.activation_deduction_cents}`, highlight: false },
    { label: '– Penalty deductions', val: `-${s.penalty_deductions_cents}`, highlight: false },
    { label: 'Operator payout', val: s.operator_payout_cents, highlight: true },
  ];

  return (
    <>
      <TopBar title={s.settlement_ref} actions={
        <Link href="/settlements" className="btn-secondary text-xs px-3 py-1.5"><ChevronLeft className="w-3.5 h-3.5" /> Settlements</Link>
      } />
      <main className="flex-1 p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-5">
          <Badge status={s.status} />
          <span className="text-sm text-[#666]">
            {formatDate(s.period_start)} – {formatDate(s.period_end)}
          </span>
        </div>

        {/* Waterfall */}
        <div className="card-white mb-4">
          <p className="text-xs font-semibold text-[#444] mb-3">Fee waterfall</p>
          {waterfall.map(({ label, val, highlight }) => (
            <div key={label} className={`row-item text-xs ${highlight ? 'border-t border-[#e8e8e6] pt-2 mt-1' : ''}`}>
              <span className={highlight ? 'font-semibold text-[#1a1a1a]' : 'text-[#666]'}>{label}</span>
              <span className={highlight ? 'font-bold text-[#1d9e75] text-sm' : 'font-medium'}>
                {formatZAR(val)}
              </span>
            </div>
          ))}
        </div>

        {/* Meta */}
        <div className="card-white mb-4">
          {[
            { label: 'Operator', val: s.operator?.user?.full_name ?? '—' },
            { label: 'Settlement ref', val: s.settlement_ref },
            { label: 'Released at', val: s.released_at ? formatDate(s.released_at) : '—' },
            { label: 'Payment ref', val: s.payment_provider_ref ?? '—' },
          ].map(({ label, val }) => (
            <div key={label} className="row-item text-xs">
              <span className="text-[#666]">{label}</span>
              <span className="font-medium">{val}</span>
            </div>
          ))}
        </div>

        {/* Line items */}
        {s.line_items && s.line_items.length > 0 && (
          <div className="card-white mb-4">
            <p className="text-xs font-semibold text-[#444] mb-3">Line items</p>
            {s.line_items.map((li) => (
              <div key={li.id} className="row-item text-xs">
                <span className="text-[#666] capitalize">{li.line_type.replace(/_/g, ' ')} — {li.description}</span>
                <span className={`font-medium ${Number(li.amount_cents) < 0 ? 'text-red-600' : 'text-[#1d9e75]'}`}>
                  {formatZAR(li.amount_cents)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Release action */}
        {canRelease && <ReleaseActions settlementId={s.id} />}
      </main>
    </>
  );
}
