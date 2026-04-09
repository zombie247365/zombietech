interface TopBarProps { title: string; actions?: React.ReactNode; }

export function TopBar({ title, actions }: TopBarProps) {
  return (
    <header className="h-12 flex items-center px-6 sticky top-0 z-10" style={{ borderBottom: '0.5px solid #e8e8e8', background: '#fafafa' }}>
      <h1 className="text-[13px] font-medium flex-1">{title}</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
