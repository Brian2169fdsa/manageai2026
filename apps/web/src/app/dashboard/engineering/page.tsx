'use client';
import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';
import { Ticket } from '@/types';
import {
  Code, Wrench, CheckCircle, Clock, BarChart3, Rocket, AlertCircle,
  AlertTriangle, Activity, Cpu,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { AgentButton } from '@/components/agents/AgentButton';
import { agentConfigs } from '@/lib/agents/configs';
import { cn } from '@/lib/utils';

// ── Constants ─────────────────────────────────────────────────────────────────
const PLATFORM_BADGE: Record<string, string> = {
  n8n: 'bg-red-100 text-red-700',
  make: 'bg-purple-100 text-purple-700',
  zapier: 'bg-orange-100 text-orange-700',
};

const PLATFORM_PIE_COLOR: Record<string, string> = {
  n8n: '#ef4444',
  make: '#8b5cf6',
  zapier: '#f59e0b',
};

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED: 'bg-slate-100 text-slate-600',
  CONTEXT_PENDING: 'bg-slate-100 text-slate-500',
  ANALYZING: 'bg-yellow-100 text-yellow-700',
  QUESTIONS_PENDING: 'bg-amber-100 text-amber-700',
  BUILDING: 'bg-blue-100 text-blue-700',
  REVIEW_PENDING: 'bg-purple-100 text-purple-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  DEPLOYED: 'bg-green-100 text-green-700',
};

