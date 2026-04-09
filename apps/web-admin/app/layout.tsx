import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ZombieTech Admin Portal',
  description: 'ZombieTech internal admin dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased" style={{ background: '#f8f8f6', color: '#1a1a1a' }}>
        {children}
      </body>
    </html>
  );
}
