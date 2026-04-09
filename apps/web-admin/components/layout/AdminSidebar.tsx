'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Building2, Users, FileText, Clock,
  AlertTriangle, Banknote, Shield, Settings, LogOut, UserCheck,
} from 'lucide-react';
import { COOKIE_NAME } from '../../lib/auth';

const nav = [
  { section: 'Overview', items: [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ]},
  { section: 'People', items: [
    { href: '/site-owners', label: 'Site owners', icon: Building2 },
    { href: '/operators', label: 'Operators', icon: Users },
    { href: '/vetting', label: 'Vetting queue', icon: UserCheck },
  ]},
  { section: 'Commerce', items: [
    { href: '/sites', label: 'Sites', icon: Building2 },
    { href: '/contracts', label: 'Contracts', icon: FileText },
    { href: '/sessions', label: 'Sessions', icon: Clock },
  ]},
  { section: 'Finance', items: [
    { href: '/settlements', label: 'Settlements', icon: Banknote },
    { href: '/disputes', label: 'Disputes', icon: AlertTriangle },
  ]},
  { section: 'Platform', items: [
    { href: '/documents', label: 'Documents', icon: Shield },
    { href: '/settings', label: 'Settings', icon: Settings },
  ]},
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    document.cookie = `${COOKIE_NAME}=; Max-Age=0; path=/`;
    router.push('/login');
  };

  return (
    <aside className="w-[190px] flex flex-col min-h-screen fixed top-0 left-0" style={{ background: '#f4f4f2', borderRight: '0.5px solid #e0e0e0' }}>
      <div className="px-4 py-3" style={{ borderBottom: '0.5px solid #e0e0e0' }}>
        <div className="text-[15px] font-medium" style={{ color: '#1d9e75' }}>zombietech</div>
        <div className="text-[10px] text-[#aaa] mt-0.5">admin portal</div>
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {nav.map(({ section, items }) => (
          <div key={section}>
            <div className="section-title px-4 pt-3">{section}</div>
            {items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link key={href} href={href}
                  className={`flex items-center gap-2.5 px-4 py-2 text-[11px] border-r-2 transition-all ${active ? 'bg-white border-r-[#1d9e75] text-[#1a1a1a] font-medium' : 'border-r-transparent text-[#888] hover:bg-[#ece9e2] hover:text-[#555]'}`}>
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-3" style={{ borderTop: '0.5px solid #e0e0e0' }}>
        <div className="text-[10px] text-[#bbb] mb-2">Admin access</div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 text-[11px] text-[#888] hover:text-red-600 transition-colors w-full px-1">
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </div>
    </aside>
  );
}
