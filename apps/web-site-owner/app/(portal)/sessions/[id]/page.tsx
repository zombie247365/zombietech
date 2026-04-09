import { requireAuth } from '../../../../lib/auth';
import { api } from '../../../../lib/api';
import { TopBar } from '../../../../components/layout/TopBar';
import { Badge } from '../../../../components/ui/Badge';
import { formatDate, formatDateTime, formatZAR } from '../../../../lib/format';
import { SessionActions } from './SessionActions';
import Link from 'next/link';
import { ChevronLeft, CheckCircle, XCircle, Camera, AlertTriangle } from 'lucide-react';

interface Props { params: { id: string } }

export default async function SessionDetailPage({ params }: Props) {
  const token = requireAuth();
  let session: Awaited<ReturnType<typeof api.sessions.get>>['data'] | null = null;
  try {
    const res = await api.sessions.get(params.id, token);
    session = res.data;
  } catch {
    return (
      <>
        <TopBar title="Session" />
        <main className="p-6"><p className="text-sm text-red-600">Session not found.</p></main>
      </>
    );
  }

  const s = session;
  const aiScore = s.ai_handover_score;
  const scoreColor = aiScore == null ? '#aaa' : aiScore >= 80 ? '#166534' : aiScore >= 60 ? '#92400e' : '#991b1b';

  return (
    <>
      <TopBar
        title={s.session_ref}
        actions={
          <Link href="/sessions" className="btn-secondary text-xs px-3 py-1.5">
            <ChevronLeft className="w-3.5 h-3.5" /> All sessions
          </Link>
        }
      />
      <main className="flex-1 p-6 max-w-2xl">
        {/* Status banner */}
        <div className="card-white mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-medium">{s.session_ref}</h2>
              <p className="text-xs text-[#888]">{formatDate(s.session_date)}</p>
            </div>
            <Badge status={s.status} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Scheduled start', val: formatDateTime(s.scheduled_start) },
              { label: 'Scheduled end', val: formatDateTime(s.scheduled_end) },
              { label: 'Actual start', val: s.actual_start ? formatDateTime(s.actual_start) : '—' },
              { label: 'Actual end', val: s.actual_end ? formatDateTime(s.actual_end) : '—' },
            ].map(({ label, val }) => (
              <div key={label} className="rounded-lg p-2" style={{ background: '#f2f2f0' }}>
                <div className="text-[10px] text-[#888]">{label}</div>
                <div className="text-xs font-medium mt-0.5">{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue */}
        {s.gross_revenue_cents && (
          <div className="card-white mb-4">
            <div className="section-title">Revenue</div>
            <div className="text-2xl font-medium mb-1" style={{ color: '#1d9e75' }}>
              {formatZAR(s.gross_revenue_cents)}
            </div>
            <p className="text-xs text-[#888]">Gross revenue reported by operator</p>
          </div>
        )}

        {/* Photo checklist */}
        <div className="card-white mb-4">
          <div className="section-title">Photo checklist</div>
          {[
            { label: 'Before photos', done: s.before_photos_complete },
            { label: 'After photos', done: s.after_photos_complete },
            { label: 'Lock-up sequence', done: s.lockup_complete },
          ].map(({ label, done }) => (
            <div key={label} className="flex items-center gap-2 py-2 border-b border-[#f0f0f0] last:border-0">
              {done
                ? <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                : <XCircle className="w-4 h-4 text-[#ddd] flex-shrink-0" />}
              <span className="text-xs">{label}</span>
              <span className="ml-auto text-[10px]" style={{ color: done ? '#166534' : '#aaa' }}>
                {done ? 'Complete' : 'Pending'}
              </span>
            </div>
          ))}
        </div>

        {/* AI handover score */}
        {aiScore != null && (
          <div className="card-white mb-4">
            <div className="section-title">AI handover report</div>
            <div className="flex items-center gap-3 mb-2">
              <div className="text-3xl font-medium" style={{ color: scoreColor }}>{aiScore}/100</div>
              <div>
                <p className="text-xs font-medium" style={{ color: scoreColor }}>
                  {aiScore >= 80 ? 'Clean handover' : aiScore >= 60 ? 'Minor issues flagged' : 'Significant issues flagged'}
                </p>
                {s.ai_flags_count != null && s.ai_flags_count > 0 && (
                  <p className="text-xs text-[#888]">{s.ai_flags_count} flag{s.ai_flags_count !== 1 ? 's' : ''} detected</p>
                )}
              </div>
            </div>
            <div className="h-2 rounded-full bg-[#f0f0f0] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${aiScore}%`, background: scoreColor }}
              />
            </div>
          </div>
        )}

        {/* Site owner confirmation */}
        {s.status === 'completed' && (
          <div className="card-white mb-4">
            <div className="section-title">Your confirmation</div>
            {s.site_owner_confirmed_at ? (
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>
                  Confirmed {s.site_owner_confirmed_good_order ? 'good order' : 'with issues'} on {formatDateTime(s.site_owner_confirmed_at)}
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#666]">
                  You haven&apos;t confirmed this session yet. Confirm by Monday 12:00 to trigger settlement, or raise a dispute.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Photos link */}
        <Link href={`/sessions/${s.id}/photos`}>
          <div className="card-white flex items-center gap-2 mb-3 hover:border-[#1d9e75] transition-colors cursor-pointer">
            <Camera className="w-4 h-4 text-[#1d9e75]" />
            <span className="text-xs flex-1">View session photos</span>
            <span className="text-[10px] text-[#1d9e75]">→</span>
          </div>
        </Link>

        {/* Actions: confirm or dispute */}
        {s.status === 'completed' && !s.site_owner_confirmed_at && (
          <SessionActions sessionId={s.id} />
        )}
      </main>
    </>
  );
}
