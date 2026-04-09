import { requireAuth } from '../../../lib/auth';
import { api } from '../../../lib/api';
import { TopBar } from '../../../components/layout/TopBar';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { formatDate, formatZAR } from '../../../lib/format';
import Link from 'next/link';
import { Clock, CheckCircle, XCircle, Camera } from 'lucide-react';

export default async function SessionsPage() {
  const token = requireAuth();
  let sessions: Awaited<ReturnType<typeof api.sessions.list>>['data'] = [];
  try {
    const res = await api.sessions.list(token);
    sessions = res.data;
  } catch { /* show empty */ }

  const active = sessions.filter((s) => s.status === 'active');
  const rest = sessions.filter((s) => s.status !== 'active');

  return (
    <>
      <TopBar title="Sessions" />
      <main className="flex-1 p-6 max-w-3xl">
        {sessions.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No sessions yet"
            description="Sessions appear here once a zombie operator starts trading at your site."
          />
        ) : (
          <>
            {active.length > 0 && (
              <div className="mb-6">
                <div className="section-title">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 align-middle" />
                  Live now ({active.length})
                </div>
                <div className="space-y-3">
                  {active.map((s) => <SessionCard key={s.id} session={s} />)}
                </div>
              </div>
            )}
            {rest.length > 0 && (
              <div>
                <div className="section-title">All sessions</div>
                <div className="space-y-2">
                  {rest.map((s) => <SessionCard key={s.id} session={s} />)}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

function SessionCard({ session: s }: { session: Awaited<ReturnType<typeof api.sessions.list>>['data'][0] }) {
  return (
    <Link href={`/sessions/${s.id}`}>
      <div className="card-white hover:border-[#1d9e75] transition-colors cursor-pointer">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-sm font-medium">{s.session_ref}</p>
            <p className="text-xs text-[#888] mt-0.5">{formatDate(s.session_date)}</p>
          </div>
          <div className="flex items-center gap-2">
            {s.gross_revenue_cents && (
              <span className="text-xs font-medium text-[#1d9e75]">{formatZAR(s.gross_revenue_cents)}</span>
            )}
            <Badge status={s.status} />
          </div>
        </div>
        <div className="flex gap-4 text-[10px] text-[#aaa]">
          <span className="flex items-center gap-1">
            <Camera className="w-3 h-3" />
            Before: {s.before_photos_complete ? <CheckCircle className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3" />}
          </span>
          <span className="flex items-center gap-1">
            After: {s.after_photos_complete ? <CheckCircle className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3" />}
          </span>
          <span className="flex items-center gap-1">
            Lock-up: {s.lockup_complete ? <CheckCircle className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3" />}
          </span>
          {s.ai_handover_score != null && (
            <span>AI score: {s.ai_handover_score}/100</span>
          )}
        </div>
      </div>
    </Link>
  );
}
