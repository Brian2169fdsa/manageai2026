'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Lock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Zap,
  FileText,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ClientPortalLogin() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get('return') ?? '';

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError('');

    // Look up client by contact email
    const { data: tickets } = await supabase
      .from('tickets')
      .select('company_name, contact_email')
      .eq('contact_email', email.trim().toLowerCase())
      .limit(1);

    if (!tickets || tickets.length === 0) {
      setError('No account found for this email. Contact your ManageAI delivery manager.');
      setLoading(false);
      return;
    }

    // Store session in localStorage (lightweight client auth)
    const clientSession = {
      email: email.trim().toLowerCase(),
      company_name: tickets[0].company_name,
      authenticated_at: new Date().toISOString(),
    };
    localStorage.setItem('client_portal_session', JSON.stringify(clientSession));

    const target = returnTo || `/client-portal/dashboard?email=${encodeURIComponent(email.trim())}`;
    router.push(target);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo area */}
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Client Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View your automations, reports, and project status
          </p>
        </div>

        {/* Login Card */}
        <Card>
          <CardContent className="pt-6 pb-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                  Your Email Address
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="name@company.com"
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Use the email associated with your ManageAI account
                </p>
              </div>
              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <>
                    Access Portal <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          </CardContent>
        </Card>

        {/* Features preview */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Zap, label: 'Live Automations', desc: 'Real-time health status' },
            { icon: FileText, label: 'Reports', desc: 'Monthly performance' },
            { icon: Activity, label: 'Build Status', desc: 'Track project progress' },
            { icon: CheckCircle2, label: 'Deployments', desc: 'See what\'s running' },
          ].map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="rounded-lg border bg-white/60 p-3 text-center"
            >
              <Icon size={18} className="text-blue-600 mx-auto mb-1" />
              <p className="text-xs font-semibold text-slate-700">{label}</p>
              <p className="text-[10px] text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Powered by ManageAI
        </p>
      </div>
    </div>
  );
}
