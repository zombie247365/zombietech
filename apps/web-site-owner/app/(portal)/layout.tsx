import { Sidebar } from '../../components/layout/Sidebar';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ background: '#f8f8f6' }}>
      <Sidebar />
      <div className="flex-1 ml-[190px] flex flex-col min-h-screen">
        {children}
      </div>
    </div>
  );
}
