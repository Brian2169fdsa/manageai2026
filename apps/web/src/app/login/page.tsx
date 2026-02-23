import Image from 'next/image';
import { LoginCard } from '@/components/auth/LoginCard';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ── */}
      <div
        className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col items-center justify-center p-16"
        style={{ background: '#05050f' }}
      >
        {/* Grid background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(99,102,241,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        />

        {/* Animated gradient blobs */}
        <div
          className="login-blob-1 absolute top-[-10%] left-[-10%] w-[480px] h-[480px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)',
          }}
        />
        <div
          className="login-blob-2 absolute bottom-[-5%] right-[-5%] w-[520px] h-[520px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 70%)',
          }}
        />
        <div
          className="login-blob-3 absolute top-[40%] left-[30%] w-[300px] h-[300px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
          }}
        />

        {/* Content */}
        <div className="relative z-10 max-w-lg w-full space-y-10">
          {/* Logo */}
          <div className="login-fade-up space-y-4">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
              <span className="text-xs text-blue-300 font-medium tracking-wide">AI Automation Platform</span>
            </div>
            <Image
              src="/logo.png"
              alt="Manage AI"
              width={300}
              height={80}
              className="object-contain"
              priority
            />
          </div>

          {/* Tagline */}
          <div className="login-fade-up-delay-1 space-y-3">
            <p className="text-2xl font-light text-white/90 leading-tight">
              AI Isn&apos;t the Future.
            </p>
            <p className="text-2xl font-semibold text-white leading-tight">
              It&apos;s How Your Team<br />Wins Right Now.
            </p>
            <p className="text-sm text-white/40 leading-relaxed mt-4 max-w-sm">
              Submit a build request. AI analyzes your requirements,
              asks the right questions, and delivers a complete
              automation plan — ready to ship.
            </p>
          </div>

          {/* Platform badges */}
          <div className="login-fade-up-delay-2 flex items-center gap-3">
            {[
              { label: 'n8n', color: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', text: '#fca5a5' },
              { label: 'Make.com', color: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.3)', text: '#d8b4fe' },
              { label: 'Zapier', color: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.3)', text: '#fdba74' },
            ].map((p) => (
              <div
                key={p.label}
                className="flex-1 text-center rounded-xl py-3 text-xs font-semibold tracking-wide"
                style={{
                  background: p.color,
                  border: `1px solid ${p.border}`,
                  color: p.text,
                }}
              >
                {p.label}
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="login-fade-up-delay-3 grid grid-cols-3 gap-4 pt-2 border-t border-white/10">
            {[
              { n: '3', label: 'Platforms' },
              { n: '3', label: 'Deliverables' },
              { n: '<30s', label: 'AI Analysis' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-bold text-white">{s.n}</div>
                <div className="text-xs text-white/40 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center bg-background p-8">
        {/* Mobile logo */}
        <div className="absolute top-6 left-6 lg:hidden">
          <Image src="/logo.png" alt="Manage AI" width={120} height={32} className="object-contain" />
        </div>
        <LoginCard />
      </div>
    </div>
  );
}
