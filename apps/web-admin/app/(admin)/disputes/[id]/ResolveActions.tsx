'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatZAR } from '../../../../lib/format';

export function ResolveActions({ disputeId, claimAmountCents }: { disputeId: string; claimAmountCents: number }) {
  const router = useRouter();
  const [decision, setDecision] = useState<'award_full' | 'award_partial' | 'reject'>('award_full');
  const [awarded, setAwarded] = useState((claimAmountCents / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function resolve() {
    setBusy(true); setErr('');
    try {
      const body: Record<string, unknown> = { admin_decision: decision };
      if (decision !== 'reject') body.awarded_amount_cents = Math.round(parseFloat(awarded) * 100);
      const res = await fetch(`/api/disputes/${disputeId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed'); }
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="card-white">
      <p className="text-xs font-semibold text-[#444] mb-3">Resolve dispute</p>
      <div className="flex gap-2 mb-3">
        {(['award_full', 'award_partial', 'reject'] as const).map((opt) => (
          <button
            key={opt}
            onClick={() => setDecision(opt)}
            className={`text-xs px-3 py-1.5 rounded-md border font-medium capitalize transition-colors ${
              decision === opt
                ? 'bg-[#1d9e75] text-white border-[#1d9e75]'
                : 'bg-white text-[#555] border-[#e8e8e6] hover:border-[#1d9e75]'
            }`}
          >
            {opt.replace(/_/g, ' ')}
          </button>
        ))}
      </div>
      {decision !== 'reject' && (
        <div className="mb-3">
          <label className="text-[10px] text-[#888] mb-1 block">Award amount (R)</label>
          <input
            className="input text-xs w-40"
            type="number"
            step="0.01"
            value={awarded}
            onChange={(e) => setAwarded(e.target.value)}
          />
          <p className="text-[10px] text-[#aaa] mt-1">Claim: {formatZAR(claimAmountCents)}</p>
        </div>
      )}
      <button className="btn-primary text-xs px-4" onClick={resolve} disabled={busy}>
        {busy ? 'Resolving…' : 'Confirm decision'}
      </button>
      {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
    </div>
  );
}
