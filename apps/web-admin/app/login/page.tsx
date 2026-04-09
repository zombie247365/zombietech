'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Phone } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'mobile' | 'otp'>('mobile');
  const [mobile, setMobile] = useState('+27');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleRequest = async () => {
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); return; }
      if (data.data?.dev_otp) setDevOtp(data.data.dev_otp);
      setStep('otp');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  const handleVerify = async () => {
    setError(''); setLoading(true);
    const code = otp.join('');
    if (code.length < 6) { setError('Enter 6-digit code'); setLoading(false); return; }
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Invalid OTP'); return; }
      if (data.data?.user?.role !== 'admin') { setError('Admin access only'); return; }
      await fetch('/api/auth/set-token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data.data.token }),
      });
      router.push('/dashboard');
      router.refresh();
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (devOtp && step === 'otp') setOtp(devOtp.split('').slice(0, 6).concat(Array(6).fill('')).slice(0, 6));
  }, [devOtp, step]);

  const handleOtpChange = (i: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...otp]; next[i] = digit; setOtp(next);
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#085041' }}>
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-xl">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#e8f7f0' }}>
            <Shield className="w-4 h-4" style={{ color: '#1d9e75' }} />
          </div>
          <div>
            <div className="text-sm font-medium" style={{ color: '#1d9e75' }}>zombietech</div>
            <div className="text-[10px] text-[#aaa]">Admin portal</div>
          </div>
        </div>

        {step === 'mobile' ? (
          <>
            <h2 className="text-lg font-medium mb-1">Admin sign in</h2>
            <p className="text-xs text-[#888] mb-4">Enter your registered admin mobile number.</p>
            <div className="mb-4">
              <label className="label">Mobile number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 w-3.5 h-3.5 text-[#aaa]" />
                <input className="input pl-8" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+27 82 123 4567" />
              </div>
            </div>
            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
            <button onClick={handleRequest} disabled={loading} className="btn-primary w-full">
              {loading ? 'Sending…' : 'Send OTP →'}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-medium mb-1">Enter verification code</h2>
            <p className="text-xs text-[#888] mb-4">
              Sent to <strong>{mobile}</strong>
              {devOtp && <span style={{ color: '#1d9e75' }}> (dev: auto-filled)</span>}
            </p>
            <div className="flex gap-2 mb-4">
              {otp.map((d, i) => (
                <input key={i} ref={(el) => { otpRefs.current[i] = el; }}
                  className="w-10 h-11 border rounded-lg text-center text-lg font-medium focus:outline-none"
                  style={{ borderColor: d ? '#1d9e75' : '#e0e0e0', background: d ? '#e8f7f0' : '#fff' }}
                  maxLength={1} value={d}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => e.key === 'Backspace' && !d && i > 0 && otpRefs.current[i - 1]?.focus()}
                  inputMode="numeric" />
              ))}
            </div>
            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
            <button onClick={handleVerify} disabled={loading} className="btn-primary w-full mb-2">
              {loading ? 'Verifying…' : 'Sign in to admin →'}
            </button>
            <button onClick={() => { setStep('mobile'); setOtp(Array(6).fill('')); }} className="btn-secondary w-full text-xs">
              ← Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
