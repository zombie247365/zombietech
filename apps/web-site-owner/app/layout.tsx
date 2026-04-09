import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ZombieTech — Site Owner Portal',
  description: 'Reanimate your commercial kitchen during dead hours. Earn guaranteed income on the time you are closed.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
