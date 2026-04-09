import { requireAdmin } from '../../../lib/auth';
import { adminApi } from '../../../lib/api';
import { TopBar } from '../../../components/layout/TopBar';
import { Badge } from '../../../components/ui/Badge';
import { formatZAR, formatDate } from '../../../lib/format';
import Link from 'next/link';

export default async function SitesPage() {
  const token = requireAdmin();
  const res = await adminApi.sites.list(token).catch(() => ({ data: [] }));
  const sites = res.data;

  return (
    <>
      <TopBar title={`Sites · ${sites.length} total`} />
      <main className="flex-1 p-6 max-w-5xl">
        <div className="card-white overflow-hidden">
          <div className="table-hd">
            <span className="text-[10px] font-semibold text-[#888] w-44">Site</span>
            <span className="text-[10px] font-semibold text-[#888] flex-1">Location</span>
            <span className="text-[10px] font-semibold text-[#888] w-24">Rate/hr</span>
            <span className="text-[10px] font-semibold text-[#888] w-20">Consent</span>
            <span className="text-[10px] font-semibold text-[#888] w-20">Listed</span>
            <span className="text-[10px] font-semibold text-[#888] w-24">Created</span>
          </div>
          {sites.length === 0 && <div className="px-4 py-8 text-center text-xs text-[#aaa]">No sites</div>}
          {sites.map((site) => (
            <Link key={site.id} href={`/sites/${site.id}`} className="block">
              <div className="table-row">
                <div className="w-44">
                  <p className="text-xs font-medium truncate">{site.trading_name}</p>
                  <p className="text-[10px] text-[#aaa] truncate">{site.business_category}</p>
                </div>
                <div className="flex-1 text-xs text-[#666] truncate">{site.suburb}, {site.city}</div>
                <div className="w-24 text-xs font-medium">{formatZAR(site.hourly_rate_cents)}</div>
                <div className="w-20"><Badge status={site.consent_status} /></div>
                <div className="w-20"><Badge status={site.is_listed ? 'active' : 'pending'} label={site.is_listed ? 'Yes' : 'No'} /></div>
                <div className="w-24 text-[10px] text-[#aaa]">{formatDate(site.created_at)}</div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
