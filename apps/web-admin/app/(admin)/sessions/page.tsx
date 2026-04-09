import { requireAdmin } from '../../../lib/auth';
import { adminApi } from '../../../lib/api';
import { TopBar } from '../../../components/layout/TopBar';
import { Badge } from '../../../components/ui/Badge';
import { formatDate, formatZAR } from '../../../lib/format';
import Link from 'next/link';
import { CheckCircle, XCircle } from 'lucide-react';

export default async function AdminSessionsPage() {
  const token = requireAdmin();
  const res = await adminApi.sessions.list(token, { limit: '50' }).catch(() => ({ data: [] }));
  const sessions = res.data;

  const live = sessions.filter((s) => s.status === 'active');
  const rest = sessions.filter((s) => s.status !== 'active');

  return (
    <>
      <TopBar title={`Sessions · ${sessions.length} loaded`} />
      <main className="flex-1 p-6 max-w-5xl">
        {live.length > 0 && (
          <div className="mb-5">
            <div className="section-title">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 align-middle" />
              Live sessions ({live.length})
            </div>
            <div className="card-white overflow-hidden mb-4">
              {live.map((s) => <SessionRow key={s.id} session={s} />)}
            </div>
          </div>
        )}
        <div className="section-title">All sessions</div>
        <div className="card-white overflow-hidden">
          <div className="table-hd">
            <span className="text-[10px] font-semibold text-[#888] w-24">Ref</span>
            <span className="text-[10px] font-semibold text-[#888] w-24">Date</span>
            <span className="text-[10px] font-semibold text-[#888] flex-1">Contract</span>
            <span className="text-[10px] font-semibold text-[#888] w-20">Revenue</span>
            <span className="text-[10px] font-semibold text-[#888] w-12">Score</span>
            <span className="text-[10px] font-semibold text-[#888] w-16">Photos</span>
            <span className="text-[10px] font-semibold text-[#888] w-20">Status</span>
          </div>
          {sessions.map((s) => <SessionRow key={s.id} session={s} />)}
        </div>
      </main>
    </>
  );
}

function SessionRow({ session: s }: { session: Awaited<ReturnType<typeof adminApi.sessions.list>>['data'][0] }) {
  return (
    <Link href={`/sessions/${s.id}`} className="block">
      <div className="table-row">
        <div className="w-24 text-xs font-medium font-mono">{s.session_ref}</div>
        <div className="w-24 text-[10px] text-[#888]">{formatDate(s.session_date)}</div>
        <div className="flex-1 text-xs text-[#666] truncate">{s.contract?.contract_ref ?? '—'}</div>
        <div className="w-20 text-xs font-medium text-[#1d9e75]">{s.gross_revenue_cents ? formatZAR(s.gross_revenue_cents) : '—'}</div>
        <div className="w-12 text-xs">{s.ai_handover_score ?? '—'}</div>
        <div className="w-16 flex gap-0.5">
          {s.before_photos_complete ? <CheckCircle className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-[#ddd]" />}
          {s.after_photos_complete ? <CheckCircle className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-[#ddd]" />}
          {s.lockup_complete ? <CheckCircle className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-[#ddd]" />}
        </div>
        <div className="w-20"><Badge status={s.status} /></div>
      </div>
    </Link>
  );
}
