'use client';

import { useState } from 'react';
import { TopBar } from '../../../components/layout/TopBar';
import { Spinner } from '../../../components/ui/Spinner';
import { User, Bell, Shield, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/register');
  };

  return (
    <>
      <TopBar title="Profile & settings" />
      <main className="flex-1 p-6 max-w-2xl">
        {/* Account info */}
        <div className="card-white mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
              style={{ background: '#1d9e75' }}
            >
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Site owner account</p>
              <p className="text-xs text-[#888]">ZombieTech site owner portal</p>
            </div>
          </div>

          <div className="mb-3">
            <label className="label">Full name</label>
            <input className="input" defaultValue="Marco Rossi" />
          </div>
          <div className="mb-3">
            <label className="label">Email address</label>
            <input className="input" type="email" defaultValue="marco@abcpizza.co.za" />
          </div>
          <div className="mb-4">
            <label className="label">Mobile number</label>
            <input className="input" defaultValue="+27 82 555 0101" disabled />
            <p className="text-[10px] text-[#aaa] mt-1">Mobile number cannot be changed — it is used for identity verification.</p>
          </div>

          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <Spinner size="sm" /> : saved ? '✓ Saved' : 'Save changes'}
          </button>
        </div>

        {/* Notifications */}
        <div className="card-white mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-[#1d9e75]" />
            <span className="text-sm font-medium">Notification preferences</span>
          </div>
          {[
            { label: 'Booking request received', defaultOn: true },
            { label: 'Session started', defaultOn: true },
            { label: 'Handover report ready (Sunday)', defaultOn: true },
            { label: 'Settlement released', defaultOn: true },
            { label: 'Dispute update', defaultOn: true },
            { label: 'Weekly performance summary', defaultOn: false },
          ].map(({ label, defaultOn }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-[#f0f0f0] last:border-0">
              <span className="text-xs text-[#555]">{label}</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked={defaultOn} />
                <div className="w-8 h-4 bg-[#e0e0e0] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#1d9e75]" />
              </label>
            </div>
          ))}
        </div>

        {/* Security */}
        <div className="card-white mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-[#1d9e75]" />
            <span className="text-sm font-medium">Security</span>
          </div>
          <div className="text-xs text-[#666] mb-3">
            Authentication is handled via mobile OTP. No password to manage. Your session token expires after 7 days.
          </div>
          <div className="row-item text-xs">
            <span className="text-[#666]">Authentication method</span>
            <span className="font-medium">Mobile OTP (WhatsApp / SMS)</span>
          </div>
          <div className="row-item text-xs">
            <span className="text-[#666]">Session duration</span>
            <span className="font-medium">7 days</span>
          </div>
        </div>

        {/* Danger zone */}
        <div className="card-white border-red-100">
          <p className="text-sm font-medium text-red-700 mb-3">Sign out</p>
          <button onClick={handleLogout} className="btn-danger">
            <LogOut className="w-4 h-4" /> Sign out of all devices
          </button>
        </div>
      </main>
    </>
  );
}
