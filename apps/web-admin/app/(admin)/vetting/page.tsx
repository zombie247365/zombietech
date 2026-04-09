import { requireAdmin } from '../../../lib/auth';
import { adminApi } from '../../../lib/api';
import { TopBar } from '../../../components/layout/TopBar';
import { Badge } from '../../../components/ui/Badge';
import { formatDate, statusLabel } from '../../../lib/format';
import Link from 'next/link';
import { UserCheck } from 'lucide-react';

export default async function VettingPage() {
  const token = requireAdmin();
  const res = await adminApi.operators.list(token, { vetting_status: 'pending' }).catch(() => ({ data: [] }));
  const pending = res.data;

  return (
    <>
      <TopBar title={`Vetting queue · ${pending.length} pending`} />
      <main className="flex-1 p-6 max-w-4xl">
        {pending.length === 0 ? (
          <div className="text-center py-16">
            <UserCheck className="w-8 h-8 text-[#bbb] mx-auto mb-3" />
            <p className="text-sm text-[#aaa]">Vetting queue is clear</p>
          </div>
        ) : (
          <div className="card-white overflow-hidden">
            <div className="table-hd">
              <span className="text-[10px] font-semibold text-[#888] w-40">Operator</span>
              <span className="text-[10px] font-semibold text-[#888] flex-1">Trading concept</span>
              <span className="text-[10px] font-semibold text-[#888] w-24">Category</span>
              <span className="text-[10px] font-semibold text-[#888] w-20">Status</span>
              <span className="text-[10px] font-semibold text-[#888] w-24">Applied</span>
            </div>
            {pending.map((op) => (
              <Link key={op.id} href={`/operators/${op.id}`} className="block">
                <div className="table-row">
                  <div className="w-40">
                    <p className="text-xs font-medium">{op.user?.full_name ?? '—'}</p>
                    <p className="text-[10px] text-[#aaa]">{op.user?.mobile}</p>
                  </div>
                  <div className="flex-1 text-xs text-[#666] truncate">{op.trading_concept}</div>
                  <div className="w-24 text-[10px] text-[#888]">{op.food_category}</div>
                  <div className="w-20"><Badge status={op.vetting_status} /></div>
                  <div className="w-24 text-[10px] text-[#aaa]">{formatDate(op.created_at)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
