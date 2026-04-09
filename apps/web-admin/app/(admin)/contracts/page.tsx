import { requireAdmin } from '../../../lib/auth';
import { adminApi } from '../../../lib/api';
import { TopBar } from '../../../components/layout/TopBar';
import { Badge } from '../../../components/ui/Badge';
import { formatDate, formatZAR, formatPct } from '../../../lib/format';
import Link from 'next/link';

export default async function ContractsPage() {
  const token = requireAdmin();
  const res = await adminApi.contracts.list(token).catch(() => ({ data: [] }));
  const contracts = res.data;

  return (
    <>
      <TopBar title={`Contracts · ${contracts.length} total`} />
      <main className="flex-1 p-6 max-w-5xl">
        <div className="card-white overflow-hidden">
          <div className="table-hd">
            <span className="text-[10px] font-semibold text-[#888] w-28">Ref</span>
            <span className="text-[10px] font-semibold text-[#888] flex-1">Operator</span>
            <span className="text-[10px] font-semibold text-[#888] w-40">Site</span>
            <span className="text-[10px] font-semibold text-[#888] w-20">Rate/hr</span>
            <span className="text-[10px] font-semibold text-[#888] w-16">Upside</span>
            <span className="text-[10px] font-semibold text-[#888] w-20">Status</span>
            <span className="text-[10px] font-semibold text-[#888] w-24">Signed</span>
          </div>
          {contracts.length === 0 && <div className="px-4 py-8 text-center text-xs text-[#aaa]">No contracts</div>}
          {contracts.map((c) => (
            <Link key={c.id} href={`/contracts/${c.id}`} className="block">
              <div className="table-row">
                <div className="w-28 text-xs font-medium font-mono">{c.contract_ref}</div>
                <div className="flex-1 text-xs text-[#666] truncate">{c.operator?.user?.full_name ?? '—'}</div>
                <div className="w-40 text-xs text-[#666] truncate">{c.site_slot?.site?.trading_name ?? '—'}</div>
                <div className="w-20 text-xs font-medium">{formatZAR(c.hourly_rate_cents)}</div>
                <div className="w-16 text-[10px] text-[#888]">{c.upside_model === 'fixed' ? `F ${formatPct(c.upside_pct)}` : `V ${formatPct(c.upside_pct)}`}</div>
                <div className="w-20"><Badge status={c.status} /></div>
                <div className="w-24 text-[10px] text-[#aaa]">{formatDate(c.site_owner_signed_at)}</div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
