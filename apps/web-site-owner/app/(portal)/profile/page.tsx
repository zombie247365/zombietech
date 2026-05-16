'use client';

import { TopBar } from '../../../components/layout/TopBar';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/register');
  };

  return (
    <>
      <TopBar title="Profile" />
      <main className="flex-1 p-6 max-w-2xl">
        <div className="card-white mb-4">
          <p className="text-sm text-[#666]">
            Profile editing isn&apos;t available yet. We&apos;re building this out and it will be available before pilot launch.
          </p>
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
