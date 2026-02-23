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
import { Loader2 } from 'lucide-react';

export function LoginCard() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const router = useRouter();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const busy = loading || !!oauthLoading;

  return (
    <div className="w-full max-w-sm">
      {/* Heading */}
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Sign in to Manage AI
      </h1>

      {/* OAuth buttons */}
      <div className="space-y-3 mb-6">
        <OAuthBtn
          icon={<GoogleIcon />}
          label="Continue with Google"
          onClick={handleGoogle}
          loading={oauthLoading === 'google'}
          disabled={busy}
        />
        <OAuthBtn
          icon={<AppleIcon />}
          label="Continue with Apple"
          onClick={() => toast.info('Apple sign-in coming soon')}
          disabled={busy}
        />
        <OAuthBtn
          icon={<MicrosoftIcon />}
          label="Continue with Microsoft"
          onClick={() => toast.info('Microsoft sign-in coming soon')}
          disabled={busy}
        />
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-sm text-gray-400">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Email + Password */}
      <div className="space-y-4 mb-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Work email
          </label>
          <Input
            type="email"
            placeholder="you@company.com"
            className="h-10"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            {!isSignUp && (
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-700"
                onClick={() => setForgotOpen(true)}
              >
                Forgot your password?
              </button>
            )}
          </div>
          <Input
            type="password"
            placeholder="••••••••"
            className="h-10"
            value={password}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </div>
      </div>

      <Button
        className="w-full h-10 mt-5 bg-blue-600 hover:bg-blue-700 text-white font-medium"
        onClick={handleSubmit}
        disabled={busy}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 size={15} className="animate-spin" />
            {isSignUp ? 'Creating account...' : 'Signing in...'}
          </span>
        ) : (
          isSignUp ? 'Create account' : 'Sign in'
        )}
      </Button>

      {/* Toggle sign up / sign in */}
      <p className="text-center text-sm text-gray-500 mt-5">
        {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button
          type="button"
          className="text-blue-600 hover:text-blue-700 font-medium"
          onClick={() => setIsSignUp(!isSignUp)}
        >
          {isSignUp ? 'Sign in' : 'Sign up'}
        </button>
      </p>

      {/* Footer */}
      <p className="text-center text-xs text-gray-400 mt-4">
        By continuing you agree to our{' '}
        <a href="#" className="underline hover:text-gray-600">Terms</a>
        {' '}and{' '}
        <a href="#" className="underline hover:text-gray-600">Privacy Policy</a>
      </p>

      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </div>
  );
}

function OAuthBtn({
  icon,
  label,
  onClick,
  loading,
  disabled,
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
      className="w-full h-10 flex items-center gap-3 px-4 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className="shrink-0 w-5 flex items-center justify-center">
        {loading ? <Loader2 size={16} className="animate-spin text-gray-400" /> : icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
