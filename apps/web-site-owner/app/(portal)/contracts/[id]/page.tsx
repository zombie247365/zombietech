import { requireAuth } from '../../../../lib/auth';
import { api } from '../../../../lib/api';
import { TopBar } from '../../../../components/layout/TopBar';
import { Badge } from '../../../../components/ui/Badge';
import { formatDate, formatZAR, formatPct } from '../../../../lib/format';
import Link from 'next/link';
import { ChevronLeft, Clock, CheckCircle, XCircle } from 'lucide-react';

interface Props { params: { id: string } }

export default async function ContractDetailPage({ params }: Props) {
  const token = requireAuth();
  let contract: Awaited<ReturnType<typeof api.contracts.get>>['data'] | null = null;
  try {
    const res = await api.contracts.get(params.id, token);
    contract = res.data;
  } catch {
    return (
      <>
        <TopBar title="Contract" />
        <main className="p-6"><p className="text-sm text-red-600">Contract not found.</p></main>
      </>
    );
  }

  const c = contract;
  const slot = c.site_slot;
  const operator = c.operator;

  return (
    <>
      <TopBar
        title={c.contract_ref}
        actions={
          <Link href="/contracts" className="btn-secondary text-xs px-3 py-1.5">
            <ChevronLeft className="w-3.5 h-3.5" /> All contracts
          </Link>
        }
      />
      <main className="flex-1 p-6 max-w-2xl">
        {/* Status */}
        <div className="card-white mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-medium">{c.contract_ref}</h2>
            <Badge status={c.status} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-xs">
              {c.site_owner_signed_at ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-[#ddd]" />}
              <span className="text-[#666]">Site owner signed {c.site_owner_signed_at ? formatDate(c.site_owner_signed_at) : '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {c.operator_signed_at ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-[#ddd]" />}
              <span className="text-[#666]">Operator signed {c.operator_signed_at ? formatDate(c.operator_signed_at) : '—'}</span>
            </div>
          </div>
        </div>

        {/* Commercial terms (locked) */}
        <div className="card-white mb-4">
          <div className="section-title">Commercial terms (locked at signing)</div>
          {[
            { label: 'Hourly rate', val: formatZAR(c.hourly_rate_cents) + '/hr' },
            { label: 'Upside model', val: c.upside_model === 'fixed' ? 'Fixed markup' : 'Variable profit share' },
            { label: 'Upside %', val: formatPct(c.upside_pct) },
            { label: 'Platform fee', val: formatPct(c.platform_fee_pct) },
            { label: 'Notice period', val: `${c.notice_period_days} days` },
          ].map(({ label, val }) => (
            <div key={label} className="row-item text-xs">
              <span className="text-[#666]">{label}</span>
              <span className="font-medium">{val}</span>
            </div>
          ))}
        </div>

        {/* Slot */}
        {slot && (
          <div className="card-white mb-4">
            <div className="section-title">Site & slot</div>
            {[
              { label: 'Site', val: slot.site?.trading_name ?? '—' },
              { label: 'Day', val: slot.day_of_week ?? '—' },
              { label: 'Hours', val: `${slot.slot_start_time} – ${slot.slot_end_time}` },
              { label: 'Session fee', val: formatZAR(slot.base_fee_cents_per_session) },
            ].map(({ label, val }) => (
              <div key={label} className="row-item text-xs">
                <span className="text-[#666]">{label}</span>
                <span className="font-medium capitalize">{val}</span>
              </div>
            ))}
          </div>
        )}

        {/* Operator */}
        {operator && (
          <div className="card-white mb-4">
            <div className="section-title">Zombie operator</div>
            {[
              { label: 'Name', val: operator.user?.full_name ?? '—' },
              { label: 'Trading concept', val: operator.trading_concept ?? '—' },
              { label: 'Trust score', val: `${operator.trust_score}/100` },
            ].map(({ label, val }) => (
              <div key={label} className="row-item text-xs">
                <span className="text-[#666]">{label}</span>
                <span className="font-medium">{val}</span>
              </div>
            ))}
          </div>
        )}

        {/* Quick links */}
        <Link href={`/sessions?contract=${c.id}`}>
          <div className="card-white flex items-center gap-2 hover:border-[#1d9e75] transition-colors cursor-pointer">
            <Clock className="w-4 h-4 text-[#1d9e75]" />
            <span className="text-xs flex-1">View sessions for this contract</span>
            <span className="text-[10px] text-[#1d9e75]">→</span>
          </div>
        </Link>
      </main>
    </>
  );
}
