import { requireAdmin } from '../../../lib/auth';
import { adminApi } from '../../../lib/api';
import { TopBar } from '../../../components/layout/TopBar';
import { Badge } from '../../../components/ui/Badge';
import { formatZAR, formatDate, statusPill, statusLabel } from '../../../lib/format';
import Link from 'next/link';
import {
  Building2, Users, Clock, Banknote, AlertTriangle,
  TrendingUp, CheckCircle, UserCheck,
} from 'lucide-react';

export default async function DashboardPage() {
  const token = requireAdmin();

  const [sitesR, operatorsR, sessionsR, settlementsR, disputesR] = await Promise.allSettled([
    adminApi.sites.list(token, { limit: '100' }),
    adminApi.operators.list(token, { limit: '100' }),
    adminApi.sessions.list(token, { limit: '10' }),
    adminApi.settlements.list(token, { limit: '10' }),
    adminApi.disputes.list(token, { limit: '10' }),
  ]);

  const sites = sitesR.status === 'fulfilled' ? sitesR.value.data : [];
  const operators = operatorsR.status === 'fulfilled' ? operatorsR.value.data : [];
  const sessions = sessionsR.status === 'fulfilled' ? sessionsR.value.data : [];
  const settlements = settlementsR.status === 'fulfilled' ? settlementsR.value.data : [];
  const disputes = disputesR.status === 'fulfilled' ? disputesR.value.data : [];

  const activeSessions = sessions.filter((s) => s.status === 'active').length;
  const pendingVetting = operators.filter((o) => o.vetting_status === 'pending').length;
  const openDisputes = disputes.filter((d) => ['open', 'under_review'].includes(d.status)).length;
  const readySettlements = settlements.filter((s) => s.status === 'ready').length;
  const totalPlatformRevenue = settlements
    .filter((s) => s.status === 'released')
    .reduce((sum, s) => sum + Number(s.platform_fee_cents), 0);

  const stats = [
    { label: 'Active sites', val: sites.filter((s) => s.is_listed).length, icon: Building2, href: '/sites', color: '#1d9e75' },
    { label: 'Approved operators', val: operators.filter((o) => o.vetting_status === 'approved').length, icon: Users, href: '/operators', color: '#1e40af' },
    { label: 'Live sessions now', val: activeSessions, icon: Clock, href: '/sessions', color: '#16a34a' },
    { label: 'Pending vetting', val: pendingVetting, icon: UserCheck, href: '/vetting', color: '#92400e' },
    { label: 'Open disputes', val: openDisputes, icon: AlertTriangle, href: '/disputes', color: '#991b1b' },
    { label: 'Settlements to release', val: readySettlements, icon: Banknote, href: '/settlements', color: '#4c1d95' },
    { label: 'Platform revenue (all)', val: formatZAR(totalPlatformRevenue), icon: TrendingUp, href: '/settlements', color: '#1d9e75' },
    { label: 'Total sessions', val: sessions.length, icon: CheckCircle, href: '/sessions', color: '#1a1a1a' },
  ];

  return (
    <>
      <TopBar title="Platform overview" />
      <main className="flex-1 p-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {stats.map(({ label, val, icon: Icon, href, color }) => (
            <Link key={label} href={href}>
              <div className="card-white hover:border-[#1d9e75] transition-colors cursor-pointer">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4" style={{ color }} />
                  <span className="text-[10px] text-[#888]">{label}</span>
                </div>
                <div className="text-xl font-medium" style={{ color }}>{val}</div>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Recent sessions */}
          <div className="card-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#1d9e75]" />
                <span className="text-xs font-medium">Recent sessions</span>
              </div>
              <Link href="/sessions" className="text-[10px] text-[#1d9e75]">View all →</Link>
            </div>
            {sessions.slice(0, 6).map((s) => (
              <Link key={s.id} href={`/sessions/${s.id}`} className="block">
                <div className="row-item">
                  <div>
                    <p className="text-xs font-medium">{s.session_ref}</p>
                    <p className="text-[10px] text-[#aaa]">{formatDate(s.session_date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.gross_revenue_cents && <span className="text-[10px] text-[#1d9e75]">{formatZAR(s.gross_revenue_cents)}</span>}
                    <Badge status={s.status} />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Open disputes */}
          <div className="card-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#1d9e75]" />
                <span className="text-xs font-medium">Disputes requiring attention</span>
              </div>
              <Link href="/disputes" className="text-[10px] text-[#1d9e75]">View all →</Link>
            </div>
            {disputes.filter((d) => ['open', 'under_review'].includes(d.status)).length === 0 ? (
              <p className="text-xs text-[#aaa] py-4 text-center">No open disputes</p>
            ) : (
              disputes.filter((d) => ['open', 'under_review'].includes(d.status)).slice(0, 5).map((d) => (
                <Link key={d.id} href={`/disputes/${d.id}`} className="block">
                  <div className="row-item">
                    <div>
                      <p className="text-xs font-medium">{d.dispute_ref}</p>
                      <p className="text-[10px] text-[#aaa] capitalize">{d.claim_type.replace('_', ' ')} · {formatZAR(d.claim_amount_cents)}</p>
                    </div>
                    <Badge status={d.status} />
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Settlements to process */}
          <div className="card-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-[#1d9e75]" />
                <span className="text-xs font-medium">Settlements queue</span>
              </div>
              <Link href="/settlements" className="text-[10px] text-[#1d9e75]">View all →</Link>
            </div>
            {settlements.length === 0 ? (
              <p className="text-xs text-[#aaa] py-4 text-center">No settlements</p>
            ) : (
              settlements.slice(0, 5).map((s) => (
                <Link key={s.id} href={`/settlements/${s.id}`} className="block">
                  <div className="row-item">
                    <div>
                      <p className="text-xs font-medium">{s.settlement_ref}</p>
                      <p className="text-[10px] text-[#aaa]">{s.operator?.user?.full_name ?? '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-[#1d9e75]">{formatZAR(s.operator_payout_cents)}</p>
                      <Badge status={s.status} />
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Vetting queue */}
          <div className="card-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#1d9e75]" />
                <span className="text-xs font-medium">Vetting queue</span>
              </div>
              <Link href="/vetting" className="text-[10px] text-[#1d9e75]">View all →</Link>
            </div>
            {operators.filter((o) => o.vetting_status === 'pending').length === 0 ? (
              <p className="text-xs text-[#aaa] py-4 text-center">Queue clear</p>
            ) : (
              operators.filter((o) => o.vetting_status === 'pending').slice(0, 5).map((o) => (
                <Link key={o.id} href={`/operators/${o.id}`} className="block">
                  <div className="row-item">
                    <div>
                      <p className="text-xs font-medium">{o.user?.full_name ?? '—'}</p>
                      <p className="text-[10px] text-[#aaa]">{o.trading_concept}</p>
                    </div>
                    <Badge status={o.vetting_status} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </main>
    </>
  );
}
