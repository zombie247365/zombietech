import { AdminSidebar } from '../../components/layout/AdminSidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 ml-[190px] flex flex-col min-h-screen">
        {children}
      </div>
    </div>
  );
}
