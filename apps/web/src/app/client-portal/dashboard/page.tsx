'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Ticket } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Zap,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Activity,
  FileText,
  ExternalLink,
  LogOut,
  Package,
  Rocket,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  SUBMITTED: { label: 'Submitted', badge: 'bg-slate-100 text-slate-600' },
  ANALYZING: { label: 'Analyzing', badge: 'bg-yellow-100 text-yellow-700' },
  QUESTIONS_PENDING: { label: 'Questions Pending', badge: 'bg-amber-100 text-amber-700' },
  BUILDING: { label: 'Building', badge: 'bg-blue-100 text-blue-700' },
  REVIEW_PENDING: { label: 'In Review', badge: 'bg-purple-100 text-purple-700' },
  APPROVED: { label: 'Approved', badge: 'bg-emerald-100 text-emerald-700' },
  DEPLOYED: { label: 'Deployed', badge: 'bg-green-100 text-green-700' },
  CLOSED: { label: 'Completed', badge: 'bg-slate-100 text-slate-600' },
};

const PLATFORM_CONFIG: Record<string, { label: string; class: string }> = {
  n8n: { label: 'n8n', class: 'bg-orange-100 text-orange-700' },
  make: { label: 'Make.com', class: 'bg-purple-100 text-purple-700' },
  zapier: { label: 'Zapier', class: 'bg-yellow-100 text-yellow-800' },
};

interface ClientSession {
  email: string;
  company_name: string;
  authenticated_at: string;
}

interface AutomationRow {
  id: string;
  platform: string;
  status: string;
  health: string;
  external_url?: string;
  run_count: number;
  error_count: number;
  last_run?: string;
}

export default function ClientPortalDashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const [session, setSession] = useState<ClientSession | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [automations, setAutomations] = useState<AutomationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check session
    const stored = localStorage.getItem('client_portal_session');
    if (!stored) {
      router.push('/client-portal');
      return;
    }

    const sess = JSON.parse(stored) as ClientSession;
    // Session expires after 24h
    const age = Date.now() - new Date(sess.authenticated_at).getTime();
    if (age > 24 * 60 * 60 * 1000) {
      localStorage.removeItem('client_portal_session');
      router.push('/client-portal');
      return;
    }

    setSession(sess);
    loadData(sess);
  }, [router]);

  async function loadData(sess: ClientSession) {
    // Fetch tickets for this client
    const { data: ticketData } = await supabase
      .from('tickets')
      .select('*')
      .or(`contact_email.eq.${sess.email},company_name.ilike.%${sess.company_name}%`)
      .order('created_at', { ascending: false });

    setTickets((ticketData ?? []) as Ticket[]);

    // Try to load automations
    const { data: autoData } = await supabase
      .from('client_automations')
      .select('*, client_accounts!inner(company_name)')
      .ilike('client_accounts.company_name', `%${sess.company_name}%`);

    setAutomations((autoData ?? []) as AutomationRow[]);
    setLoading(false);
  }

  function handleLogout() {
    localStorage.removeItem('client_portal_session');
    router.push('/client-portal');
  }

  const stats = useMemo(() => {
    const totalTickets = tickets.length;
    const deployed = tickets.filter((t) => ['DEPLOYED', 'CLOSED'].includes(t.status)).length;
    const inProgress = tickets.filter((t) =>
      ['SUBMITTED', 'ANALYZING', 'BUILDING', 'REVIEW_PENDING', 'APPROVED'].includes(t.status)
    ).length;
    const totalAutomations = automations.length;
    const healthyAutomations = automations.filter((a) => a.health === 'healthy').length;
    const totalRuns = automations.reduce((s, a) => s + (a.run_count ?? 0), 0);
    return { totalTickets, deployed, inProgress, totalAutomations, healthyAutomations, totalRuns };
  }, [tickets, automations]);

  function fmtDate(d: unknown): string {
    if (!d) return '—';
    try {
      return new Date(String(d)).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <Building2 size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{session.company_name}</h1>
              <p className="text-xs text-muted-foreground">{session.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mb-1">
                <Package size={13} /> Total Projects
              </div>
              <p className="text-2xl font-bold">{stats.totalTickets}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium mb-1">
                <Rocket size={13} /> Deployed
              </div>
              <p className="text-2xl font-bold text-emerald-700">{stats.deployed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 text-xs text-blue-600 font-medium mb-1">
                <Clock size={13} /> In Progress
              </div>
              <p className="text-2xl font-bold text-blue-700">{stats.inProgress}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mb-1">
                <Zap size={13} /> Automations
              </div>
              <p className="text-2xl font-bold">{stats.totalAutomations}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.healthyAutomations} healthy · {stats.totalRuns} runs
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Active Automations */}
        {automations.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Activity size={13} /> Live Automations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {automations.map((auto) => {
                  const pc = PLATFORM_CONFIG[auto.platform] ?? { label: auto.platform, class: 'bg-gray-100 text-gray-600' };
                  const healthColor =
                    auto.health === 'healthy' ? 'bg-emerald-500' : auto.health === 'degraded' ? 'bg-amber-500' : 'bg-red-500';
                  return (
                    <div
                      key={auto.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg border bg-white"
                    >
                      <div className={cn('w-2 h-2 rounded-full shrink-0', healthColor)} />
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', pc.class)}>
                        {pc.label}
                      </Badge>
                      <div className="flex-1 text-xs text-muted-foreground">
                        {auto.run_count ?? 0} runs · {auto.error_count ?? 0} errors
                      </div>
                      <span className="text-xs text-muted-foreground capitalize">{auto.health}</span>
                      {auto.external_url && (
                        <a href={auto.external_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink size={12} className="text-blue-600" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Project Timeline */}
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <FileText size={13} /> Your Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-muted animate-pulse rounded-lg mb-2" />
              ))
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Package size={28} className="mb-2 opacity-30" />
                <p className="text-sm font-medium">No projects yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tickets.map((t) => {
                  const sc = STATUS_CONFIG[t.status] ?? { label: t.status, badge: 'bg-gray-100 text-gray-600' };
                  const pc = PLATFORM_CONFIG[t.ticket_type] ?? { label: t.ticket_type, class: 'bg-gray-100 text-gray-600' };
                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-white"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {t.project_name || t.what_to_build || 'Automation Build'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', pc.class)}>
                            {pc.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{fmtDate(t.created_at)}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', sc.badge)}>
                        {sc.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground pt-4">
          Need help? Contact your ManageAI delivery manager.
        </p>
      </main>
    </div>
  );
}
