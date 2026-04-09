import { requireAdmin } from '../../../../lib/auth';
import { adminApi } from '../../../../lib/api';
import { TopBar } from '../../../../components/layout/TopBar';
import { Badge } from '../../../../components/ui/Badge';
import { formatDate, formatDateTime, formatZAR } from '../../../../lib/format';
import Link from 'next/link';
import { ChevronLeft, CheckCircle, XCircle } from 'lucide-react';

interface Props { params: { id: string } }

export default async function AdminSessionDetailPage({ params }: Props) {
  const token = requireAdmin();
  let s: Awaited<ReturnType<typeof adminApi.sessions.get>>['data'] | null = null;
  try { s = (await adminApi.sessions.get(params.id, token)).data; } catch {
    return (<><TopBar title="Session" /><main className="p-6"><p className="text-sm text-red-600">Not found.</p></main></>);
  }

  const scoreColour = !s.ai_handover_score ? '#ddd'
    : s.ai_handover_score >= 80 ? '#1d9e75'
    : s.ai_handover_score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <>
      <TopBar title={s.session_ref} actions={
        <Link href="/sessions" className="btn-secondary text-xs px-3 py-1.5"><ChevronLeft className="w-3.5 h-3.5" /> Sessions</Link>
      } />
      <main className="flex-1 p-6 max-w-2xl">
        {/* Status strip */}
        <div className="flex items-center gap-3 mb-5">
          <Badge status={s.status} />
          {s.gross_revenue_cents && (
            <span className="text-sm font-semibold text-[#1d9e75]">{formatZAR(s.gross_revenue_cents)} gross</span>
          )}
        </div>

        {/* Core info */}
        <div className="card-white mb-4">
          {[
            { label: 'Session ref', val: s.session_ref },
            { label: 'Session date', val: formatDate(s.session_date) },
            { label: 'Contract', val: s.contract?.contract_ref ?? '—' },
            { label: 'Operator', val: s.contract?.operator?.user?.full_name ?? '—' },
            { label: 'Site', val: s.contract?.site_slot?.site?.trading_name ?? '—' },
            { label: 'Scheduled start', val: formatDateTime(s.scheduled_start) },
            { label: 'Scheduled end', val: formatDateTime(s.scheduled_end) },
            { label: 'Actual start', val: formatDateTime(s.actual_start) },
            { label: 'Actual end', val: formatDateTime(s.actual_end) },
          ].map(({ label, val }) => (
            <div key={label} className="row-item text-xs">
              <span className="text-[#666]">{label}</span>
              <span className="font-medium">{val}</span>
            </div>
          ))}
        </div>

        {/* Checklist completion */}
        <div className="card-white mb-4">
          <p className="text-xs font-semibold text-[#444] mb-3">Checklist completion</p>
          {[
            { label: 'Before photos', done: s.before_photos_complete },
            { label: 'After photos', done: s.after_photos_complete },
            { label: 'Lock-up', done: s.lockup_complete },
          ].map(({ label, done }) => (
            <div key={label} className="row-item text-xs">
              <span className="text-[#666]">{label}</span>
              {done
                ? <span className="flex items-center gap-1 text-[#1d9e75]"><CheckCircle className="w-3.5 h-3.5" /> Complete</span>
                : <span className="flex items-center gap-1 text-[#bbb]"><XCircle className="w-3.5 h-3.5" /> Incomplete</span>}
            </div>
          ))}
        </div>

        {/* AI score */}
        {s.ai_handover_score !== null && (
          <div className="card-white mb-4">
            <p className="text-xs font-semibold text-[#444] mb-3">AI handover score</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${s.ai_handover_score}%`, backgroundColor: scoreColour }}
                />
              </div>
              <span className="text-sm font-bold" style={{ color: scoreColour }}>{s.ai_handover_score}/100</span>
            </div>
            {s.ai_flags_count !== null && (
              <p className="text-[10px] text-[#888] mt-2">{s.ai_flags_count} AI flag{s.ai_flags_count !== 1 ? 's' : ''} raised</p>
            )}
          </div>
        )}

        {/* Confirmation */}
        <div className="card-white">
          <p className="text-xs font-semibold text-[#444] mb-3">Site owner confirmation</p>
          <div className="row-item text-xs">
            <span className="text-[#666]">Confirmed at</span>
            <span className="font-medium">{formatDateTime(s.site_owner_confirmed_at)}</span>
          </div>
        </div>
      </main>
    </>
  );
}
