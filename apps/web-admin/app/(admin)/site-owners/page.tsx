import { requireAdmin } from '../../../lib/auth';
import { adminApi } from '../../../lib/api';
import { TopBar } from '../../../components/layout/TopBar';
import { Badge } from '../../../components/ui/Badge';
import { formatDate, formatZAR } from '../../../lib/format';
import Link from 'next/link';
import { Building2, MapPin } from 'lucide-react';

export default async function SiteOwnersPage() {
  const token = requireAdmin();
  const sitesRes = await adminApi.sites.list(token).catch(() => ({ data: [] }));
  const sites = sitesRes.data;

  return (
    <>
      <TopBar title={`Site owners · ${sites.length} sites`} />
      <main className="flex-1 p-6 max-w-5xl">
        <div className="card-white overflow-hidden">
          <div className="table-hd">
            <span className="text-[10px] font-semibold text-[#888] w-48">Site</span>
            <span className="text-[10px] font-semibold text-[#888] flex-1">Location</span>
            <span className="text-[10px] font-semibold text-[#888] w-24">Rate/hr</span>
            <span className="text-[10px] font-semibold text-[#888] w-16">Score</span>
            <span className="text-[10px] font-semibold text-[#888] w-20">Status</span>
            <span className="text-[10px] font-semibold text-[#888] w-24">Listed</span>
          </div>
          {sites.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-[#aaa]">No sites found</div>
          )}
          {sites.map((site) => (
            <Link key={site.id} href={`/sites/${site.id}`} className="block">
              <div className="table-row">
                <div className="w-48">
                  <p className="text-xs font-medium truncate">{site.trading_name}</p>
                  <p className="text-[10px] text-[#aaa] truncate">{site.business_category}</p>
                </div>
                <div className="flex-1 flex items-center gap-1 text-xs text-[#666]">
                  <MapPin className="w-3 h-3 flex-shrink-0 text-[#bbb]" />
                  <span className="truncate">{site.suburb}, {site.city}</span>
                </div>
                <div className="w-24 text-xs font-medium">{formatZAR(site.hourly_rate_cents)}</div>
                <div className="w-16 text-xs">{site.site_score ?? '—'}</div>
                <div className="w-20"><Badge status={site.is_listed ? 'active' : 'pending'} label={site.is_listed ? 'Listed' : 'Unlisted'} /></div>
                <div className="w-24 text-[10px] text-[#aaa]">{formatDate(site.created_at)}</div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
