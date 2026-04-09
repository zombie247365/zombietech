import { requireAdmin } from '../../../lib/auth';
import { adminApi } from '../../../lib/api';
import { TopBar } from '../../../components/layout/TopBar';
import { Badge } from '../../../components/ui/Badge';
import { formatDate, formatZAR } from '../../../lib/format';
import Link from 'next/link';

export default async function AdminDisputesPage() {
  const token = requireAdmin();
  const res = await adminApi.disputes.list(token, { limit: '100' }).catch(() => ({ data: [] }));
  const disputes = res.data;

  const open = disputes.filter((d) => d.status === 'open' || d.status === 'under_review');
  const resolved = disputes.filter((d) => d.status === 'resolved');

  return (
    <>
      <TopBar title={`Disputes · ${disputes.length} total`} />
      <main className="flex-1 p-6 max-w-5xl">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Open', val: `${open.length}` },
            { label: 'Resolved', val: `${resolved.length}` },
            { label: 'Total claimed', val: formatZAR(disputes.reduce((a, d) => a + Number(d.claim_amount_cents), 0)) },
          ].map(({ label, val }) => (
            <div key={label} className="stat-card">
              <p className="text-[10px] text-[#888] mb-1">{label}</p>
              <p className="text-xl font-bold text-[#1a1a1a]">{val}</p>
            </div>
          ))}
        </div>

        {/* Open / under review */}
        {open.length > 0 && (
          <div className="mb-5">
            <div className="section-title">Needs attention ({open.length})</div>
            <div className="card-white overflow-hidden">
              <DisputeTable rows={open} />
            </div>
          </div>
        )}

        {/* All disputes */}
        <div className="section-title">All disputes</div>
        <div className="card-white overflow-hidden">
          <DisputeTable rows={disputes} />
        </div>
      </main>
    </>
  );
}

function DisputeTable({ rows }: { rows: Awaited<ReturnType<typeof adminApi.disputes.list>>['data'] }) {
  return (
    <>
      <div className="table-hd">
        <span className="text-[10px] font-semibold text-[#888] w-24">Ref</span>
        <span className="text-[10px] font-semibold text-[#888] w-24">Date</span>
        <span className="text-[10px] font-semibold text-[#888] flex-1">Session</span>
        <span className="text-[10px] font-semibold text-[#888] w-20">Type</span>
        <span className="text-[10px] font-semibold text-[#888] w-24">Claimed</span>
        <span className="text-[10px] font-semibold text-[#888] w-20">AI rec.</span>
        <span className="text-[10px] font-semibold text-[#888] w-20">Status</span>
      </div>
      {rows.length === 0 && <div className="px-4 py-8 text-center text-xs text-[#aaa]">No disputes</div>}
      {rows.map((d) => (
        <Link key={d.id} href={`/disputes/${d.id}`} className="block">
          <div className="table-row">
            <div className="w-24 text-xs font-medium font-mono">{d.dispute_ref}</div>
            <div className="w-24 text-[10px] text-[#888]">{formatDate(d.created_at)}</div>
            <div className="flex-1 text-xs text-[#666] truncate">{d.session?.session_ref ?? '—'}</div>
            <div className="w-20 text-xs capitalize">{d.claim_type.replace(/_/g, ' ')}</div>
            <div className="w-24 text-xs font-medium">{formatZAR(d.claim_amount_cents)}</div>
            <div className="w-20 text-xs capitalize text-[#888]">{d.ai_recommendation?.replace(/_/g, ' ') ?? '—'}</div>
            <div className="w-20"><Badge status={d.status} /></div>
          </div>
        </Link>
      ))}
    </>
  );
}
