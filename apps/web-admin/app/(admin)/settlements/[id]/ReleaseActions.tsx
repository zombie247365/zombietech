'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ReleaseActions({ settlementId }: { settlementId: string }) {
  const router = useRouter();
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function release() {
    setBusy(true); setErr('');
    try {
      const res = await fetch(`/api/settlements/${settlementId}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_provider_ref: ref || null }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Release failed'); }
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Release failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="card-white">
      <p className="text-xs font-semibold text-[#444] mb-3">Release settlement</p>
      <div className="flex gap-2">
        <input
          className="input flex-1 text-xs"
          placeholder="Payment provider ref (optional)"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
        />
        <button className="btn-primary text-xs px-4" onClick={release} disabled={busy}>
          {busy ? 'Releasing…' : 'Release'}
        </button>
      </div>
      {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
    </div>
  );
}
