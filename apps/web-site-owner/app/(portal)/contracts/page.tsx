import { requireAuth } from '../../../lib/auth';
import { api } from '../../../lib/api';
import { TopBar } from '../../../components/layout/TopBar';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { formatDate, formatZAR, formatPct } from '../../../lib/format';
import Link from 'next/link';
import { FileText, CalendarDays } from 'lucide-react';

export default async function ContractsPage() {
  const token = requireAuth();
  let contracts: Awaited<ReturnType<typeof api.contracts.list>>['data'] = [];
  try {
    const res = await api.contracts.list(token);
    contracts = res.data;
  } catch { /* show empty */ }

  const active = contracts.filter((c) => c.status === 'active');
  const other = contracts.filter((c) => c.status !== 'active');

  return (
    <>
      <TopBar title="Contracts" />
      <main className="flex-1 p-6 max-w-3xl">
        {contracts.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No contracts yet"
            description="Contracts are generated automatically when you approve a booking request."
          />
        ) : (
          <>
            {active.length > 0 && (
              <div className="mb-6">
                <div className="section-title">Active contracts ({active.length})</div>
                <div className="space-y-3">
                  {active.map((c) => <ContractCard key={c.id} contract={c} />)}
                </div>
              </div>
            )}
            {other.length > 0 && (
              <div>
                <div className="section-title">Past contracts</div>
                <div className="space-y-2">
                  {other.map((c) => <ContractCard key={c.id} contract={c} />)}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

function ContractCard({ contract: c }: { contract: Awaited<ReturnType<typeof api.contracts.list>>['data'][0] }) {
  return (
    <Link href={`/contracts/${c.id}`}>
      <div className="card-white hover:border-[#1d9e75] transition-colors cursor-pointer">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-sm font-medium">{c.contract_ref}</p>
            <p className="text-xs text-[#888] mt-0.5">{c.operator?.trading_concept ?? '—'} · {c.site_slot?.site?.trading_name ?? '—'}</p>
          </div>
          <Badge status={c.status} />
        </div>
        <div className="flex gap-4 text-[10px] text-[#aaa]">
          <span>{formatZAR(c.hourly_rate_cents)}/hr</span>
          <span>{c.upside_model === 'fixed' ? `Fixed ${formatPct(c.upside_pct)}` : `Variable ${formatPct(c.upside_pct)}`}</span>
          <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Signed {formatDate(c.site_owner_signed_at)}</span>
        </div>
      </div>
    </Link>
  );
}
