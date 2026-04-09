'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TopBar } from '../../../../../components/layout/TopBar';
import { Badge } from '../../../../../components/ui/Badge';
import { Spinner } from '../../../../../components/ui/Spinner';
import { formatZAR } from '../../../../../lib/format';
import { Plus, Trash2, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import type { SiteSlot } from '../../../../../lib/api';

const DAY_OPTIONS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export default function SlotConfigPage() {
  const { id: siteId } = useParams<{ id: string }>();
  const router = useRouter();
  const [slots, setSlots] = useState<SiteSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  // New slot form
  const [newDay, setNewDay] = useState('fri');
  const [newStart, setNewStart] = useState('20:00');
  const [newEnd, setNewEnd] = useState('06:00');
  const [newModel, setNewModel] = useState<'fixed' | 'variable'>('fixed');
  const [newFixed, setNewFixed] = useState('30');
  const [newVariable, setNewVariable] = useState('25');

  useEffect(() => {
    fetch(`/api/sites/${siteId}/slots`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setSlots(d.data ?? []))
      .catch(() => setError('Failed to load slots'))
      .finally(() => setLoading(false));
  }, [siteId]);

  const handleAdd = async () => {
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/sites/${siteId}/slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          day_of_week: newDay,
          slot_start_time: newStart,
          slot_end_time: newEnd,
          upside_model: newModel,
          upside_fixed_pct: newModel === 'fixed' ? parseFloat(newFixed) : null,
          upside_variable_pct: newModel === 'variable' ? parseFloat(newVariable) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create slot'); return; }
      setSlots((s) => [...s, data.data]);
      setShowAdd(false);
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (slotId: string) => {
    if (!confirm('Remove this slot?')) return;
    try {
      await fetch(`/api/sites/${siteId}/slots/${slotId}`, { method: 'DELETE', credentials: 'include' });
      setSlots((s) => s.filter((sl) => sl.id !== slotId));
    } catch { setError('Failed to delete slot'); }
  };

  return (
    <>
      <TopBar
        title="Slot configuration"
        actions={
          <Link href={`/sites/${siteId}`} className="btn-secondary text-xs px-3 py-1.5">
            <ChevronLeft className="w-3.5 h-3.5" /> Back to site
          </Link>
        }
      />
      <main className="flex-1 p-6 max-w-2xl">
        <p className="page-sub">Manage available zombie time slots for this site.</p>

        {error && <p className="text-xs text-red-600 mb-4">{error}</p>}

        {loading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <div className="space-y-2 mb-4">
            {slots.length === 0 && !showAdd && (
              <p className="text-xs text-[#aaa] py-4">No slots configured.</p>
            )}
            {slots.map((slot) => (
              <div key={slot.id} className="card-white flex items-center gap-3">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: slot.status === 'booked' ? '#1d9e75' : '#e0e0e0' }}
                />
                <div className="flex-1">
                  <p className="text-xs font-medium capitalize">{slot.day_of_week}</p>
                  <p className="text-[10px] text-[#888]">
                    {slot.slot_start_time} – {slot.slot_end_time} ·{' '}
                    {formatZAR(slot.base_fee_cents_per_session)}/session ·{' '}
                    {slot.upside_model === 'fixed' ? `Fixed ${slot.upside_fixed_pct}%` : `Variable ${slot.upside_variable_pct}%`}
                  </p>
                </div>
                <Badge status={slot.status} />
                {slot.status === 'open' && (
                  <button onClick={() => handleDelete(slot.id)} className="text-[#bbb] hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {showAdd ? (
          <div className="card-white">
            <div className="section-title">New slot</div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="label">Day</label>
                <select className="input" value={newDay} onChange={(e) => setNewDay(e.target.value)}>
                  {DAY_OPTIONS.map((d) => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Start</label>
                <input className="input" type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
              </div>
              <div>
                <label className="label">End</label>
                <input className="input" type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
              </div>
            </div>
            <div className="mb-3">
              <label className="label">Upside model</label>
              <div className="flex gap-2">
                {['fixed', 'variable'].map((m) => (
                  <button key={m} onClick={() => setNewModel(m as 'fixed' | 'variable')}
                    className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${newModel === m ? 'border-[#1d9e75] text-[#166534]' : 'border-[#e8e8e8] text-[#888]'}`}
                    style={newModel === m ? { background: '#e8f7f0' } : { background: '#f8f8f6' }}>
                    {m === 'fixed' ? 'Fixed %' : 'Variable %'}
                  </button>
                ))}
              </div>
            </div>
            {newModel === 'fixed' && (
              <div className="mb-3">
                <label className="label">Fixed upside %</label>
                <input className="input" type="number" value={newFixed} onChange={(e) => setNewFixed(e.target.value)} />
              </div>
            )}
            {newModel === 'variable' && (
              <div className="mb-3">
                <label className="label">Variable share %</label>
                <input className="input" type="number" value={newVariable} onChange={(e) => setNewVariable(e.target.value)} />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleAdd} disabled={saving} className="btn-primary flex-1">
                {saving ? <Spinner size="sm" /> : 'Add slot'}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)} className="btn-secondary w-full">
            <Plus className="w-4 h-4" /> Add slot
          </button>
        )}
      </main>
    </>
  );
}
