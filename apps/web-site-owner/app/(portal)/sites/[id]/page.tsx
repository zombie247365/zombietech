import { requireAuth } from '../../../../lib/auth';
import { api } from '../../../../lib/api';
import { TopBar } from '../../../../components/layout/TopBar';
import { Badge } from '../../../../components/ui/Badge';
import { formatZAR, formatDate, statusLabel } from '../../../../lib/format';
import Link from 'next/link';
import { Settings, CalendarDays, FileText, Clock, MapPin, ChevronRight } from 'lucide-react';

interface Props { params: { id: string } }

export default async function SiteDetailPage({ params }: Props) {
  const token = requireAuth();

  const [siteRes, slotsRes, checklistRes] = await Promise.allSettled([
    api.sites.get(params.id, token),
    api.sites.slots.list(params.id, token),
    api.sites.checklist.list(params.id, token),
  ]);

  if (siteRes.status === 'rejected') {
    return (
      <>
        <TopBar title="Site not found" />
        <main className="p-6"><p className="text-sm text-red-600">Failed to load site.</p></main>
      </>
    );
  }

  const site = siteRes.value.data;
  const slots = slotsRes.status === 'fulfilled' ? slotsRes.value.data : [];
  const checklist = checklistRes.status === 'fulfilled' ? checklistRes.value.data : [];

  return (
    <>
      <TopBar
        title={site.trading_name}
        actions={
          <Link href={`/sites/${site.id}/slots`} className="btn-secondary text-xs px-3 py-1.5">
            <Settings className="w-3.5 h-3.5" /> Manage slots
          </Link>
        }
      />

      <main className="flex-1 p-6 max-w-3xl">
        {/* Hero */}
        <div className="card-white mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-base font-medium">{site.trading_name}</h2>
              <div className="flex items-center gap-1 text-xs text-[#888] mt-0.5">
                <MapPin className="w-3 h-3" />
                {site.address_line1}, {site.suburb}, {site.city}
              </div>
            </div>
            <Badge status={site.is_listed ? 'active' : 'pending'} label={site.is_listed ? 'Listed' : 'Unlisted'} />
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Hourly rate', val: formatZAR(site.hourly_rate_cents) },
              { label: 'Score', val: site.site_score?.toString() ?? '—' },
              { label: 'Tier', val: statusLabel(site.score_tier ?? 'standard') },
              { label: 'Consent', val: statusLabel(site.consent_status) },
            ].map(({ label, val }) => (
              <div key={label} className="rounded-lg p-2 text-center" style={{ background: '#f2f2f0' }}>
                <div className="text-xs font-medium">{val}</div>
                <div className="text-[10px] text-[#888]">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Hours */}
        <div className="card-white mb-4">
          <div className="section-title">Operating hours</div>
          {[
            { label: 'Kitchen opens', val: site.site_opens_time },
            { label: 'Kitchen closes', val: site.site_closes_time },
            { label: 'Zombie session ends', val: site.zombie_end_time },
            { label: 'Op hours/month', val: `${site.site_operating_hours_per_month}h` },
          ].map(({ label, val }) => (
            <div key={label} className="row-item text-xs">
              <span className="text-[#666]">{label}</span>
              <span className="font-medium flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#aaa]" /> {val ?? '—'}
              </span>
            </div>
          ))}
        </div>

        {/* Costs */}
        <div className="card-white mb-4">
          <div className="section-title">Cost data</div>
          {[
            { label: 'Monthly rent', val: formatZAR(site.monthly_rent_cents) },
            { label: 'Monthly utilities', val: formatZAR(site.monthly_utilities_cents) },
            { label: 'Blended hourly rate', val: formatZAR(site.hourly_rate_cents) },
          ].map(({ label, val }) => (
            <div key={label} className="row-item text-xs">
              <span className="text-[#666]">{label}</span>
              <span className="font-medium">{val}</span>
            </div>
          ))}
        </div>

        {/* Slots */}
        <div className="card-white mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#1d9e75]" />
              <span className="text-xs font-medium">Zombie slots ({slots.length})</span>
            </div>
            <Link href={`/sites/${site.id}/slots`} className="text-[10px] text-[#1d9e75]">
              Manage →
            </Link>
          </div>
          {slots.length === 0 ? (
            <p className="text-xs text-[#aaa]">No slots configured</p>
          ) : (
            slots.map((slot) => (
              <div key={slot.id} className="flex items-center gap-3 py-2 border-b border-[#f0f0f0] last:border-0">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: slot.status === 'booked' ? '#1d9e75' : '#e0e0e0' }}
                />
                <div className="flex-1">
                  <p className="text-xs font-medium capitalize">{slot.day_of_week}</p>
                  <p className="text-[10px] text-[#888]">{slot.slot_start_time} – {slot.slot_end_time} · {formatZAR(slot.base_fee_cents_per_session)}/session</p>
                </div>
                <Badge status={slot.status} />
              </div>
            ))
          )}
        </div>

        {/* Checklist */}
        <div className="card-white mb-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-[#1d9e75]" />
            <span className="text-xs font-medium">Lock-up checklist ({checklist.length} items)</span>
          </div>
          {checklist.length === 0 ? (
            <p className="text-xs text-[#aaa]">No checklist items</p>
          ) : (
            checklist.map((item, i) => (
              <div key={item.id} className="flex items-center gap-2 py-1.5 border-b border-[#f0f0f0] last:border-0">
                <div
                  className="w-4 h-4 rounded text-[9px] font-semibold flex items-center justify-center flex-shrink-0"
                  style={{ background: '#e8f7f0', color: '#166534' }}
                >
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="text-xs">{item.area_name}</p>
                  <p className="text-[10px] text-[#aaa] capitalize">{item.area_category}</p>
                </div>
                {item.is_required && <span className="text-[9px] text-[#1d9e75] font-medium">Required</span>}
              </div>
            ))
          )}
        </div>

        {/* Quick links */}
        <div className="card-white">
          <div className="section-title">Quick links</div>
          {[
            { href: `/bookings?site=${site.id}`, label: 'Booking requests', icon: FileText },
            { href: `/sessions?site=${site.id}`, label: 'Sessions', icon: Clock },
          ].map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex items-center gap-2 py-2.5 border-b border-[#f0f0f0] last:border-0 hover:text-[#1d9e75] transition-colors">
              <Icon className="w-4 h-4 text-[#aaa]" />
              <span className="text-xs flex-1">{label}</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#ddd]" />
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
