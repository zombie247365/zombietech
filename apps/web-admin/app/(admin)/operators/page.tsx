import { requireAdmin } from '../../../lib/auth';
import { adminApi } from '../../../lib/api';
import { TopBar } from '../../../components/layout/TopBar';
import { Badge } from '../../../components/ui/Badge';
import { formatDate } from '../../../lib/format';
import Link from 'next/link';

export default async function OperatorsPage() {
  const token = requireAdmin();
  const res = await adminApi.operators.list(token).catch(() => ({ data: [] }));
  const operators = res.data;

  const approved = operators.filter((o) => o.vetting_status === 'approved').length;
  const pending = operators.filter((o) => o.vetting_status === 'pending').length;
  const rejected = operators.filter((o) => ['rejected', 'suspended'].includes(o.vetting_status)).length;

  return (
    <>
      <TopBar title={`Operators · ${operators.length} total`} />
      <main className="flex-1 p-6 max-w-5xl">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Approved', val: approved, color: '#166534' },
            { label: 'Pending vetting', val: pending, color: '#92400e' },
            { label: 'Rejected / suspended', val: rejected, color: '#991b1b' },
          ].map(({ label, val, color }) => (
            <div key={label} className="card-white">
              <div className="text-xl font-medium" style={{ color }}>{val}</div>
              <div className="text-[10px] text-[#888]">{label}</div>
            </div>
          ))}
        </div>

        <div className="card-white overflow-hidden">
          <div className="table-hd">
            <span className="text-[10px] font-semibold text-[#888] w-40">Name</span>
            <span className="text-[10px] font-semibold text-[#888] flex-1">Trading concept</span>
            <span className="text-[10px] font-semibold text-[#888] w-20">Category</span>
            <span className="text-[10px] font-semibold text-[#888] w-16">Trust</span>
            <span className="text-[10px] font-semibold text-[#888] w-24">Vetting</span>
            <span className="text-[10px] font-semibold text-[#888] w-24">Joined</span>
          </div>
          {operators.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-[#aaa]">No operators found</div>
          )}
          {operators.map((op) => (
            <Link key={op.id} href={`/operators/${op.id}`} className="block">
              <div className="table-row">
                <div className="w-40">
                  <p className="text-xs font-medium truncate">{op.user?.full_name ?? '—'}</p>
                  <p className="text-[10px] text-[#aaa] truncate">{op.user?.mobile}</p>
                </div>
                <div className="flex-1 text-xs text-[#666] truncate">{op.trading_concept}</div>
                <div className="w-20 text-[10px] text-[#888] truncate">{op.food_category}</div>
                <div className="w-16 text-xs font-medium">{op.trust_score}</div>
                <div className="w-24"><Badge status={op.vetting_status} /></div>
                <div className="w-24 text-[10px] text-[#aaa]">{formatDate(op.created_at)}</div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
