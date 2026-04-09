'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Building2, CalendarCheck, FileText,
  Clock, Banknote, User, LogOut, BookOpen,
} from 'lucide-react';
import { COOKIE_NAME } from '../../lib/constants';

const nav = [
  { section: 'Overview', items: [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ]},
  { section: 'My sites', items: [
    { href: '/sites', label: 'Sites', icon: Building2 },
    { href: '/bookings', label: 'Booking requests', icon: BookOpen },
    { href: '/contracts', label: 'Contracts', icon: FileText },
  ]},
  { section: 'Operations', items: [
    { href: '/sessions', label: 'Sessions', icon: Clock },
    { href: '/settlements', label: 'Financials', icon: Banknote },
  ]},
  { section: 'Account', items: [
    { href: '/profile', label: 'Profile', icon: User },
  ]},
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    // Clear cookie client-side too for instant feedback
    document.cookie = `${COOKIE_NAME}=; Max-Age=0; path=/`;
    router.push('/register');
  };

  return (
    <aside className="w-[190px] bg-[#f4f4f2] border-r border-[#e0e0e0] flex flex-col min-h-screen fixed top-0 left-0">
      {/* Logo */}
      <div className="px-4 py-3 border-b border-[#e0e0e0]">
        <span className="text-[15px] font-medium tracking-tight" style={{ color: '#1d9e75' }}>
          zombietech
        </span>
        <div className="text-[10px] text-[#aaa] mt-0.5">site owner portal</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {nav.map(({ section, items }) => (
          <div key={section}>
            <div className="section-title px-4 pt-3">{section}</div>
            {items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 px-4 py-2 text-[11px] border-r-2 transition-all ${
                    active
                      ? 'bg-white border-r-[#1d9e75] text-[#1a1a1a] font-medium'
                      : 'border-r-transparent text-[#888] hover:bg-[#ece9e2] hover:text-[#555]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="border-t border-[#e0e0e0] p-3">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-[11px] text-[#888] hover:text-red-600 transition-colors w-full px-1"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
