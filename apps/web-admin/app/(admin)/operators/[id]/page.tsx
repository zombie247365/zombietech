import { requireAdmin } from '../../../../lib/auth';
import { adminApi } from '../../../../lib/api';
import { TopBar } from '../../../../components/layout/TopBar';
import { Badge } from '../../../../components/ui/Badge';
import { formatDate, formatZAR } from '../../../../lib/format';
import { VettingActions } from './VettingActions';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface Props { params: { id: string } }

export default async function OperatorDetailPage({ params }: Props) {
  const token = requireAdmin();
  let op: Awaited<ReturnType<typeof adminApi.operators.get>>['data'] | null = null;
  try {
    const res = await adminApi.operators.get(params.id, token);
    op = res.data;
  } catch {
    return (
      <>
        <TopBar title="Operator" />
        <main className="p-6"><p className="text-sm text-red-600">Operator not found.</p></main>
      </>
    );
  }

  return (
    <>
      <TopBar title={op.user?.full_name ?? 'Operator'} actions={
        <Link href="/operators" className="btn-secondary text-xs px-3 py-1.5">
          <ChevronLeft className="w-3.5 h-3.5" /> All operators
        </Link>
      } />
      <main className="flex-1 p-6 max-w-2xl">
        {/* Profile */}
        <div className="card-white mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-base font-medium">{op.user?.full_name}</h2>
              <p className="text-xs text-[#888]">{op.user?.mobile} · {op.user?.email}</p>
            </div>
            <Badge status={op.vetting_status} />
          </div>
          {[
            { label: 'Trading concept', val: op.trading_concept },
            { label: 'Food category', val: op.food_category },
            { label: 'Trust score', val: `${op.trust_score}/100` },
            { label: 'Activation balance', val: formatZAR(op.activation_fee_balance) },
            { label: 'Vetting approved', val: op.vetting_approved_at ? formatDate(op.vetting_approved_at) : '—' },
            { label: 'Joined', val: formatDate(op.created_at) },
          ].map(({ label, val }) => (
            <div key={label} className="row-item text-xs">
              <span className="text-[#666]">{label}</span>
              <span className="font-medium">{val}</span>
            </div>
          ))}
        </div>

        {/* Vetting actions */}
        {op.vetting_status === 'pending' && (
          <VettingActions operatorId={op.id} />
        )}
      </main>
    </>
  );
}
