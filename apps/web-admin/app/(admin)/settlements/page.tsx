import { requireAdmin } from '../../../lib/auth';
import { adminApi } from '../../../lib/api';
import { TopBar } from '../../../components/layout/TopBar';
import { Badge } from '../../../components/ui/Badge';
import { formatDate, formatZAR } from '../../../lib/format';
import Link from 'next/link';

export default async function AdminSettlementsPage() {
  const token = requireAdmin();
  const res = await adminApi.settlements.list(token, { limit: '100' }).catch(() => ({ data: [] }));
  const settlements = res.data;

  const pending = settlements.filter((s) => s.status === 'pending' || s.status === 'ready');
  const released = settlements.filter((s) => s.status === 'released');
  const held = settlements.filter((s) => s.status === 'held' || s.status === 'failed');

  const totalPayout = settlements.reduce((acc, s) => acc + Number(s.operator_payout_cents), 0);
  const pendingPayout = pending.reduce((acc, s) => acc + Number(s.operator_payout_cents), 0);

  return (
    <>
      <TopBar title={`Settlements · ${settlements.length} total`} />
      <main className="flex-1 p-6 max-w-5xl">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total payouts', val: formatZAR(totalPayout) },
            { label: 'Awaiting release', val: `${pending.length}`, sub: formatZAR(pendingPayout) },
            { label: 'Released', val: `${released.length}` },
            { label: 'Held / failed', val: `${held.length}` },
          ].map(({ label, val, sub }) => (
            <div key={label} className="stat-card">
              <p className="text-[10px] text-[#888] mb-1">{label}</p>
              <p className="text-xl font-bold text-[#1a1a1a]">{val}</p>
              {sub && <p className="text-[10px] text-[#1d9e75] mt-0.5">{sub}</p>}
            </div>
          ))}
        </div>

        {/* Pending / ready */}
        {pending.length > 0 && (
          <div className="mb-5">
            <div className="section-title">Awaiting release ({pending.length})</div>
            <div className="card-white overflow-hidden">
              <SettlementTable rows={pending} />
            </div>
          </div>
        )}

        {/* All settlements */}
        <div className="section-title">All settlements</div>
        <div className="card-white overflow-hidden">
          <div className="table-hd">
            <span className="text-[10px] font-semibold text-[#888] w-28">Ref</span>
            <span className="text-[10px] font-semibold text-[#888] flex-1">Operator</span>
            <span className="text-[10px] font-semibold text-[#888] w-24">Period</span>
            <span className="text-[10px] font-semibold text-[#888] w-24">Gross</span>
            <span className="text-[10px] font-semibold text-[#888] w-24">Payout</span>
            <span className="text-[10px] font-semibold text-[#888] w-20">Status</span>
          </div>
          {settlements.length === 0 && <div className="px-4 py-8 text-center text-xs text-[#aaa]">No settlements</div>}
          {settlements.map((s) => (
            <Link key={s.id} href={`/settlements/${s.id}`} className="block">
              <div className="table-row">
                <div className="w-28 text-xs font-medium font-mono">{s.settlement_ref}</div>
                <div className="flex-1 text-xs text-[#666] truncate">{s.operator?.user?.full_name ?? '—'}</div>
                <div className="w-24 text-[10px] text-[#888]">{formatDate(s.period_start)} – {formatDate(s.period_end)}</div>
                <div className="w-24 text-xs font-medium">{formatZAR(s.gross_revenue_cents)}</div>
                <div className="w-24 text-xs font-semibold text-[#1d9e75]">{formatZAR(s.operator_payout_cents)}</div>
                <div className="w-20"><Badge status={s.status} /></div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}

function SettlementTable({ rows }: { rows: Awaited<ReturnType<typeof adminApi.settlements.list>>['data'] }) {
  return (
    <>
      <div className="table-hd">
        <span className="text-[10px] font-semibold text-[#888] w-28">Ref</span>
        <span className="text-[10px] font-semibold text-[#888] flex-1">Operator</span>
        <span className="text-[10px] font-semibold text-[#888] w-24">Period</span>
        <span className="text-[10px] font-semibold text-[#888] w-24">Payout</span>
        <span className="text-[10px] font-semibold text-[#888] w-20">Status</span>
      </div>
      {rows.map((s) => (
        <Link key={s.id} href={`/settlements/${s.id}`} className="block">
          <div className="table-row">
            <div className="w-28 text-xs font-medium font-mono">{s.settlement_ref}</div>
            <div className="flex-1 text-xs text-[#666] truncate">{s.operator?.user?.full_name ?? '—'}</div>
            <div className="w-24 text-[10px] text-[#888]">{formatDate(s.period_start)} – {formatDate(s.period_end)}</div>
            <div className="w-24 text-xs font-semibold text-[#1d9e75]">{formatZAR(s.operator_payout_cents)}</div>
            <div className="w-20"><Badge status={s.status} /></div>
          </div>
        </Link>
      ))}
    </>
  );
}
