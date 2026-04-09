import { requireAdmin } from '../../../../lib/auth';
import { adminApi } from '../../../../lib/api';
import { TopBar } from '../../../../components/layout/TopBar';
import { Badge } from '../../../../components/ui/Badge';
import { formatDate, formatZAR } from '../../../../lib/format';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { ResolveActions } from './ResolveActions';

interface Props { params: { id: string } }

const aiRecColour = (rec: string | null) => {
  if (!rec) return '#888';
  if (rec === 'award_full') return '#1d9e75';
  if (rec === 'reject') return '#ef4444';
  return '#f59e0b';
};

export default async function AdminDisputeDetailPage({ params }: Props) {
  const token = requireAdmin();
  let d: Awaited<ReturnType<typeof adminApi.disputes.get>>['data'] | null = null;
  try { d = (await adminApi.disputes.get(params.id, token)).data; } catch {
    return (<><TopBar title="Dispute" /><main className="p-6"><p className="text-sm text-red-600">Not found.</p></main></>);
  }

  const canResolve = d.status === 'open' || d.status === 'under_review';

  return (
    <>
      <TopBar title={d.dispute_ref} actions={
        <Link href="/disputes" className="btn-secondary text-xs px-3 py-1.5"><ChevronLeft className="w-3.5 h-3.5" /> Disputes</Link>
      } />
      <main className="flex-1 p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-5">
          <Badge status={d.status} />
          <span className="text-sm font-semibold">{formatZAR(d.claim_amount_cents)} claimed</span>
        </div>

        {/* Details */}
        <div className="card-white mb-4">
          {[
            { label: 'Dispute ref', val: d.dispute_ref },
            { label: 'Session', val: d.session?.session_ref ?? '—' },
            { label: 'Raised by', val: d.raised_by?.full_name ?? '—' },
            { label: 'Claim type', val: d.claim_type.replace(/_/g, ' ') },
            { label: 'Claimed amount', val: formatZAR(d.claim_amount_cents) },
            { label: 'Created', val: formatDate(d.created_at) },
            { label: 'Deadline', val: formatDate(d.deadline_at) },
            { label: 'Resolved', val: d.resolved_at ? formatDate(d.resolved_at) : '—' },
          ].map(({ label, val }) => (
            <div key={label} className="row-item text-xs">
              <span className="text-[#666] capitalize">{label}</span>
              <span className="font-medium capitalize">{val}</span>
            </div>
          ))}
        </div>

        {/* Description */}
        <div className="card-white mb-4">
          <p className="text-xs font-semibold text-[#444] mb-2">Claim description</p>
          <p className="text-xs text-[#555] leading-relaxed">{d.description}</p>
        </div>

        {/* AI recommendation */}
        {d.ai_recommendation && (
          <div className="card-white mb-4">
            <p className="text-xs font-semibold text-[#444] mb-2">AI recommendation</p>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-sm font-bold capitalize"
                style={{ color: aiRecColour(d.ai_recommendation) }}
              >
                {d.ai_recommendation.replace(/_/g, ' ')}
              </span>
              {d.ai_confidence && (
                <span className="text-[10px] text-[#888]">{(Number(d.ai_confidence) * 100).toFixed(0)}% confidence</span>
              )}
            </div>
            {d.ai_reasoning && (
              <p className="text-xs text-[#555] leading-relaxed">{d.ai_reasoning}</p>
            )}
          </div>
        )}

        {/* Admin decision (if resolved) */}
        {d.admin_decision && (
          <div className="card-white mb-4">
            <p className="text-xs font-semibold text-[#444] mb-2">Admin decision</p>
            <div className="row-item text-xs">
              <span className="text-[#666]">Decision</span>
              <span className="font-medium capitalize">{d.admin_decision.replace(/_/g, ' ')}</span>
            </div>
            {d.awarded_amount_cents && (
              <div className="row-item text-xs">
                <span className="text-[#666]">Awarded</span>
                <span className="font-medium text-[#1d9e75]">{formatZAR(d.awarded_amount_cents)}</span>
              </div>
            )}
          </div>
        )}

        {/* Resolve actions */}
        {canResolve && <ResolveActions disputeId={d.id} claimAmountCents={Number(d.claim_amount_cents)} />}
      </main>
    </>
  );
}
