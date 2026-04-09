import { requireAdmin } from '../../../lib/auth';
import { adminApi } from '../../../lib/api';
import { TopBar } from '../../../components/layout/TopBar';
import { Badge } from '../../../components/ui/Badge';
import { formatDate } from '../../../lib/format';

export default async function AdminDocumentsPage() {
  const token = requireAdmin();
  const res = await adminApi.documents.list(token, { limit: '100' }).catch(() => ({ data: [] }));
  const docs = res.data;

  const needsReview = docs.filter((d) => !d.ai_parsed);
  const expiringSoon = docs.filter((d) => {
    if (!d.expires_at) return false;
    const diff = new Date(d.expires_at).getTime() - Date.now();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000; // within 30 days
  });

  return (
    <>
      <TopBar title={`Documents · ${docs.length} total`} />
      <main className="flex-1 p-6 max-w-5xl">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Total documents', val: `${docs.length}` },
            { label: 'Pending AI parse', val: `${needsReview.length}` },
            { label: 'Expiring within 30 days', val: `${expiringSoon.length}` },
          ].map(({ label, val }) => (
            <div key={label} className="stat-card">
              <p className="text-[10px] text-[#888] mb-1">{label}</p>
              <p className="text-xl font-bold text-[#1a1a1a]">{val}</p>
            </div>
          ))}
        </div>

        {/* Expiring soon */}
        {expiringSoon.length > 0 && (
          <div className="mb-5">
            <div className="section-title">Expiring soon</div>
            <div className="card-white overflow-hidden">
              <DocTable rows={expiringSoon} />
            </div>
          </div>
        )}

        {/* All documents */}
        <div className="section-title">All documents</div>
        <div className="card-white overflow-hidden">
          <DocTable rows={docs} />
        </div>
      </main>
    </>
  );
}

function DocTable({ rows }: { rows: Awaited<ReturnType<typeof adminApi.documents.list>>['data'] }) {
  return (
    <>
      <div className="table-hd">
        <span className="text-[10px] font-semibold text-[#888] flex-1">File name</span>
        <span className="text-[10px] font-semibold text-[#888] w-32">Type</span>
        <span className="text-[10px] font-semibold text-[#888] w-20">AI parsed</span>
        <span className="text-[10px] font-semibold text-[#888] w-24">Expires</span>
        <span className="text-[10px] font-semibold text-[#888] w-24">Uploaded</span>
      </div>
      {rows.length === 0 && <div className="px-4 py-8 text-center text-xs text-[#aaa]">No documents</div>}
      {rows.map((d) => (
        <div key={d.id} className="table-row">
          <div className="flex-1 text-xs truncate font-medium">{d.file_name}</div>
          <div className="w-32 text-xs text-[#666] capitalize">{d.document_type.replace(/_/g, ' ')}</div>
          <div className="w-20">
            <Badge
              status={d.ai_parsed ? 'active' : 'pending'}
              label={d.ai_parsed ? 'Yes' : 'No'}
            />
          </div>
          <div className="w-24 text-[10px] text-[#888]">{formatDate(d.expires_at)}</div>
          <div className="w-24 text-[10px] text-[#aaa]">{formatDate(d.created_at)}</div>
        </div>
      ))}
    </>
  );
}
