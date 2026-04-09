'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '../../../../components/ui/Spinner';
import { CheckCircle, XCircle } from 'lucide-react';

export function VettingActions({ operatorId }: { operatorId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState('');

  const submit = async (status: 'approved' | 'rejected') => {
    setLoading(status === 'approved' ? 'approve' : 'reject');
    setError('');
    try {
      const res = await fetch(`/api/operators/${operatorId}/vetting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed'); return; }
      router.refresh();
    } catch { setError('Network error'); }
    finally { setLoading(null); }
  };

  return (
    <div className="card-white">
      <div className="section-title">Vetting decision</div>
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
      <p className="text-xs text-[#666] mb-4">
        Review the operator documents and vetting records before approving. Approval enables the operator to book slots and sign contracts.
      </p>
      <div className="flex gap-3">
        <button onClick={() => submit('rejected')} disabled={!!loading} className="btn-danger flex-1">
          {loading === 'reject' ? <Spinner size="sm" /> : <><XCircle className="w-4 h-4" /> Reject</>}
        </button>
        <button onClick={() => submit('approved')} disabled={!!loading} className="btn-primary flex-1">
          {loading === 'approve' ? <Spinner size="sm" /> : <><CheckCircle className="w-4 h-4" /> Approve operator</>}
        </button>
      </div>
    </div>
  );
}
