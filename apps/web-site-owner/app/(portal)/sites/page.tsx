import { requireAuth } from '../../../lib/auth';
import { api } from '../../../lib/api';
import { TopBar } from '../../../components/layout/TopBar';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { formatZAR } from '../../../lib/format';
import Link from 'next/link';
import { Building2, Plus, MapPin, Clock } from 'lucide-react';

export default async function SitesPage() {
  const token = requireAuth();
  let sites: Awaited<ReturnType<typeof api.sites.list>>['data'] = [];
  try {
    const res = await api.sites.list(token);
    sites = res.data;
  } catch { /* show empty state */ }

  return (
    <>
      <TopBar
        title="My sites"
        actions={
          <Link href="/onboarding" className="btn-primary text-xs px-3 py-1.5">
            <Plus className="w-3.5 h-3.5" /> Add site
          </Link>
        }
      />
      <main className="flex-1 p-6 max-w-3xl">
        {sites.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No sites yet"
            description="Add your first site to start listing your kitchen for zombie operators."
            action={
              <Link href="/onboarding" className="btn-primary text-xs">
                <Plus className="w-3.5 h-3.5" /> Add site
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {sites.map((site) => (
              <Link key={site.id} href={`/sites/${site.id}`}>
                <div className="card-white hover:border-[#1d9e75] transition-colors cursor-pointer">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-medium">{site.trading_name}</h3>
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] text-[#888]">
                        <MapPin className="w-3 h-3" />
                        {site.address_line1}, {site.suburb}, {site.city}
                      </div>
                    </div>
                    <Badge status={site.is_listed ? 'active' : 'pending'} label={site.is_listed ? 'Listed' : 'Unlisted'} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="rounded-lg p-2 text-center" style={{ background: '#f2f2f0' }}>
                      <div className="text-xs font-medium">{formatZAR(site.hourly_rate_cents)}/hr</div>
                      <div className="text-[10px] text-[#888]">Hourly rate</div>
                    </div>
                    <div className="rounded-lg p-2 text-center" style={{ background: '#f2f2f0' }}>
                      <div className="text-xs font-medium">{site.score_tier ?? '—'}</div>
                      <div className="text-[10px] text-[#888]">Tier</div>
                    </div>
                    <div className="rounded-lg p-2 text-center" style={{ background: '#f2f2f0' }}>
                      <div className="flex items-center justify-center gap-1 text-xs font-medium">
                        <Clock className="w-3 h-3" />
                        {site.site_opens_time ?? '—'}
                      </div>
                      <div className="text-[10px] text-[#888]">Opens</div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
