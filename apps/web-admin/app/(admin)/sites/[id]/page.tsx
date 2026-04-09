import { requireAdmin } from '../../../../lib/auth';
import { adminApi } from '../../../../lib/api';
import { TopBar } from '../../../../components/layout/TopBar';
import { Badge } from '../../../../components/ui/Badge';
import { formatZAR, formatDate, statusLabel } from '../../../../lib/format';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface Props { params: { id: string } }

export default async function AdminSiteDetailPage({ params }: Props) {
  const token = requireAdmin();
  let site: Awaited<ReturnType<typeof adminApi.sites.get>>['data'] | null = null;
  try { site = (await adminApi.sites.get(params.id, token)).data; } catch {
    return (<><TopBar title="Site" /><main className="p-6"><p className="text-sm text-red-600">Not found.</p></main></>);
  }

  return (
    <>
      <TopBar title={site.trading_name} actions={
        <Link href="/sites" className="btn-secondary text-xs px-3 py-1.5"><ChevronLeft className="w-3.5 h-3.5" /> Sites</Link>
      } />
      <main className="flex-1 p-6 max-w-2xl">
        <div className="card-white mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-base font-medium">{site.trading_name}</h2>
              <p className="text-xs text-[#888]">{site.address_line1}, {site.suburb}, {site.city}</p>
            </div>
            <Badge status={site.is_listed ? 'active' : 'pending'} label={site.is_listed ? 'Listed' : 'Unlisted'} />
          </div>
          {[
            { label: 'Category', val: site.business_category },
            { label: 'Monthly rent', val: formatZAR(site.monthly_rent_cents) },
            { label: 'Monthly utilities', val: formatZAR(site.monthly_utilities_cents) },
            { label: 'Hourly rate', val: formatZAR(site.hourly_rate_cents) },
            { label: 'Consent status', val: statusLabel(site.consent_status) },
            { label: 'Site score', val: `${site.site_score}/100 (${site.score_tier})` },
            { label: 'Created', val: formatDate(site.created_at) },
          ].map(({ label, val }) => (
            <div key={label} className="row-item text-xs">
              <span className="text-[#666]">{label}</span>
              <span className="font-medium">{val}</span>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
