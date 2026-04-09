'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '../../../../components/ui/Spinner';
import { CheckCircle, AlertTriangle } from 'lucide-react';

export function SessionActions({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<'confirm' | 'dispute' | null>(null);
  const [error, setError] = useState('');
  const [showDispute, setShowDispute] = useState(false);
  const [claimType, setClaimType] = useState('damage');
  const [claimAmount, setClaimAmount] = useState('');
  const [description, setDescription] = useState('');

  const handleConfirm = async () => {
    setLoading('confirm'); setError('');
    try {
      const res = await fetch(`/api/sessions/${sessionId}/confirm`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Failed to confirm');
        return;
      }
      router.refresh();
    } catch { setError('Network error'); }
    finally { setLoading(null); }
  };

  const handleDispute = async () => {
    setLoading('dispute'); setError('');
    const amountCents = Math.round(parseFloat(claimAmount) * 100);
    if (!amountCents || amountCents <= 0) { setError('Enter a valid claim amount'); setLoading(null); return; }
    if (description.length < 20) { setError('Description must be at least 20 characters'); setLoading(null); return; }
    try {
      const res = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ session_id: sessionId, claim_type: claimType, claim_amount_cents: amountCents, description }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to raise dispute'); return; }
      router.refresh();
    } catch { setError('Network error'); }
    finally { setLoading(null); }
  };

  if (showDispute) {
    return (
      <div className="card-white">
        <p className="text-sm font-medium mb-3">Raise a dispute</p>
        <div className="mb-3">
          <label className="label">Claim type</label>
          <select className="input" value={claimType} onChange={(e) => setClaimType(e.target.value)}>
            {['damage', 'cleaning', 'theft', 'breach', 'false_claim'].map((t) => (
              <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="label">Claim amount (R)</label>
          <input className="input" type="number" value={claimAmount} onChange={(e) => setClaimAmount(e.target.value)} placeholder="500.00" />
        </div>
        <div className="mb-3">
          <label className="label">Description</label>
          <textarea
            className="input h-20 py-2 resize-none"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what happened in detail (min 20 characters)…"
          />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-2">
          <button onClick={() => setShowDispute(false)} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleDispute} disabled={loading === 'dispute'} className="btn-danger flex-1">
            {loading === 'dispute' ? <Spinner size="sm" /> : <><AlertTriangle className="w-4 h-4" /> Submit dispute</>}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
      <div className="flex gap-3">
        <button onClick={() => setShowDispute(true)} className="btn-secondary flex-1">
          <AlertTriangle className="w-4 h-4" /> Raise dispute
        </button>
        <button onClick={handleConfirm} disabled={loading === 'confirm'} className="btn-primary flex-1">
          {loading === 'confirm' ? <Spinner size="sm" /> : <><CheckCircle className="w-4 h-4" /> Confirm good order</>}
        </button>
      </div>
    </div>
  );
}
