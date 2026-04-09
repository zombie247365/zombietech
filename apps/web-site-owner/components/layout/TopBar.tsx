import { Bell } from 'lucide-react';

interface TopBarProps {
  title: string;
  actions?: React.ReactNode;
}

export function TopBar({ title, actions }: TopBarProps) {
  return (
    <header className="h-12 flex items-center px-6 border-b border-[#e8e8e8] bg-[#fafafa] sticky top-0 z-10">
      <h1 className="text-[13px] font-medium text-[#1a1a1a] flex-1">{title}</h1>
      <div className="flex items-center gap-3">
        {actions}
        <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#f0f0f0] text-[#888] transition-colors">
          <Bell className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
