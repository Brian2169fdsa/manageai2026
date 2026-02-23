import { LoginCard } from '@/components/auth/LoginCard';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-white items-center justify-center p-16">
        <div className="max-w-sm">
          {/* Logo text */}
          <div className="text-6xl font-black tracking-tight leading-none mb-10">
            <span className="text-black">MANAGE</span>
            <span style={{ color: '#2563EB' }}>AI</span>
          </div>

          {/* Tagline */}
          <div className="text-3xl font-bold text-black leading-snug">
            <p>AI Isn&apos;t the Future.</p>
            <p>It&apos;s How Your Team</p>
            <p>Wins Right Now.</p>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center bg-white p-8 border-l border-gray-200">
        <LoginCard />
      </div>
    </div>
  );
}
