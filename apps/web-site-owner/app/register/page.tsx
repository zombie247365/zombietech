'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Phone, User, Mail } from 'lucide-react';
import { StepDots } from '../../components/ui/StepDots';
import { Spinner } from '../../components/ui/Spinner';

type Step = 'details' | 'otp';

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get('next') ?? '/dashboard';

  const [step, setStep] = useState<Step>('details');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState('');

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('+27');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Step 1 — request OTP
  const handleRequestOtp = async () => {
    setError('');
    if (!fullName.trim()) { setError('Full name is required'); return; }
    if (!email.trim() || !email.includes('@')) { setError('Valid email is required'); return; }
    if (!mobile.match(/^\+27\d{9}$/)) { setError('Enter a valid South African mobile: +27 followed by 9 digits'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to send OTP'); return; }
      if (data.data?.dev_otp) setDevOtp(data.data.dev_otp);
      setStep('otp');
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — verify OTP and login
  const handleVerifyOtp = async () => {
    setError('');
    const code = otp.join('');
    if (code.length < 6) { setError('Enter the 6-digit code'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile,
          otp: code,
          full_name: fullName,
          email,
          role: 'site_owner',
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Invalid OTP'); return; }

      // Set the auth cookie via our route handler then navigate
      const token = data.data?.token;
      if (!token) { setError('No token received'); return; }

      await fetch('/api/auth/set-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      router.push(nextPath);
      router.refresh();
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
    }
  };

  const handleOtpChange = (i: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[i] = digit;
    setOtp(next);
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
  };

  // Auto-fill dev OTP
  useEffect(() => {
    if (devOtp && step === 'otp') {
      const digits = devOtp.split('').slice(0, 6);
      setOtp(digits.concat(Array(6 - digits.length).fill('')));
    }
  }, [devOtp, step]);

  return (
    <div className="min-h-screen" style={{ background: '#f8f8f6' }}>
      <nav className="flex items-center justify-between px-8 py-4 bg-white border-b border-[#e8e8e8]">
        <Link href="/" className="text-[15px] font-medium" style={{ color: '#1d9e75' }}>zombietech</Link>
        <span className="text-xs text-[#aaa]">Site owner registration</span>
      </nav>

      <div className="max-w-sm mx-auto px-6 pt-14">
        <StepDots total={2} current={step === 'details' ? 0 : 1} />

        {step === 'details' && (
          <>
            <h2 className="text-xl font-medium mb-1">Create your account</h2>
            <p className="page-sub">We&apos;ll verify your identity and send a one-time PIN to your mobile.</p>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="label">First name</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-3.5 h-3.5 text-[#aaa]" />
                  <input
                    className="input pl-8"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Marco"
                  />
                </div>
              </div>
              <div>
                <label className="label">Last name</label>
                <input className="input" placeholder="Rossi" disabled />
              </div>
            </div>

            <div className="mb-3">
              <label className="label">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-3.5 h-3.5 text-[#aaa]" />
                <input
                  type="email"
                  className="input pl-8"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.co.za"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="label">Mobile number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 w-3.5 h-3.5 text-[#aaa]" />
                <input
                  className="input pl-8"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="+27 82 555 0101"
                />
              </div>
              <p className="text-[10px] text-[#aaa] mt-1">South African number, e.g. +27 82 555 0101</p>
            </div>

            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

            <button onClick={handleRequestOtp} disabled={loading} className="btn-primary w-full">
              {loading ? <Spinner size="sm" /> : <>Send verification code <ArrowRight className="w-4 h-4" /></>}
            </button>

            <p className="text-xs text-center text-[#aaa] mt-4">
              Already have an account?{' '}
              <button onClick={() => { setFullName('_'); setEmail('_@_._'); setStep('otp'); }}
                className="underline">Sign in</button>
            </p>
          </>
        )}

        {step === 'otp' && (
          <>
            <h2 className="text-xl font-medium mb-1">Enter your verification code</h2>
            <p className="page-sub">
              A 6-digit code was sent to <strong>{mobile}</strong>.
              {devOtp && <span className="text-[#1d9e75]"> (dev: auto-filled)</span>}
            </p>

            <div
              className="rounded-xl border p-4 mb-4"
              style={{ background: '#e8f0fc', borderColor: '#9db8f0' }}
            >
              <p className="text-xs mb-3" style={{ color: '#1e40af' }}>
                Enter the 6-digit code sent to <strong>{mobile}</strong>
              </p>
              <div className="flex gap-2">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    className="w-10 h-11 border rounded-lg text-center text-lg font-medium focus:outline-none transition-colors"
                    style={{
                      borderColor: digit ? '#1d9e75' : '#93c5fd',
                      background: digit ? '#e8f7f0' : '#fff',
                      color: digit ? '#166534' : '#1e40af',
                    }}
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKey(i, e)}
                    inputMode="numeric"
                  />
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

            <button onClick={handleVerifyOtp} disabled={loading} className="btn-primary w-full mb-3">
              {loading ? <Spinner size="sm" /> : <>Verify & continue <ArrowRight className="w-4 h-4" /></>}
            </button>

            <button
              onClick={() => { setStep('details'); setOtp(['','','','','','']); setError(''); }}
              className="btn-secondary w-full text-xs"
            >
              ← Back
            </button>

            <p className="text-xs text-center text-[#aaa] mt-4">
              Didn&apos;t receive it?{' '}
              <button onClick={handleRequestOtp} className="underline">Resend code</button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: '#f8f8f6' }}><div className="text-sm text-[#aaa]">Loading...</div></div>}>
      <RegisterForm />
    </Suspense>
  );
}
