'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StepDots } from '../../../components/ui/StepDots';
import { Spinner } from '../../../components/ui/Spinner';
import { ArrowRight, Upload, CheckCircle, X, Plus, Trash2 } from 'lucide-react';

type Step = 'business' | 'documents' | 'fee-review' | 'slots' | 'upside' | 'checklist' | 'contract' | 'sign';
const STEPS: Step[] = ['business', 'documents', 'fee-review', 'slots', 'upside', 'checklist', 'contract', 'sign'];
const STEP_LABELS = ['Business', 'Documents', 'Fee review', 'Slots', 'Upside', 'Checklist', 'Contract', 'Sign'];

interface ChecklistItemDraft {
  area_name: string;
  area_category: string;
  description: string;
  is_required: boolean;
}

interface SlotDraft {
  day_of_week: string;
  slot_start_time: string;
  slot_end_time: string;
  upside_model: string;
  upside_fixed_pct: string;
  upside_variable_pct: string;
}

const DAY_OPTIONS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('business');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [siteId, setSiteId] = useState<string | null>(null);

  // Business step
  const [tradingName, setTradingName] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [suburb, setSuburb] = useState('');
  const [city, setCity] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [monthlyUtilities, setMonthlyUtilities] = useState('');
  const [opHours, setOpHours] = useState('720');
  const [openTime, setOpenTime] = useState('20:00');
  const [closeTime, setCloseTime] = useState('00:00');
  const [zombieEnd, setZombieEnd] = useState('06:00');
  const [consentStatus, setConsentStatus] = useState<'landlord_verified' | 'uploaded' | 'pending'>('pending');

  // Documents step
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, boolean>>({
    lease: false, bank_statements: false, utility_bill: false,
  });
  const [aiExtracted, setAiExtracted] = useState<Record<string, string>>({});

  // Upside model
  const [upsideModel, setUpsideModel] = useState<'fixed' | 'variable'>('fixed');
  const [upsideFixedPct, setUpsideFixedPct] = useState('30');
  const [upsideVariablePct, setUpsideVariablePct] = useState('25');

  // Slots
  const [slots, setSlots] = useState<SlotDraft[]>([
    { day_of_week: 'fri', slot_start_time: '20:00', slot_end_time: '06:00', upside_model: 'fixed', upside_fixed_pct: '30', upside_variable_pct: '25' },
    { day_of_week: 'sat', slot_start_time: '20:00', slot_end_time: '06:00', upside_model: 'fixed', upside_fixed_pct: '30', upside_variable_pct: '25' },
  ]);

  // Checklist
  const [checklistItems, setChecklistItems] = useState<ChecklistItemDraft[]>([
    { area_name: 'Main kitchen', area_category: 'kitchen', description: 'All surfaces, appliances, floors', is_required: true },
    { area_name: 'Fryer station', area_category: 'equipment', description: 'Deep fryers and surrounding area', is_required: true },
    { area_name: 'Cold storage', area_category: 'equipment', description: 'Fridges and freezers', is_required: true },
    { area_name: 'Back door / loading', area_category: 'security', description: 'Locked and secured', is_required: true },
  ]);

  const stepIndex = STEPS.indexOf(step);
  const next = () => setStep(STEPS[stepIndex + 1]);
  const back = () => setStep(STEPS[stepIndex - 1]);

  // ── Save business + create site ───────────────────────────────────────────
  const handleSaveBusiness = async () => {
    setError('');
    if (!tradingName || !category || !address || !suburb || !city) {
      setError('Please fill in all required fields'); return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trading_name: tradingName,
          business_category: category,
          address_line1: address,
          suburb,
          city,
          latitude: -26.2041,
          longitude: 28.0473,
          monthly_rent_cents: Math.round(parseFloat(monthlyRent || '0') * 100),
          monthly_utilities_cents: Math.round(parseFloat(monthlyUtilities || '0') * 100),
          site_operating_hours_per_month: parseInt(opHours) || 720,
          site_opens_time: openTime,
          site_closes_time: closeTime,
          zombie_end_time: zombieEnd,
          consent_status: consentStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save site'); return; }
      setSiteId(data.data.id);
      next();
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  // ── Mock document upload ───────────────────────────────────────────────────
  const handleUpload = (key: string) => {
    setUploadedDocs((prev) => ({ ...prev, [key]: true }));
    const extracted: Record<string, string> = {
      lease: 'R15,000/month rent',
      bank_statements: 'avg R148,500/month revenue',
      utility_bill: 'R2,980/month utilities',
    };
    if (extracted[key]) {
      setAiExtracted((prev) => ({ ...prev, [key]: extracted[key] }));
    }
  };

  // ── Save slots ─────────────────────────────────────────────────────────────
  const handleSaveSlots = async () => {
    if (!siteId || slots.length === 0) { next(); return; }
    setLoading(true);
    try {
      for (const slot of slots) {
        await fetch(`/api/sites/${siteId}/slots`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            day_of_week: slot.day_of_week,
            slot_start_time: slot.slot_start_time,
            slot_end_time: slot.slot_end_time,
            upside_model: upsideModel,
            upside_fixed_pct: parseFloat(upsideFixedPct) || null,
            upside_variable_pct: parseFloat(upsideVariablePct) || null,
          }),
        });
      }
      next();
    } catch { setError('Failed to save slots'); }
    finally { setLoading(false); }
  };

  // ── Save checklist ─────────────────────────────────────────────────────────
  const handleSaveChecklist = async () => {
    if (!siteId) { next(); return; }
    setLoading(true);
    try {
      for (let i = 0; i < checklistItems.length; i++) {
        await fetch(`/api/sites/${siteId}/checklist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...checklistItems[i], sort_order: i + 1 }),
        });
      }
      next();
    } catch { setError('Failed to save checklist'); }
    finally { setLoading(false); }
  };

  // ── Final sign ─────────────────────────────────────────────────────────────
  const handleSign = async () => {
    setLoading(true);
    try {
      if (siteId) {
        await fetch(`/api/sites/${siteId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_listed: true }),
        });
      }
      router.push('/dashboard');
    } catch { setError('Failed to go live'); }
    finally { setLoading(false); }
  };

  const hourlyRate = monthlyRent && monthlyUtilities && opHours
    ? (((parseFloat(monthlyRent) + parseFloat(monthlyUtilities)) / parseInt(opHours)) * (1 + parseFloat(upsideFixedPct) / 100)).toFixed(2)
    : null;

  return (
    <div className="min-h-screen" style={{ background: '#f8f8f6' }}>
      <div className="border-b border-[#e8e8e8] bg-white px-6 py-3 flex items-center gap-4 sticky top-0 z-10">
        <span className="text-sm font-medium" style={{ color: '#1d9e75' }}>zombietech</span>
        <span className="text-xs text-[#aaa]">Site setup — {STEP_LABELS[stepIndex]}</span>
      </div>

      <div className="max-w-lg mx-auto px-6 py-10">
        <StepDots total={STEPS.length} current={stepIndex} />

        {/* ── STEP 1: Business details ──────────────────────────────────── */}
        {step === 'business' && (
          <>
            <h2 className="text-xl font-medium mb-1">Tell us about your business</h2>
            <p className="page-sub">This is the business that owns or operates the site you want to list.</p>

            <div className="mb-3">
              <label className="label">Trading name *</label>
              <input className="input" value={tradingName} onChange={(e) => setTradingName(e.target.value)} placeholder="ABC Pizza" />
            </div>
            <div className="mb-3">
              <label className="label">Business category *</label>
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Select category…</option>
                {['Restaurant', 'Bakery', 'Catering', 'Bar & Grill', 'Café', 'Food production', 'Other'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="label">Street address *</label>
              <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="14 Main Road, Bryanston" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="label">Suburb *</label>
                <input className="input" value={suburb} onChange={(e) => setSuburb(e.target.value)} placeholder="Bryanston" />
              </div>
              <div>
                <label className="label">City *</label>
                <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Johannesburg" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="label">Monthly rent (R)</label>
                <input className="input" type="number" value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} placeholder="15000" />
              </div>
              <div>
                <label className="label">Monthly utilities (R)</label>
                <input className="input" type="number" value={monthlyUtilities} onChange={(e) => setMonthlyUtilities(e.target.value)} placeholder="2980" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="label">Kitchen opens</label>
                <input className="input" type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
              </div>
              <div>
                <label className="label">Kitchen closes</label>
                <input className="input" type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
              </div>
              <div>
                <label className="label">Zombie ends</label>
                <input className="input" type="time" value={zombieEnd} onChange={(e) => setZombieEnd(e.target.value)} />
              </div>
            </div>

            <div className="mb-4">
              <label className="label">Landlord consent</label>
              <div className="flex gap-2 mt-1">
                {[
                  { val: 'landlord_verified', title: 'Landlord verified', sub: 'In ZombieTech partner programme' },
                  { val: 'uploaded', title: 'I have consent', sub: 'Signed consent letter' },
                  { val: 'pending', title: 'I need consent', sub: 'ZombieTech will help' },
                ].map(({ val, title, sub }) => (
                  <button
                    key={val}
                    onClick={() => setConsentStatus(val as typeof consentStatus)}
                    className={`flex-1 p-2.5 rounded-xl border text-left transition-all ${consentStatus === val ? 'border-[#1d9e75]' : 'border-[#e8e8e8] bg-[#f8f8f6]'}`}
                    style={consentStatus === val ? { background: '#e8f7f0' } : {}}
                  >
                    <div className="text-xs font-medium" style={{ color: consentStatus === val ? '#166534' : '#555' }}>{title}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: consentStatus === val ? '#4ade80' : '#aaa' }}>{sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
            <button onClick={handleSaveBusiness} disabled={loading} className="btn-primary w-full">
              {loading ? <Spinner size="sm" /> : <>Save & continue <ArrowRight className="w-4 h-4" /></>}
            </button>
          </>
        )}

        {/* ── STEP 2: Documents ────────────────────────────────────────── */}
        {step === 'documents' && (
          <>
            <h2 className="text-xl font-medium mb-1">Upload your site documents</h2>
            <p className="page-sub">Our AI reads your lease and utility bill to calculate your exact zombie session fee — based on real costs.</p>

            {[
              { key: 'lease', title: 'Lease agreement', sub: 'PDF — rent, term, conditions' },
              { key: 'bank_statements', title: '3 months bank statements', sub: 'PDF — last 3 months' },
              { key: 'utility_bill', title: 'Latest utility bill', sub: 'PDF or JPG — Eskom / City Power' },
            ].map(({ key, title, sub }) => (
              <div
                key={key}
                onClick={() => !uploadedDocs[key] && handleUpload(key)}
                className={`rounded-xl border-2 p-4 mb-3 text-center cursor-pointer transition-all ${uploadedDocs[key] ? 'border-solid' : 'border-dashed hover:border-[#1d9e75]'}`}
                style={uploadedDocs[key] ? { borderColor: '#a3d9bc', background: '#e8f7f0' } : { borderColor: '#d0d0d0' }}
              >
                <div
                  className="w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center"
                  style={{ background: uploadedDocs[key] ? '#a3d9bc' : '#f0f0f0' }}
                >
                  {uploadedDocs[key]
                    ? <CheckCircle className="w-4 h-4 text-white" />
                    : <Upload className="w-4 h-4 text-[#bbb]" />}
                </div>
                <p className="text-xs font-medium" style={{ color: uploadedDocs[key] ? '#166534' : '#555' }}>{title}</p>
                <p className="text-[10px] mt-0.5" style={{ color: uploadedDocs[key] ? '#4ade80' : '#aaa' }}>
                  {uploadedDocs[key] ? `✓ Uploaded — AI extracted: ${aiExtracted[key]}` : sub}
                </p>
              </div>
            ))}

            <div className="rounded-xl p-3 mb-4" style={{ background: '#e8f0fc', borderColor: '#9db8f0', border: '1px solid' }}>
              <p className="text-xs leading-relaxed" style={{ color: '#1e40af' }}>
                Your documents are encrypted and stored securely. Never shared with operators. Used only to verify eligibility and calculate fees.
              </p>
            </div>

            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
            <div className="flex gap-3">
              <button onClick={back} className="btn-secondary flex-1">← Back</button>
              <button onClick={next} className="btn-primary flex-1">
                {Object.values(uploadedDocs).some(Boolean) ? 'Calculate my fee →' : 'Skip for now →'}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 3: AI fee review ──────────────────────────────────────── */}
        {step === 'fee-review' && (
          <>
            <h2 className="text-xl font-medium mb-1">Your calculated session fee</h2>
            <p className="page-sub">Based on your documents, here is how your zombie session fee is calculated.</p>

            <div className="card mb-4" style={{ background: '#e8f7f0', borderColor: '#a3d9bc' }}>
              <div className="section-title">AI-extracted cost data</div>
              {[
                { label: 'Monthly rent', val: monthlyRent ? `R${parseFloat(monthlyRent).toLocaleString('en-ZA')}` : 'R15,000', src: 'From lease agreement' },
                { label: 'Monthly utilities', val: monthlyUtilities ? `R${parseFloat(monthlyUtilities).toLocaleString('en-ZA')}` : 'R2,980', src: 'From utility bill' },
                { label: 'Operating hours/month', val: opHours || '720', src: 'From site schedule' },
                { label: 'Blended hourly rate', val: `R${((parseFloat(monthlyRent || '15000') + parseFloat(monthlyUtilities || '2980')) / parseInt(opHours || '720')).toFixed(2)}`, src: 'Calculated' },
              ].map(({ label, val, src }) => (
                <div key={label} className="flex items-start py-2 border-b border-[#f0f0f0] last:border-0">
                  <div className="flex-1">
                    <p className="text-xs text-[#888]">{label}</p>
                    <p className="text-[10px] text-[#bbb]">{src}</p>
                  </div>
                  <p className="text-xs font-medium">{val}</p>
                </div>
              ))}
            </div>

            <div className="card mb-4">
              <div className="section-title">Recommended zombie session fee</div>
              <div className="text-2xl font-medium mb-1" style={{ color: '#1d9e75' }}>
                {hourlyRate ? `R${hourlyRate}/hr` : 'R24.97/hr'}
              </div>
              <p className="text-xs text-[#888]">Cost recovery + {upsideFixedPct}% fixed upside = R{hourlyRate ?? '24.97'}/hr blended</p>
              <p className="text-xs text-[#aaa] mt-1">You can adjust this on the next screen</p>
            </div>

            <div className="flex gap-3">
              <button onClick={back} className="btn-secondary flex-1">← Back</button>
              <button onClick={next} className="btn-primary flex-1">Looks good, continue →</button>
            </div>
          </>
        )}

        {/* ── STEP 4: Slot scheduler ─────────────────────────────────────── */}
        {step === 'slots' && (
          <>
            <h2 className="text-xl font-medium mb-1">Set your zombie hours</h2>
            <p className="page-sub">Which nights can zombie operators use your kitchen? Add a slot for each available day.</p>

            {slots.map((slot, i) => (
              <div key={i} className="card-white mb-3">
                <div className="flex items-center justify-between mb-2">
                  <select
                    className="input w-auto"
                    value={slot.day_of_week}
                    onChange={(e) => setSlots((s) => s.map((sl, j) => j === i ? { ...sl, day_of_week: e.target.value } : sl))}
                  >
                    {DAY_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                    ))}
                  </select>
                  <button onClick={() => setSlots((s) => s.filter((_, j) => j !== i))} className="text-[#bbb] hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Start time</label>
                    <input className="input" type="time" value={slot.slot_start_time}
                      onChange={(e) => setSlots((s) => s.map((sl, j) => j === i ? { ...sl, slot_start_time: e.target.value } : sl))} />
                  </div>
                  <div>
                    <label className="label">End time</label>
                    <input className="input" type="time" value={slot.slot_end_time}
                      onChange={(e) => setSlots((s) => s.map((sl, j) => j === i ? { ...sl, slot_end_time: e.target.value } : sl))} />
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={() => setSlots((s) => [...s, { day_of_week: 'sun', slot_start_time: '20:00', slot_end_time: '06:00', upside_model: 'fixed', upside_fixed_pct: '30', upside_variable_pct: '25' }])}
              className="btn-secondary w-full mb-4"
            >
              <Plus className="w-4 h-4" /> Add another slot
            </button>

            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
            <div className="flex gap-3">
              <button onClick={back} className="btn-secondary flex-1">← Back</button>
              <button onClick={handleSaveSlots} disabled={loading} className="btn-primary flex-1">
                {loading ? <Spinner size="sm" /> : <>Save slots →</>}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 5: Upside model ───────────────────────────────────────── */}
        {step === 'upside' && (
          <>
            <h2 className="text-xl font-medium mb-1">Choose your upside model</h2>
            <p className="page-sub">How do you want to earn above your cost recovery? Choose the model that suits your risk appetite.</p>

            <div className="flex gap-3 mb-4">
              {[
                { val: 'fixed', title: 'Fixed % markup', sub: 'Guaranteed upside above cost. Predictable income regardless of how the operator performs.' },
                { val: 'variable', title: 'Variable profit share', sub: 'A % of zombie operator net profit. Higher potential upside, but depends on their performance.' },
              ].map(({ val, title, sub }) => (
                <button
                  key={val}
                  onClick={() => setUpsideModel(val as 'fixed' | 'variable')}
                  className={`flex-1 p-3 rounded-xl border-2 text-left transition-all ${upsideModel === val ? 'border-[#1d9e75]' : 'border-[#e8e8e8] bg-[#f8f8f6]'}`}
                  style={upsideModel === val ? { background: '#e8f7f0' } : {}}
                >
                  <div className="text-xs font-medium mb-1" style={{ color: upsideModel === val ? '#166534' : '#555' }}>{title}</div>
                  <div className="text-[10px] leading-relaxed" style={{ color: upsideModel === val ? '#4ade80' : '#aaa' }}>{sub}</div>
                </button>
              ))}
            </div>

            {upsideModel === 'fixed' && (
              <div className="mb-4">
                <label className="label">Fixed upside percentage</label>
                <div className="flex items-center gap-2">
                  <input className="input w-24" type="number" value={upsideFixedPct} onChange={(e) => setUpsideFixedPct(e.target.value)} min="0" max="100" />
                  <span className="text-sm text-[#555]">% above cost recovery</span>
                </div>
                <p className="text-xs text-[#aaa] mt-1">e.g. 30% means you earn cost + 30% on every session</p>
              </div>
            )}

            {upsideModel === 'variable' && (
              <div className="mb-4">
                <label className="label">Variable profit share percentage</label>
                <div className="flex items-center gap-2">
                  <input className="input w-24" type="number" value={upsideVariablePct} onChange={(e) => setUpsideVariablePct(e.target.value)} min="0" max="100" />
                  <span className="text-sm text-[#555]">% of operator net profit</span>
                </div>
                <p className="text-xs text-[#aaa] mt-1">e.g. 25% means you share 25% of whatever the operator nets per session</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={back} className="btn-secondary flex-1">← Back</button>
              <button onClick={next} className="btn-primary flex-1">Save & continue →</button>
            </div>
          </>
        )}

        {/* ── STEP 6: Checklist builder ──────────────────────────────────── */}
        {step === 'checklist' && (
          <>
            <h2 className="text-xl font-medium mb-1">Site lock-up checklist</h2>
            <p className="page-sub">Define the areas operators must photograph at lock-up. These appear in the sequential checklist after every session.</p>

            {checklistItems.map((item, i) => (
              <div key={i} className="card-white mb-2 flex items-center gap-3">
                <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
                  style={{ background: '#e8f7f0', color: '#166534' }}>{i + 1}</div>
                <div className="flex-1">
                  <input
                    className="input text-xs mb-1"
                    value={item.area_name}
                    onChange={(e) => setChecklistItems((ci) => ci.map((c, j) => j === i ? { ...c, area_name: e.target.value } : c))}
                    placeholder="Area name"
                  />
                  <select
                    className="input text-xs"
                    value={item.area_category}
                    onChange={(e) => setChecklistItems((ci) => ci.map((c, j) => j === i ? { ...c, area_category: e.target.value } : c))}
                  >
                    {['kitchen', 'equipment', 'security', 'custom'].map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <button onClick={() => setChecklistItems((ci) => ci.filter((_, j) => j !== i))} className="text-[#bbb] hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            <button
              onClick={() => setChecklistItems((ci) => [...ci, { area_name: '', area_category: 'kitchen', description: '', is_required: true }])}
              className="btn-secondary w-full mb-4"
            >
              <Plus className="w-4 h-4" /> Add checklist item
            </button>

            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
            <div className="flex gap-3">
              <button onClick={back} className="btn-secondary flex-1">← Back</button>
              <button onClick={handleSaveChecklist} disabled={loading} className="btn-primary flex-1">
                {loading ? <Spinner size="sm" /> : <>Save checklist →</>}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 7: Contract preview ───────────────────────────────────── */}
        {step === 'contract' && (
          <>
            <h2 className="text-xl font-medium mb-1">Review your standard contract</h2>
            <p className="page-sub">All zombie sessions are governed by the ZombieTech standard agreement. Review the key terms below.</p>

            <div className="card-white mb-4">
              <div className="section-title">Key contract terms</div>
              {[
                { label: 'Notice period', val: '30 days — either party' },
                { label: 'Platform fee', val: '10% of zombie operator gross revenue' },
                { label: 'Goodwill threshold', val: '6 sessions with ≥80% clean handover rate' },
                { label: 'Goodwill fee', val: '8% of operator gross revenue for early site owner exit' },
                { label: 'Deactivation fee', val: '15% if operator violates terms' },
                { label: 'Dispute window', val: 'Raise claims by Monday 12:00 SAST' },
                { label: 'Auto-settlement', val: 'Released Monday afternoon if no dispute raised' },
              ].map(({ label, val }) => (
                <div key={label} className="row-item text-xs">
                  <span className="text-[#666]">{label}</span>
                  <span className="font-medium text-right max-w-[55%]">{val}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl p-3 mb-4" style={{ background: '#e8f0fc', borderColor: '#9db8f0', border: '1px solid' }}>
              <p className="text-xs leading-relaxed" style={{ color: '#1e40af' }}>
                This is the ZombieTech standard zombie services agreement. Commercial terms (hourly rate, upside model) are locked at the time the operator signs.
                Contact <strong>legal@zombietech.co.za</strong> for custom terms.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={back} className="btn-secondary flex-1">← Back</button>
              <button onClick={next} className="btn-primary flex-1">Accept & sign →</button>
            </div>
          </>
        )}

        {/* ── STEP 8: Sign & go live ─────────────────────────────────────── */}
        {step === 'sign' && (
          <>
            <h2 className="text-xl font-medium mb-1">Sign & go live</h2>
            <p className="page-sub">Verify your identity one more time to digitally sign the platform agreement and publish your listing.</p>

            <div className="card mb-4" style={{ background: '#e8f7f0', borderColor: '#a3d9bc' }}>
              <div className="section-title">Summary</div>
              {[
                { label: 'Site', val: tradingName || 'Your site' },
                { label: 'Location', val: suburb && city ? `${suburb}, ${city}` : '—' },
                { label: 'Zombie slots', val: `${slots.length} slot${slots.length !== 1 ? 's' : ''}` },
                { label: 'Checklist items', val: `${checklistItems.length} items` },
                { label: 'Upside model', val: upsideModel === 'fixed' ? `Fixed ${upsideFixedPct}%` : `Variable ${upsideVariablePct}%` },
              ].map(({ label, val }) => (
                <div key={label} className="row-item text-xs">
                  <span className="text-[#666]">{label}</span>
                  <span className="font-medium">{val}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl p-4 mb-4 border" style={{ background: '#f8f8f6', borderColor: '#e0e0e0' }}>
              <p className="text-xs text-[#555] leading-relaxed">
                By tapping <strong>Go live</strong> below, I confirm that I have read and agree to the ZombieTech Site Owner Agreement, and that the information provided about my site is accurate. A digital OTP signature has been sent to my mobile.
              </p>
            </div>

            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
            <div className="flex gap-3">
              <button onClick={back} className="btn-secondary flex-1">← Back</button>
              <button onClick={handleSign} disabled={loading} className="btn-primary flex-1">
                {loading ? <Spinner size="sm" /> : <>Go live 🧟</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
