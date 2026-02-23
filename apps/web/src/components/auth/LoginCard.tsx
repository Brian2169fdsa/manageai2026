'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { GoogleIcon } from './icons/GoogleIcon';
import { AppleIcon } from './icons/AppleIcon';
import { MicrosoftIcon } from './icons/MicrosoftIcon';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';

export function LoginCard() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const router = useRouter();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);

  async function handleSubmit() {
    if (!email || !password) {
      toast.error('Please enter your email and password');
      return;
    }
    setLoading(true);
    const { error } = isSignUp
      ? await signUpWithEmail(email, password)
      : await signInWithEmail(email, password);
    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else if (isSignUp) {
      toast.success('Account created! Check your email to confirm.');
    } else {
      router.push('/dashboard');
    }
  }

  async function handleGoogle() {
    setOauthLoading('google');
    const { error } = await signInWithGoogle();
    setOauthLoading(null);
    if (error) toast.error(error.message);
  }

  return (
    <div className="w-full max-w-[380px]">
      {/* Card */}
      <div className="bg-background rounded-2xl border shadow-xl shadow-black/5 p-8 space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSignUp ? 'Start automating with AI' : 'Sign in to Manage AI'}
          </p>
        </div>

        {/* OAuth buttons */}
        <div className="space-y-2.5">
          <OAuthBtn
            icon={<GoogleIcon />}
            label="Continue with Google"
            onClick={handleGoogle}
            loading={oauthLoading === 'google'}
            disabled={!!oauthLoading || loading}
          />
          <OAuthBtn
            icon={<AppleIcon className="text-foreground" />}
            label="Continue with Apple"
            onClick={() => toast.info('Apple sign-in coming soon')}
            disabled={!!oauthLoading || loading}
          />
          <OAuthBtn
            icon={<MicrosoftIcon />}
            label="Continue with Microsoft"
            onClick={() => toast.info('Microsoft sign-in coming soon')}
            disabled={!!oauthLoading || loading}
          />
        </div>

        {/* Divider */}
        <div className="relative flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Email/password */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
            <Input
              type="email"
              placeholder="you@company.com"
              className="h-11"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Password</label>
              {!isSignUp && (
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  onClick={() => setForgotOpen(true)}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Input
                type={showPw ? 'text' : 'password'}
                placeholder={isSignUp ? 'Create a password' : 'Enter your password'}
                className="h-11 pr-10"
                value={password}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPw(!showPw)}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <Button
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm mt-1"
            onClick={handleSubmit}
            disabled={loading || !!oauthLoading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                {isSignUp ? 'Creating account...' : 'Signing in...'}
              </span>
            ) : (
              isSignUp ? 'Create account' : 'Sign in'
            )}
          </Button>
        </div>

        {/* Toggle */}
        <p className="text-center text-sm text-muted-foreground">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            className="text-blue-600 hover:text-blue-700 font-semibold"
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? 'Sign in' : 'Sign up free'}
          </button>
        </p>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground mt-4">
        By continuing you agree to our{' '}
        <a href="#" className="underline hover:text-foreground">Terms</a>
        {' '}and{' '}
        <a href="#" className="underline hover:text-foreground">Privacy Policy</a>
      </p>

      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </div>
  );
}

function OAuthBtn({
  icon, label, onClick, loading, disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full h-11 flex items-center gap-3 px-4 rounded-xl border border-border bg-background hover:bg-muted/60 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <span className="shrink-0">
        {loading ? <Loader2 size={18} className="animate-spin text-muted-foreground" /> : icon}
      </span>
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}
