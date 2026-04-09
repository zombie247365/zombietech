'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '../../../../components/ui/Spinner';
import { CheckCircle, XCircle } from 'lucide-react';

export function BookingActions({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<'approve' | 'decline' | null>(null);
  const [error, setError] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [showDecline, setShowDecline] = useState(false);

  const handleApprove = async () => {
    setLoading('approve'); setError('');
    try {
      const res = await fetch(`/api/bookings/${bookingId}/approve`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to approve'); return; }
      router.push('/bookings');
      router.refresh();
    } catch { setError('Network error'); }
    finally { setLoading(null); }
  };

  const handleDecline = async () => {
    setLoading('decline'); setError('');
    try {
      const res = await fetch(`/api/bookings/${bookingId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: declineReason }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to decline'); return; }
      router.push('/bookings');
      router.refresh();
    } catch { setError('Network error'); }
    finally { setLoading(null); }
  };

  return (
    <div>
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
      {showDecline ? (
        <div className="card-white">
          <p className="text-sm font-medium mb-2">Reason for declining (optional)</p>
          <textarea
            className="input h-20 py-2 resize-none mb-3"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder="e.g. Slot already booked, concept not a good fit…"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowDecline(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleDecline} disabled={loading === 'decline'} className="btn-danger flex-1">
              {loading === 'decline' ? <Spinner size="sm" /> : <><XCircle className="w-4 h-4" /> Decline</>}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <button onClick={() => setShowDecline(true)} className="btn-secondary flex-1">
            <XCircle className="w-4 h-4" /> Decline
          </button>
          <button onClick={handleApprove} disabled={loading === 'approve'} className="btn-primary flex-1">
            {loading === 'approve' ? <Spinner size="sm" /> : <><CheckCircle className="w-4 h-4" /> Approve booking</>}
          </button>
        </div>
      )}
    </div>
  );
}
