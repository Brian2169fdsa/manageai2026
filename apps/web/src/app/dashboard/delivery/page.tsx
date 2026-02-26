'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Search, Package, Clock, CheckCircle2, AlertCircle, BarChart3,
  Calendar, Building2, ChevronRight, Share2, AlertTriangle, Activity,
  Rocket, ExternalLink, XCircle, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Ticket } from '@/types';
import { AgentButton } from '@/components/agents/AgentButton';
import { agentConfigs } from '@/lib/agents/configs';

// ── Types ─────────────────────────────────────────────────────────────────────
type HealthScore = 'healthy' | 'on_track' | 'at_risk' | 'overdue';

interface TicketWithMeta extends Ticket {
  artifact_count?: number;
  health: HealthScore;
  days_in_status: number;
}

interface DeploymentRecord {
  id: string;
  ticket_id: string;
  platform: string;
  status: string;
  external_url?: string;
  created_at: string;
  // joined
  company_name?: string;
  project_name?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_PROGRESS: Record<string, number> = {
  SUBMITTED: 10,
  CONTEXT_PENDING: 20,
  ANALYZING: 35,
  QUESTIONS_PENDING: 45,
  BUILDING: 65,
  REVIEW_PENDING: 80,
  APPROVED: 92,
  DEPLOYED: 100,
  CLOSED: 100,
};

const STATUS_CONFIG: Record<string, { label: string; variant: string; dot: string }> = {
  SUBMITTED: { label: 'Submitted', variant: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  CONTEXT_PENDING: { label: 'Context Needed', variant: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  ANALYZING: { label: 'Analyzing', variant: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  QUESTIONS_PENDING: { label: 'Questions Pending', variant: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  BUILDING: { label: 'Building', variant: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  REVIEW_PENDING: { label: 'Awaiting Review', variant: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  APPROVED: { label: 'Approved', variant: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  DEPLOYED: { label: 'Delivered', variant: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  CLOSED: { label: 'Closed', variant: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
};

const PLATFORM_CONFIG: Record<string, { label: string; class: string }> = {
  n8n: { label: 'n8n', class: 'bg-orange-100 text-orange-700 border-orange-200' },
  make: { label: 'Make.com', class: 'bg-purple-100 text-purple-700 border-purple-200' },
  zapier: { label: 'Zapier', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
};

const HEALTH_CONFIG: Record<HealthScore, { label: string; dot: string; badge: string; bar: string }> = {
  healthy:  { label: 'Healthy',  dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', bar: '#10b981' },
  on_track: { label: 'On Track', dot: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-700',       bar: '#60a5fa' },
  at_risk:  { label: 'At Risk',  dot: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-800',     bar: '#f59e0b' },
  overdue:  { label: 'Overdue',  dot: 'bg-red-500',     badge: 'bg-red-100 text-red-700',         bar: '#ef4444' },
};

const PIPELINE_STAGES = [
  { key: 'Intake',    statuses: ['SUBMITTED', 'CONTEXT_PENDING'],           color: '#94a3b8' },
  { key: 'Analysis',  statuses: ['ANALYZING', 'QUESTIONS_PENDING'],          color: '#60a5fa' },
  { key: 'Building',  statuses: ['BUILDING'],                                color: '#f59e0b' },
  { key: 'Review',    statuses: ['REVIEW_PENDING'],                          color: '#a78bfa' },
  { key: 'Delivered', statuses: ['APPROVED', 'DEPLOYED', 'CLOSED'],          color: '#10b981' },
];

const DEPLOY_STATUS_CONFIG: Record<string, { label: string; class: string; icon: React.ReactNode }> = {
  deployed:               { label: 'Deployed',       class: 'bg-green-100 text-green-700',   icon: <CheckCircle2 size={12} /> },
  failed:                 { label: 'Failed',          class: 'bg-red-100 text-red-700',       icon: <XCircle size={12} /> },
  manual_guide_generated: { label: 'Guide Ready',     class: 'bg-blue-100 text-blue-700',     icon: <Rocket size={12} /> },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getDaysInStatus(t: Ticket): number {
  return Math.floor((Date.now() - new Date(t.updated_at).getTime()) / 86400000);
}

function getHealth(t: Ticket): HealthScore {
  if (['DEPLOYED', 'CLOSED', 'APPROVED'].includes(t.status)) return 'healthy';
  const days = getDaysInStatus(t);
  if (days >= 7) return 'overdue';
  if (days >= 3) return 'at_risk';
  return 'on_track';
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DeliveryPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketWithMeta[]>([]);
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploymentsLoading, setDeploymentsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [healthFilter, setHealthFilter] = useState('all');

  useEffect(() => {
    async function loadTickets() {
      const { data } = await supabase
        .from('tickets')
        .select('*')
        .order('updated_at', { ascending: false });

      if (data) {
        const ticketsWithMeta = await Promise.all(
          data.map(async (t) => {
            const { count } = await supabase
              .from('ticket_artifacts')
              .select('id', { count: 'exact', head: true })
              .eq('ticket_id', t.id);
            return {
              ...t,
              artifact_count: count ?? 0,
              health: getHealth(t as Ticket),
              days_in_status: getDaysInStatus(t as Ticket),
            } as TicketWithMeta;
          })
        );
        setTickets(ticketsWithMeta);
      }
      setLoading(false);
    }

    async function loadDeployments() {
      const { data } = await supabase
        .from('deployments')
        .select('id, ticket_id, platform, status, external_url, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (data && data.length > 0) {
        // Join with tickets to get company/project names
        const ticketIds = [...new Set(data.map((d) => d.ticket_id))];
        const { data: ticketData } = await supabase
          .from('tickets')
          .select('id, company_name, project_name')
          .in('id', ticketIds);

        const ticketMap = new Map((ticketData ?? []).map((t) => [t.id, t]));
        const enriched = data.map((d) => ({
          ...d,
          company_name: ticketMap.get(d.ticket_id)?.company_name ?? 'Unknown',
          project_name: ticketMap.get(d.ticket_id)?.project_name ?? 'Untitled',
        }));
        setDeployments(enriched);
      }
      setDeploymentsLoading(false);
    }

    loadTickets();
    loadDeployments();
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = tickets.length;
    const inProgress = tickets.filter((t) =>
      ['SUBMITTED', 'CONTEXT_PENDING', 'ANALYZING', 'QUESTIONS_PENDING', 'BUILDING'].includes(t.status)
    ).length;
    const awaitingReview = tickets.filter((t) => t.status === 'REVIEW_PENDING').length;
    const delivered = tickets.filter((t) => ['APPROVED', 'DEPLOYED', 'CLOSED'].includes(t.status)).length;
    const atRisk = tickets.filter((t) => t.health === 'at_risk' || t.health === 'overdue').length;
    return { total, inProgress, awaitingReview, delivered, atRisk };
  }, [tickets]);

  const pipelineData = useMemo(() =>
    PIPELINE_STAGES.map(({ key, statuses, color }) => ({
      stage: key,
      count: tickets.filter((t) => statuses.includes(t.status)).length,
      color,
    })),
    [tickets]
  );

  const needsAttention = useMemo(() =>
    tickets
      .filter((t) => t.health === 'at_risk' || t.health === 'overdue')
      .sort((a, b) => b.days_in_status - a.days_in_status)
      .slice(0, 5),
    [tickets]
  );

  // Tickets stuck in BUILDING > 5 days
  const overdueBuilds = useMemo(() =>
    tickets
      .filter((t) => t.status === 'BUILDING' && t.days_in_status > 5)
      .sort((a, b) => b.days_in_status - a.days_in_status),
    [tickets]
  );

  // Client health overview: group tickets by company_name
  const clientHealth = useMemo(() => {
    const SEVERITY: Record<HealthScore, number> = { healthy: 0, on_track: 1, at_risk: 2, overdue: 3 };
    const map = new Map<string, {
      company: string;
      total: number;
      active: number;
      delivered: number;
      worstHealth: HealthScore;
      lastActivity: string;
    }>();
    for (const t of tickets) {
      const entry = map.get(t.company_name) ?? {
        company: t.company_name,
        total: 0, active: 0, delivered: 0,
        worstHealth: 'healthy' as HealthScore,
        lastActivity: t.updated_at,
      };
      entry.total++;
      if (['SUBMITTED','CONTEXT_PENDING','ANALYZING','QUESTIONS_PENDING','BUILDING','REVIEW_PENDING'].includes(t.status)) entry.active++;
      if (['APPROVED','DEPLOYED','CLOSED'].includes(t.status)) entry.delivered++;
      if ((SEVERITY[t.health] ?? 0) > (SEVERITY[entry.worstHealth] ?? 0)) entry.worstHealth = t.health;
      if (t.updated_at > entry.lastActivity) entry.lastActivity = t.updated_at;
      map.set(t.company_name, entry);
    }
    return [...map.values()]
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
      .slice(0, 8);
  }, [tickets]);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      const matchesSearch =
        !search ||
        (t.company_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (t.project_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (t.contact_name ?? '').toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'in_progress' &&
          ['SUBMITTED', 'CONTEXT_PENDING', 'ANALYZING', 'QUESTIONS_PENDING', 'BUILDING'].includes(t.status)) ||
        (statusFilter === 'review' && t.status === 'REVIEW_PENDING') ||
        (statusFilter === 'delivered' && ['APPROVED', 'DEPLOYED', 'CLOSED'].includes(t.status)) ||
        t.status === statusFilter;
      const matchesPlatform = platformFilter === 'all' || t.ticket_type === platformFilter;
      const matchesHealth = healthFilter === 'all' || t.health === healthFilter;
      return matchesSearch && matchesStatus && matchesPlatform && matchesHealth;
    });
  }, [tickets, search, statusFilter, platformFilter, healthFilter]);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Delivery Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Client health command center — all active and delivered projects
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <SummaryCard
          icon={<BarChart3 size={18} className="text-slate-500" />}
          label="Total"
          value={stats.total}
          loading={loading}
          bg="bg-slate-50"
        />
        <SummaryCard
          icon={<Clock size={18} className="text-blue-500" />}
          label="In Progress"
          value={stats.inProgress}
          loading={loading}
          bg="bg-blue-50"
        />
        <SummaryCard
          icon={<AlertCircle size={18} className="text-purple-500" />}
          label="In Review"
          value={stats.awaitingReview}
          loading={loading}
          bg="bg-purple-50"
        />
        <SummaryCard
          icon={<CheckCircle2 size={18} className="text-emerald-500" />}
          label="Delivered"
          value={stats.delivered}
          loading={loading}
          bg="bg-emerald-50"
        />
        <SummaryCard
          icon={<AlertTriangle size={18} className="text-amber-500" />}
          label="At Risk"
          value={stats.atRisk}
          loading={loading}
          bg={stats.atRisk > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50'}
        />
      </div>

      {/* Client Health Overview */}
      {!loading && clientHealth.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} className="text-muted-foreground" />
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Client Health Overview
            </h2>
            <span className="text-xs text-muted-foreground ml-auto">{clientHealth.length} active clients</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {clientHealth.map(({ company, total, active, delivered, worstHealth, lastActivity }) => {
              const health = HEALTH_CONFIG[worstHealth];
              return (
                <button
                  key={company}
                  onClick={() => {
                    setSearch(company);
                    setStatusFilter('all');
                  }}
                  className="text-left border rounded-xl bg-white hover:shadow-sm hover:border-blue-200 transition-all p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold leading-snug line-clamp-2">{company}</div>
                    <span className={cn('w-2 h-2 rounded-full shrink-0 mt-1', health.dot)} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock size={10} /> {active} active
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 size={10} /> {delivered} done
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', health.badge)}>
                      {health.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(lastActivity).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Pipeline chart + Needs Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline overview */}
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Activity size={13} />
              Pipeline Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-36 bg-muted animate-pulse rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={pipelineData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, 'Projects']} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {pipelineData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Needs Attention */}
        <Card className={cn(needsAttention.length > 0 ? 'border-amber-200 bg-amber-50/30' : '')}>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide flex items-center gap-2">
              <AlertTriangle
                size={13}
                className={needsAttention.length > 0 ? 'text-amber-600' : 'text-muted-foreground'}
              />
              <span className={needsAttention.length > 0 ? 'text-amber-800' : 'text-muted-foreground'}>
                Needs Attention
              </span>
              {needsAttention.length > 0 && (
                <span className="ml-auto text-xs font-medium bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                  {needsAttention.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : needsAttention.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <CheckCircle2 size={28} className="mb-2 text-emerald-300" />
                <p className="text-sm font-medium">All projects on track</p>
                <p className="text-xs mt-0.5">No projects need immediate attention</p>
              </div>
            ) : (
              <div className="space-y-2">
                {needsAttention.map((t) => {
                  const health = HEALTH_CONFIG[t.health];
                  return (
                    <button
                      key={t.id}
                      onClick={() => router.push(`/dashboard/delivery/${t.id}`)}
                      className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg border bg-white hover:border-amber-300 hover:shadow-sm transition-all"
                    >
                      <span className={cn('w-2 h-2 rounded-full shrink-0', health.dot)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">
                          {t.project_name || 'Untitled'}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{t.company_name}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', health.badge)}>
                          {health.label}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {t.days_in_status}d in {STATUS_CONFIG[t.status]?.label ?? t.status}
                        </div>
                      </div>
                      <ChevronRight size={12} className="text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overdue Builds alert — only shown when there are overdue builds */}
      {!loading && overdueBuilds.length > 0 && (
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs font-semibold text-red-700 uppercase tracking-wide flex items-center gap-2">
              <AlertTriangle size={13} className="text-red-600" />
              Overdue Builds
              <span className="ml-auto text-xs font-medium bg-red-200 text-red-800 px-2 py-0.5 rounded-full">
                {overdueBuilds.length} stuck
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="divide-y divide-red-100">
              {overdueBuilds.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {t.project_name || 'Untitled'}
                      </span>
                      <span className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-semibold border shrink-0',
                        PLATFORM_CONFIG[t.ticket_type]?.class ?? 'bg-gray-100 text-gray-600'
                      )}>
                        {PLATFORM_CONFIG[t.ticket_type]?.label ?? t.ticket_type}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t.company_name}</div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                      {t.days_in_status}d in building
                    </span>
                    <button
                      onClick={() => router.push(`/dashboard/delivery/${t.id}`)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recently Deployed */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Rocket size={13} />
            Recently Deployed
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {deploymentsLoading ? (
            <div className="px-5 pb-4 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : deployments.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <Rocket size={28} className="mx-auto text-muted-foreground opacity-20 mb-2" />
              <p className="text-sm text-muted-foreground">No deployments yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Deployments will appear here once builds are approved and deployed
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {deployments.map((d) => {
                const depCfg = DEPLOY_STATUS_CONFIG[d.status] ?? {
                  label: d.status,
                  class: 'bg-gray-100 text-gray-600',
                  icon: <Rocket size={12} />,
                };
                const platformCfg = PLATFORM_CONFIG[d.platform] ?? {
                  label: d.platform,
                  class: 'bg-gray-100 text-gray-600 border-gray-200',
                };
                return (
                  <div key={d.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {d.project_name}
                        </span>
                        <span className={cn(
                          'text-[10px] px-2 py-0.5 rounded-full font-semibold border shrink-0',
                          platformCfg.class
                        )}>
                          {platformCfg.label}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{d.company_name}</div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <span className={cn(
                        'text-[10px] px-2 py-0.5 rounded font-medium flex items-center gap-1',
                        depCfg.class
                      )}>
                        {depCfg.icon}
                        {depCfg.label}
                      </span>
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {new Date(d.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      {d.external_url && (
                        <a
                          href={d.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open in platform"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={12} className="text-muted-foreground hover:text-blue-600 transition-colors" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search company, project, contact..."
            className="pl-8 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="review">Awaiting Review</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>

        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="All Platforms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="n8n">n8n</SelectItem>
            <SelectItem value="make">Make.com</SelectItem>
            <SelectItem value="zapier">Zapier</SelectItem>
          </SelectContent>
        </Select>

        <Select value={healthFilter} onValueChange={setHealthFilter}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="All Health" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Health</SelectItem>
            <SelectItem value="on_track">On Track</SelectItem>
            <SelectItem value="at_risk">At Risk</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="healthy">Healthy</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} project{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Project grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-52 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Package size={40} className="mb-3 opacity-30" />
          <p className="font-medium text-sm">No projects found</p>
          {(search || statusFilter !== 'all' || platformFilter !== 'all' || healthFilter !== 'all') && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setPlatformFilter('all');
                setHealthFilter('all');
              }}
              className="text-blue-600 text-sm mt-2 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((ticket) => (
            <ProjectCard
              key={ticket.id}
              ticket={ticket}
              onClick={() => router.push(`/dashboard/delivery/${ticket.id}`)}
            />
          ))}
        </div>
      )}

      {/* Delivery Agent */}
      <AgentButton config={agentConfigs.delivery} />
    </div>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({
  icon,
  label,
  value,
  loading,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
  bg: string;
}) {
  return (
    <div className={cn('rounded-xl border p-4 space-y-2', bg)}>
      <div className="flex items-center justify-between">
        {icon}
        {loading ? (
          <div className="h-7 w-8 bg-muted animate-pulse rounded" />
        ) : (
          <span className="text-2xl font-bold">{value}</span>
        )}
      </div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

// ── Project card ──────────────────────────────────────────────────────────────
function ProjectCard({ ticket, onClick }: { ticket: TicketWithMeta; onClick: () => void }) {
  function copyShareLink(e: React.MouseEvent) {
    e.stopPropagation();
    const url = `${window.location.origin}/share/${ticket.id}/demo`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Demo link copied!');
    }).catch(() => {
      toast.error('Could not copy link');
    });
  }

  const status = STATUS_CONFIG[ticket.status] ?? {
    label: ticket.status,
    variant: 'bg-gray-100 text-gray-700',
    dot: 'bg-gray-400',
  };
  const platform = PLATFORM_CONFIG[ticket.ticket_type] ?? {
    label: ticket.ticket_type,
    class: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  const progress = STATUS_PROGRESS[ticket.status] ?? 0;
  const health = HEALTH_CONFIG[ticket.health];

  return (
    <button
      onClick={onClick}
      className="text-left w-full border rounded-xl bg-white hover:shadow-md hover:border-blue-200 transition-all p-5 space-y-4 group"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Building2 size={12} className="text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate">{ticket.company_name}</span>
          </div>
          <h3 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors">
            {ticket.project_name || 'Untitled Project'}
          </h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {(ticket.artifact_count ?? 0) > 0 && (
            <button
              onClick={copyShareLink}
              title="Copy shareable demo link"
              className="p-1.5 rounded-md text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Share2 size={13} />
            </button>
          )}
          <ChevronRight size={16} className="text-muted-foreground mt-0.5 group-hover:text-blue-600 transition-colors" />
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold border', platform.class)}>
          {platform.label}
        </span>
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1', status.variant)}>
          <span className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
          {status.label}
        </span>
        {(ticket.artifact_count ?? 0) > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 h-4 font-normal">
            {ticket.artifact_count} deliverable{(ticket.artifact_count ?? 0) !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              progress === 100 ? 'bg-green-500' : progress >= 80 ? 'bg-purple-500' : 'bg-blue-500'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar size={11} />
          {new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
        <div className="flex items-center gap-1.5">
          {ticket.complexity_estimate && (
            <span className="capitalize">{ticket.complexity_estimate}</span>
          )}
          <span className={cn('flex items-center gap-0.5 px-1.5 py-0.5 rounded font-medium text-[10px]', health.badge)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', health.dot)} />
            {health.label}
          </span>
        </div>
      </div>
    </button>
  );
}
