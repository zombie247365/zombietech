import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const steps = [
  {
    n: 1,
    title: 'List your site in 20 minutes',
    body: 'Upload your lease and bank statements. Our AI calculates a fair hourly rate from your actual costs — not a guess. You set your available zombie hours and choose your upside model.',
  },
  {
    n: 2,
    title: 'We find you a vetted operator',
    body: 'Zombie operators browse your listing and send a booking request with their trading concept. You review and approve — 48-hour window. Once matched, a standard zombie contract is generated and both parties sign digitally.',
  },
  {
    n: 3,
    title: 'The night runs on rails',
    body: 'The operator uses our app to photograph your kitchen before and after every session. Digital handover at your agreed time. Timestamped photo evidence of lock-up. You don\'t need to be there.',
  },
  {
    n: 4,
    title: 'Review and get paid on Monday',
    body: 'Sunday morning you receive an AI-scored handover report comparing before and after photos across every surface. Confirm good order or raise a claim by Monday noon. Settlement processes Monday afternoon.',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen" style={{ background: '#f8f8f6' }}>
      <nav className="flex items-center justify-between px-8 py-4 bg-white border-b border-[#e8e8e8]">
        <Link href="/" className="text-[15px] font-medium" style={{ color: '#1d9e75' }}>zombietech</Link>
        <Link href="/register" className="btn-primary text-xs px-4 py-2">List my site</Link>
      </nav>

      <div className="max-w-2xl mx-auto px-8 py-14">
        <h2 className="text-2xl font-medium mb-2">How ZombieTech works for site owners</h2>
        <p className="text-sm text-[#666] mb-10">Four steps from listing to payout. The whole process takes less than 48 hours.</p>

        <div className="mb-8">
          {steps.map(({ n, title, body }) => (
            <div key={n} className="flex gap-4 mb-7">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5"
                style={{ background: '#e8f7f0', color: '#166534' }}
              >
                {n}
              </div>
              <div>
                <div className="text-[13px] font-medium mb-1.5">{title}</div>
                <div className="text-sm text-[#888] leading-relaxed">{body}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{ background: '#e8f7f0', borderColor: '#a3d9bc' }}>
          <div className="text-sm font-medium mb-2" style={{ color: '#166534' }}>What you earn</div>
          <p className="text-xs leading-relaxed" style={{ color: '#4ade80' }}>
            Your earnings are calculated from your own lease and utility costs. Choose a guaranteed fixed upside (e.g. 30% above
            cost recovery) or a variable share of your zombie operator&apos;s net profit. Both options are explained and modelled
            before you sign anything.
          </p>
        </div>

        <div className="mt-8">
          <Link href="/register" className="btn-primary">
            Start listing my site <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