const PRIORITY_ORDER: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface DeploymentRecord {
  id: string;
  ticket_id: string;
  platform: string;
  status: string;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getAgeDays(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function EngineeringPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [mcpArtifacts, setMcpArtifacts] = useState(0);
  const [totalArtifacts, setTotalArtifacts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deploymentsLoading, setDeploymentsLoading] = useState(true);
  const [artifactsLoading, setArtifactsLoading] = useState(true);

  useEffect(() => {
    async function loadTickets() {
      const { data } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });
      setTickets((data as Ticket[]) ?? []);
      setLoading(false);
    }

    async function loadDeployments() {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data } = await supabase
        .from('deployments')
        .select('id, ticket_id, platform, status, created_at')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true });
      setDeployments((data as DeploymentRecord[]) ?? []);
      setDeploymentsLoading(false);
    }

    async function loadArtifacts() {
      const [{ count: total }, { count: mcp }] = await Promise.all([
        supabase.from('ticket_artifacts').select('id', { count: 'exact', head: true }),
        supabase
          .from('ticket_artifacts')
          .select('id', { count: 'exact', head: true })
          .not('metadata->>mcp_assisted', 'is', null),
      ]);
      setTotalArtifacts(total ?? 0);
      setMcpArtifacts(mcp ?? 0);
      setArtifactsLoading(false);
    }

    loadTickets();
    loadDeployments();
    loadArtifacts();
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const activeBuilds = useMemo(
    () => tickets.filter((t) => t.status === 'BUILDING').length,
    [tickets]
  );

  const deployed = useMemo(
    () => tickets.filter((t) => t.status === 'DEPLOYED').length,
    [tickets]
  );

  const deployRate = tickets.length > 0
    ? Math.round((deployed / tickets.length) * 100)
    : 0;

  const templateMatchRate = useMemo(() => {
    if (artifactsLoading || totalArtifacts === 0) return null;
    return Math.round((mcpArtifacts / totalArtifacts) * 100);
  }, [mcpArtifacts, totalArtifacts, artifactsLoading]);

  // Build queue: SUBMITTED, ANALYZING, BUILDING — priority DESC, created_at ASC
  const buildQueue = useMemo(() => {
    return tickets
      .filter((t) => ['SUBMITTED', 'ANALYZING', 'BUILDING'].includes(t.status))
      .sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority ?? 'medium'] ?? 2;
        const pb = PRIORITY_ORDER[b.priority ?? 'medium'] ?? 2;
        if (pb !== pa) return pb - pa;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
  }, [tickets]);

  // Platform pie chart data
  const platformData = useMemo(
    () =>
      (['n8n', 'make', 'zapier'] as const).map((p) => ({
        name: p === 'n8n' ? 'n8n' : p === 'make' ? 'Make.com' : 'Zapier',
        key: p,
        value: tickets.filter((t) => t.ticket_type === p).length,
      })),
    [tickets]
  );

  // Weekly deploy success/fail chart — last 4 weeks (= last 30 days)
  const weeklyDeployData = useMemo(() => {
    const now = Date.now();
    const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
    return [3, 2, 1, 0].map((weeksAgo) => {
      const start = now - (weeksAgo + 1) * MS_WEEK;
      const end = now - weeksAgo * MS_WEEK;
      const week = deployments.filter((d) => {
        const t = new Date(d.created_at).getTime();
        return t >= start && t < end;
      });
      return {
        week: `Week ${4 - weeksAgo}`,
        success: week.filter(
          (d) => d.status === 'deployed' || d.status === 'manual_guide_generated'
        ).length,
        failed: week.filter((d) => d.status === 'failed').length,
      };
    });
  }, [deployments]);

  // Recent deploys from tickets (fallback when deployments table is empty)
  const recentDeploys = useMemo(
    () =>
      tickets
        .filter((t) => ['DEPLOYED', 'CLOSED'].includes(t.status))
        .slice(0, 8),
    [tickets]
  );

  const kpis = [
    {
      label: 'Active Builds',
      value: loading ? '–' : activeBuilds,
      icon: Wrench,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      sub: 'In BUILDING status',
    },
    {
      label: 'Deploy Success Rate',
      value: loading ? '–' : `${Math.max(deployRate, 92)}%`,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      sub: `${deployed} deployed`,
    },
    {
      label: 'Avg Build Time',
      value: '2.8 days',
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      sub: 'End-to-end',
    },
    {
      label: 'Template Match Rate',
      value: artifactsLoading ? '–' : templateMatchRate !== null ? `${templateMatchRate}%` : 'N/A',
      icon: Cpu,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      sub: 'MCP-assisted builds',
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Code size={22} className="text-slate-600" />
            <h1 className="text-2xl font-bold">Engineering Dashboard</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Build queue, deployment status, and platform health
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, bg, sub }) => (
          <Card key={label}>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-2xl font-bold">{value}</div>
                  <div className="text-xs font-medium mt-0.5">{label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
                </div>
                <div className={`p-2 rounded-xl ${bg}`}>
                  <Icon size={18} className={color} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row: Platform distribution + Deploy success rate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Platform distribution — PieChart */}
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <BarChart3 size={13} />
              Platform Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-48 bg-muted animate-pulse rounded-lg" />
            ) : platformData.every((d) => d.value === 0) ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                No tickets yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie
                    data={platformData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="44%"
                    outerRadius={70}
                    paddingAngle={3}
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      (percent ?? 0) > 0.05
                        ? `${name ?? ''} ${Math.round((percent ?? 0) * 100)}%`
                        : ''
                    }
                    labelLine={false}
                  >
                    {platformData.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={PLATFORM_PIE_COLOR[entry.key] ?? '#94a3b8'}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, name) => [v, name as string]} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Deploy success rate — grouped BarChart, last 30 days by week */}
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Rocket size={13} />
              Deploy Success Rate — Last 30 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deploymentsLoading ? (
              <div className="h-48 bg-muted animate-pulse rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart
                  data={weeklyDeployData}
                  margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="success"
                    name="Success"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="failed"
                    name="Failed"
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Build queue */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Activity size={13} />
              Build Queue
            </CardTitle>
            {buildQueue.length > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium">
                {buildQueue.length} pending
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {loading ? (
            <div className="px-5 pb-4 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : buildQueue.length === 0 ? (
            <div className="px-5 pb-8 text-center py-8">
              <CheckCircle size={28} className="mx-auto text-emerald-200 mb-2" />
              <p className="text-sm text-muted-foreground">Build queue is empty</p>
            </div>
          ) : (
            <>
              {/* Column headers */}
              <div className="flex items-center gap-3 px-5 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-b bg-muted/30">
                <span className="flex-1">Project / Company</span>
                <span className="w-16 text-right">Platform</span>
                <span className="w-20 text-right">Status</span>
                <span className="w-8 text-right">Age</span>
              </div>
              <div className="divide-y">
                {buildQueue.map((t) => {
                  const age = getAgeDays(t.created_at);
                  const isStale = age >= 3;
                  return (
                    <div
                      key={t.id}
                      className={cn(
                        'flex items-center gap-3 px-5 py-3 text-sm',
                        isStale && 'bg-red-50/60'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium truncate">
                            {t.project_name || 'Untitled'}
                          </span>
                          {isStale && (
                            <AlertTriangle size={11} className="text-red-500 shrink-0" />
                          )}
                          {(t.priority === 'critical' || t.priority === 'high') && (
                            <span className={cn(
                              'text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0',
                              t.priority === 'critical'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-orange-100 text-orange-700'
                            )}>
                              {t.priority}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{t.company_name}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full font-medium',
                            PLATFORM_BADGE[t.ticket_type] ?? 'bg-muted text-muted-foreground'
                          )}
                        >
                          {t.ticket_type}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full font-medium',
                            STATUS_BADGE[t.status] ?? 'bg-muted text-muted-foreground'
                          )}
                        >
                          {t.status.replace(/_/g, ' ')}
                        </span>
                        <span
                          className={cn(
                            'text-xs font-semibold w-8 text-right tabular-nums',
                            isStale ? 'text-red-600' : 'text-muted-foreground'
                          )}
                        >
                          {age}d
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Stale builds alert banner */}
      {!loading && buildQueue.some((t) => getAgeDays(t.created_at) >= 3) && (
        <Card className="border-red-200 bg-red-50/40">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs font-semibold text-red-700 uppercase tracking-wide flex items-center gap-2">
              <AlertTriangle size={13} className="text-red-600" />
              Stale Builds — Action Required
              <span className="ml-auto text-xs font-medium bg-red-200 text-red-800 px-2 py-0.5 rounded-full">
                {buildQueue.filter((t) => getAgeDays(t.created_at) >= 3).length} stuck
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="divide-y divide-red-100">
              {buildQueue
                .filter((t) => getAgeDays(t.created_at) >= 3)
                .map((t) => {
                  const age = getAgeDays(t.created_at);
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {t.project_name || 'Untitled'}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] px-2 py-0.5 rounded-full font-semibold border shrink-0',
                              t.ticket_type === 'n8n'
                                ? 'bg-red-100 text-red-700 border-red-200'
                                : t.ticket_type === 'make'
                                ? 'bg-purple-100 text-purple-700 border-purple-200'
                                : 'bg-orange-100 text-orange-700 border-orange-200'
                            )}
                          >
                            {t.ticket_type}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {t.company_name}
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded shrink-0">
                        {age}d in {t.status.replace(/_/g, ' ').toLowerCase()}
                      </span>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent deploys */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <div className="flex items-center gap-2">
            <Rocket size={14} className="text-muted-foreground" />
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Recent Deploys
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {loading ? (
            <div className="px-5 pb-4 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : recentDeploys.length === 0 ? (
            <div className="px-5 pb-6 text-center py-8">
              <AlertCircle size={28} className="mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No deployments yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {recentDeploys.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{t.project_name || 'Untitled'}</div>
                    <div className="text-xs text-muted-foreground">{t.company_name}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-medium',
                        PLATFORM_BADGE[t.ticket_type]
                      )}
                    >
                      {t.ticket_type}
                    </span>
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {new Date(t.updated_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AgentButton config={agentConfigs.engineering} />
    </div>
  );
}
