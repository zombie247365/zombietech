import { requireAdmin } from '../../../../lib/auth';
import { adminApi } from '../../../../lib/api';
import { TopBar } from '../../../../components/layout/TopBar';
import { Badge } from '../../../../components/ui/Badge';
import { formatDate, formatZAR, formatPct } from '../../../../lib/format';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface Props { params: { id: string } }

export default async function ContractDetailPage({ params }: Props) {
  const token = requireAdmin();
  let c: Awaited<ReturnType<typeof adminApi.contracts.get>>['data'] | null = null;
  try { c = (await adminApi.contracts.get(params.id, token)).data; } catch {
    return (<><TopBar title="Contract" /><main className="p-6"><p className="text-sm text-red-600">Not found.</p></main></>);
  }

  return (
    <>
      <TopBar title={c.contract_ref} actions={
        <Link href="/contracts" className="btn-secondary text-xs px-3 py-1.5"><ChevronLeft className="w-3.5 h-3.5" /> Contracts</Link>
      } />
      <main className="flex-1 p-6 max-w-2xl">
        <div className="card-white mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-base font-medium font-mono">{c.contract_ref}</p>
              <p className="text-xs text-[#888]">Created {formatDate(c.created_at)}</p>
            </div>
            <Badge status={c.status} />
          </div>
          {[
            { label: 'Operator', val: c.operator?.user?.full_name ?? '—' },
            { label: 'Site', val: c.site_slot?.site?.trading_name ?? '—' },
            { label: 'Day', val: c.site_slot?.day_of_week ?? '—' },
            { label: 'Hourly rate (locked)', val: formatZAR(c.hourly_rate_cents) + '/hr' },
            { label: 'Upside model', val: `${c.upside_model === 'fixed' ? 'Fixed' : 'Variable'} ${formatPct(c.upside_pct)}` },
            { label: 'Platform fee', val: formatPct(c.platform_fee_pct) },
            { label: 'Notice period', val: `${c.notice_period_days} days` },
            { label: 'Site owner signed', val: formatDate(c.site_owner_signed_at) },
            { label: 'Operator signed', val: formatDate(c.operator_signed_at) },
            { label: 'Terminated', val: c.terminated_at ? formatDate(c.terminated_at) : '—' },
          ].map(({ label, val }) => (
            <div key={label} className="row-item text-xs">
              <span className="text-[#666]">{label}</span>
              <span className="font-medium capitalize">{val}</span>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
