import Link from 'next/link';
import { ArrowRight, Shield, TrendingUp, Clock, CheckCircle } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#f8f8f6' }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 bg-white border-b border-[#e8e8e8]">
        <span className="text-[15px] font-medium" style={{ color: '#1d9e75' }}>zombietech</span>
        <div className="flex items-center gap-3">
          <Link href="/how-it-works" className="text-sm text-[#666] hover:text-[#1a1a1a]">How it works</Link>
          <Link href="/register" className="btn-primary text-xs px-4 py-2">
            List my site
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-8 pt-20 pb-16">
        <div
          className="rounded-2xl p-8 mb-8 text-white"
          style={{ background: '#085041' }}
        >
          <h1 className="text-3xl font-medium mb-3">Your kitchen earns while you sleep.</h1>
          <p className="text-[15px] leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.7)' }}>
            ZombieTech reanimates your commercial kitchen during its dead hours — after you close, a vetted zombie operator
            runs their business from your premises. You earn guaranteed income every weekend. Zero effort. Zero risk.
          </p>
          <div className="flex gap-8 mb-6">
            {[
              { val: 'R3,200', lbl: 'avg earned/month' },
              { val: '340+', lbl: 'active sites' },
              { val: '48hrs', lbl: 'to go live' },
            ].map(({ val, lbl }) => (
              <div key={lbl} className="text-center">
                <div className="text-2xl font-medium" style={{ color: '#9fe1cb' }}>{val}</div>
                <div className="text-xs mt-0.5" style={{ color: '#5dcaa5' }}>{lbl}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <Link href="/register" className="btn-primary">
              List my site <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/how-it-works" className="btn-secondary">
              See how it works
            </Link>
          </div>
        </div>

        {/* Value props */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { val: 'R0', title: 'No upfront cost', desc: 'List your site for free. Pay nothing until your first zombie session earns.' },
            { val: '100%', title: 'Vetted operators', desc: 'Every operator is ID-verified, criminal-checked, and insured before they touch your kitchen.' },
            { val: 'Mon', title: 'Weekly settlement', desc: 'Review the AI handover report Sunday morning. Funds in your account Monday afternoon.' },
          ].map(({ val, title, desc }) => (
            <div key={title} className="card text-center">
              <div className="text-xl font-medium mb-1" style={{ color: '#1d9e75' }}>{val}</div>
              <div className="text-sm font-medium mb-2">{title}</div>
              <div className="text-xs text-[#888] leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="card mb-6">
          <div className="section-title">Why site owners choose us</div>
          {[
            { icon: Shield, text: 'Digital handover with timestamped photo evidence before and after every session' },
            { icon: TrendingUp, text: 'AI calculates your fair hourly rate from your actual lease and utility costs' },
            { icon: Clock, text: 'Sequential lockup checklist ensures your kitchen is secured before the operator leaves' },
            { icon: CheckCircle, text: 'Standard zombie contract protects you — 30-day notice, goodwill fees, dispute resolution' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-start gap-3 py-2.5 border-b border-[#f0f0f0] last:border-0">
              <Icon className="w-4 h-4 text-[#1d9e75] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#555] leading-relaxed">{text}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link href="/register" className="btn-primary">
            Get started — it&apos;s free <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs text-[#aaa] mt-3">No credit card required. Takes about 20 minutes.</p>
        </div>
      </section>
    </div>
  );
}
