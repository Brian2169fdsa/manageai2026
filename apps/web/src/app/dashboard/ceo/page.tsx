'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';
import { Ticket } from '@/types';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import {
  Crown, DollarSign, FolderOpen, Users,
  TrendingUp, CheckCircle, Clock, Zap,
  BarChart2, Plus, Activity, Target,
  ArrowRight, Layers, AlertCircle,
} from 'lucide-react';
import { AgentButton } from '@/components/agents/AgentButton';
import { agentConfigs } from '@/lib/agents/configs';

const COLORS = ['#4A8FD6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

const PRIORITY_VALUE: Record<string, number> = {
  critical: 15000,
  high: 8000,
  medium: 4000,
  low: 1500,
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  SUBMITTED:        { bg: 'bg-gray-100',    text: 'text-gray-700',    label: 'Submitted' },
  CONTEXT_PENDING:  { bg: 'bg-gray-100',    text: 'text-gray-600',    label: 'Context Pending' },
  ANALYZING:        { bg: 'bg-blue-100',    text: 'text-blue-700',    label: 'Analyzing' },
  QUESTIONS_PENDING:{ bg: 'bg-blue-100',    text: 'text-blue-700',    label: 'Questions' },
  BUILDING:         { bg: 'bg-yellow-100',  text: 'text-yellow-700',  label: 'Building' },
  REVIEW_PENDING:   { bg: 'bg-orange-100',  text: 'text-orange-700',  label: 'Review Pending' },
  APPROVED:         { bg: 'bg-green-100',   text: 'text-green-700',   label: 'Approved' },
  DEPLOYED:         { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Deployed' },
  CLOSED:           { bg: 'bg-slate-100',   text: 'text-slate-600',   label: 'Closed' },
};

const DEPT_COLORS: Record<string, string> = {
  ceo:         '#6366F1',
  sales:       '#EC4899',
  marketing:   '#F59E0B',
  product:     '#8B5CF6',
  engineering: '#10B981',
  delivery:    '#0EA5E9',
};

interface PipelineStage {
  id: number;
  name: string;
  order_nr: number;
  deal_count?: number;
  total_value?: number | string;
}

interface PipelineSummary {
  per_stages?: Record<string, { count: number; value?: { value: number; currency: string } }>;
  total_count?: number;
  total_value?: { value: number; currency: string };
}

interface ActivityEvent {
  id: string;
  created_at: string;
  department?: string;
  agent_name?: string;
  event_type?: string;
  message?: string;
  content?: string;
}

export default function CEOPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  // New state for enriched sections
  const [pipeDeals, setPipeDeals] = useState<{ count: number; value: number; demo: boolean }>({
    count: 0, value: 0, demo: false,
  });
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [pipelineSummary, setPipelineSummary] = useState<PipelineSummary | null>(null);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [deployCount, setDeployCount] = useState(0);
  const [templatesTotal, setTemplatesTotal] = useState(0);
  const [metricsLoading, setMetricsLoading] = useState(true);

  useEffect(() => {
    // Existing: fetch all tickets
    supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTickets((data as Ticket[]) ?? []);
        setLoading(false);
      });

    // Pipedrive: deals summary
    fetch('/api/pipedrive/deals?status=open&limit=50')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const deals: { value?: number }[] = Array.isArray(data) ? data : (data.deals ?? []);
        const total_value = deals.reduce((s, d) => s + (Number(d.value) || 0), 0);
        setPipeDeals({ count: deals.length, value: total_value, demo: !!data.demo_mode });
      })
      .catch(() => {});

    // Pipedrive: pipeline stage breakdown
    fetch('/api/pipedrive/pipeline')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const stages: PipelineStage[] = (data.stages ?? []).map((s: PipelineStage) => {
          const stageData = data.summary?.per_stages?.[String(s.id)];
          return {
            ...s,
            deal_count: stageData?.count ?? 0,
            total_value: stageData?.value?.value ?? 0,
          };
        });
        setPipelineStages(stages);
        setPipelineSummary(data.summary ?? null);
      })
      .catch(() => {});

    // Supabase: activity events + deployments + templates in parallel
    Promise.all([
      supabase
        .from('activity_events')
        .select('id, created_at, department, agent_name, event_type, message, content')
        .order('created_at', { ascending: false })
        .limit(15),
      supabase
        .from('deployments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'success')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      supabase
        .from('templates')
        .select('id', { count: 'exact', head: true }),
    ]).then(([actRes, depRes, tplRes]) => {
      setActivities((actRes.data as ActivityEvent[]) ?? []);
      setDeployCount(depRes.count ?? 0);
      setTemplatesTotal(tplRes.count ?? 0);
      setMetricsLoading(false);
    });
  }, []);

  // ── Derived values (existing) ──────────────────────────────────────────────
  const total = tickets.length;
  const completed = tickets.filter((t) => ['DEPLOYED', 'CLOSED'].includes(t.status)).length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const pipeline = tickets.reduce((sum, t) => sum + (PRIORITY_VALUE[t.priority] ?? 4000), 0);
  const activeProjects = tickets.filter((t) =>
    ['ANALYZING', 'QUESTIONS_PENDING', 'BUILDING', 'REVIEW_PENDING', 'APPROVED'].includes(t.status)
  ).length;

  // New: active builds count and capacity
  const activeBuilds = tickets.filter((t) =>
    ['BUILDING', 'ANALYZING', 'SUBMITTED'].includes(t.status)
  ).length;
  const capacityColor =
    activeBuilds < 3 ? 'text-emerald-600' : activeBuilds <= 5 ? 'text-amber-600' : 'text-red-600';
  const capacityBg =
    activeBuilds < 3 ? 'bg-emerald-50' : activeBuilds <= 5 ? 'bg-amber-50' : 'bg-red-50';
  const capacityLabel =
    activeBuilds < 3 ? 'Healthy' : activeBuilds <= 5 ? 'Busy' : 'At Capacity';

  // Status counts for Build Pipeline Health
  const statusCounts: Record<string, number> = {};
  for (const t of tickets) {
    statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;
  }

  // Status distribution for pie chart (existing)
  const statusGroups = [
    { name: 'Submitted', value: tickets.filter((t) => ['SUBMITTED', 'CONTEXT_PENDING'].includes(t.status)).length },
    { name: 'In Progress', value: tickets.filter((t) => ['ANALYZING', 'QUESTIONS_PENDING', 'BUILDING'].includes(t.status)).length },
    { name: 'In Review', value: tickets.filter((t) => ['REVIEW_PENDING', 'APPROVED'].includes(t.status)).length },
    { name: 'Deployed', value: tickets.filter((t) => t.status === 'DEPLOYED').length },
    { name: 'Closed', value: tickets.filter((t) => t.status === 'CLOSED').length },
  ].filter((d) => d.value > 0);

  // Platform breakdown (existing)
  const platformData = ['n8n', 'make', 'zapier'].map((p) => ({
    name: p === 'n8n' ? 'n8n' : p === 'make' ? 'Make.com' : 'Zapier',
    count: tickets.filter((t) => t.ticket_type === p).length,
  }));

  // Revenue pipeline by priority (existing)
  const pipelineData = ['critical', 'high', 'medium', 'low'].map((p) => ({
    name: p.charAt(0).toUpperCase() + p.slice(1),
    value: tickets.filter((t) => t.priority === p).length * (PRIORITY_VALUE[p] ?? 4000),
    count: tickets.filter((t) => t.priority === p).length,
  }));

  // Existing KPI cards
  const kpis = [
    {
      label: 'Revenue Pipeline',
      value: loading ? '–' : `$${(pipeline / 1000).toFixed(0)}k`,
      icon: DollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      sub: `${total} active requests`,
    },
    {
      label: 'Active Projects',
      value: loading ? '–' : activeProjects,
      icon: FolderOpen,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      sub: 'In pipeline',
    },
    {
      label: 'Completion Rate',
      value: loading ? '–' : `${completionRate}%`,
      icon: CheckCircle,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      sub: `${completed} of ${total} delivered`,
    },
    {
      label: 'Avg Build Time',
      value: loading ? '–' : '3.2 days',
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      sub: 'Across all platforms',
    },
  ];

  // Format timestamp
  function timeAgo(ts: string) {
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  // Max deals in any pipeline stage (for width scaling)
  const maxStageDeals = Math.max(1, ...pipelineStages.map((s) => s.deal_count ?? 0));

  return (
    <div className="space-y-6 max-w-6xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Crown size={22} className="text-amber-500" />
            <h1 className="text-2xl font-bold">CEO Dashboard</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Executive overview of all platform activity and revenue pipeline
          </p>
        </div>
      </div>

      {/* ── NEW: Quick Actions ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'View All Tickets', href: '/dashboard/tickets', icon: Layers },
          { label: 'View Pipeline', href: '/dashboard/sales', icon: TrendingUp },
          { label: 'View Customers', href: '/dashboard/customers', icon: Users },
          { label: 'New Ticket', href: '/portal/new-ticket', icon: Plus },
        ].map(({ label, href, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white hover:bg-muted/40 text-sm font-medium transition-colors"
          >
            <Icon size={14} className="text-muted-foreground" />
            {label}
            <ArrowRight size={12} className="text-muted-foreground ml-0.5" />
          </Link>
        ))}
      </div>

      {/* ── NEW: Company Health Strip ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          {
            label: 'Open Deals',
            value: metricsLoading ? '–' : pipeDeals.count,
            sub: pipeDeals.demo ? 'Demo data' : 'Pipedrive CRM',
            icon: Target,
            color: 'text-pink-600',
            bg: 'bg-pink-50',
          },
          {
            label: 'Pipeline Value',
            value: metricsLoading ? '–' : pipeDeals.value > 0
              ? `$${(pipeDeals.value / 1000).toFixed(0)}k`
              : `$${(pipeline / 1000).toFixed(0)}k`,
            sub: pipeDeals.value > 0 ? 'Real Pipedrive data' : 'Est. from tickets',
            icon: DollarSign,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
          },
          {
            label: 'Active Builds',
            value: loading ? '–' : activeBuilds,
            sub: `${capacityLabel} — ${activeBuilds} in progress`,
            icon: Zap,
            color: capacityColor,
            bg: capacityBg,
          },
          {
            label: 'Deployed (30d)',
            value: metricsLoading ? '–' : deployCount,
            sub: 'Successful deployments',
            icon: CheckCircle,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
          },
          {
            label: 'Templates',
            value: metricsLoading ? '–' : templatesTotal.toLocaleString(),
            sub: 'n8n + Make + Zapier',
            icon: BarChart2,
            color: 'text-purple-600',
            bg: 'bg-purple-50',
          },
        ].map(({ label, value, sub, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xl font-bold truncate">{value}</div>
                  <div className="text-xs font-medium text-foreground mt-0.5">{label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</div>
                </div>
                <div className={`p-1.5 rounded-lg shrink-0 ${bg}`}>
                  <Icon size={15} className={color} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Existing KPI cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, bg, sub }) => (
          <Card key={label}>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-2xl font-bold">{value}</div>
                  <div className="text-xs font-medium text-foreground mt-0.5">{label}</div>
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

      {/* ── NEW: Build Pipeline Health ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Build Pipeline Health
            </CardTitle>
            {activeBuilds > 5 && (
              <div className="flex items-center gap-1 text-xs text-red-600 font-medium">
                <AlertCircle size={12} />
                High load — {activeBuilds} active
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex gap-2 flex-wrap">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-7 w-24 bg-muted animate-pulse rounded-full" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_STYLES).map(([status, style]) => {
                const count = statusCounts[status] ?? 0;
                if (count === 0) return null;
                return (
                  <div
                    key={status}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}
                  >
                    <span>{style.label}</span>
                    <span className="font-bold">{count}</span>
                  </div>
                );
              })}
              {total === 0 && (
                <span className="text-sm text-muted-foreground">No tickets yet</span>
              )}
            </div>
          )}
          {!loading && (
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
              <span>Total: <strong className="text-foreground">{total}</strong></span>
              <span>Active: <strong className="text-foreground">{activeProjects}</strong></span>
              <span>Delivered: <strong className="text-emerald-600">{completed}</strong></span>
              <span className={`font-semibold ${capacityColor}`}>
                Capacity: {capacityLabel}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Existing Charts row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Project Status Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-48 bg-muted animate-pulse rounded-lg" />
            ) : statusGroups.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={180}>
                  <PieChart>
                    <Pie data={statusGroups} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                      {statusGroups.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [v, 'Tickets']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5">
                  {statusGroups.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-semibold ml-auto pl-2">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Revenue Pipeline by Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-48 bg-muted animate-pulse rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={pipelineData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v / 1000}k`} />
                  <Tooltip formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Est. Value']} />
                  <Bar dataKey="value" fill="#4A8FD6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── NEW: Pipeline Overview (Pipedrive stages) ──────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Sales Pipeline — Stage Breakdown
            </CardTitle>
            {pipelineSummary?.total_count !== undefined && (
              <span className="text-xs text-muted-foreground">
                {pipelineSummary.total_count} deals ·{' '}
                {pipelineSummary.total_value?.value
                  ? `$${(pipelineSummary.total_value.value / 1000).toFixed(0)}k total`
                  : ''}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {metricsLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-muted animate-pulse rounded" />)}
            </div>
          ) : pipelineStages.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Pipeline data unavailable</div>
          ) : (
            <div className="space-y-2.5">
              {pipelineStages.map((stage) => {
                const count = stage.deal_count ?? 0;
                const value = typeof stage.total_value === 'number' ? stage.total_value : 0;
                const pct = Math.round((count / maxStageDeals) * 100);
                const isHighest = count === maxStageDeals && count > 0;
                return (
                  <div key={stage.id} className="flex items-center gap-3">
                    <div className="w-28 shrink-0 text-xs text-muted-foreground truncate">{stage.name}</div>
                    <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isHighest ? 'bg-[#4A8FD6]' : 'bg-[#4A8FD6]/50'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="w-8 text-right text-xs font-semibold text-foreground">{count}</div>
                    {value > 0 && (
                      <div className="w-16 text-right text-xs text-muted-foreground">
                        ${(value / 1000).toFixed(0)}k
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Existing Platform breakdown + AI Brief ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Platform Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {platformData.map((p) => (
                <div key={p.name} className="text-center p-4 rounded-xl bg-muted/30 border border-muted">
                  <div className="text-3xl font-bold text-foreground">{loading ? '–' : p.count}</div>
                  <div className="text-xs text-muted-foreground mt-1">{p.name}</div>
                  <div className="text-xs text-muted-foreground">builds</div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: 'Avg delivery', value: '3.2 days' },
                { label: 'Client satisfaction', value: '4.8 / 5' },
                { label: 'This week', value: `${tickets.filter((t) => new Date(t.created_at) > new Date(Date.now() - 7 * 86400000)).length} new` },
              ].map(({ label, value }) => (
                <div key={label} className="text-center p-3 rounded-xl border border-muted">
                  <div className="text-sm font-semibold">{value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-100 bg-gradient-to-br from-blue-50/60 to-white">
          <CardContent className="pt-5 pb-5 px-5 h-full flex flex-col justify-center text-center">
            <div className="text-4xl mb-2">👔</div>
            <div className="font-semibold text-sm mb-1">Executive AI is ready</div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Ask for a daily brief, pipeline overview, or team performance summary. Your AI chief of staff has access to all platform data.
            </p>
            <div className="grid grid-cols-2 gap-2 text-center">
              {['Daily Summary', 'Action Items', 'Pipeline View', 'Revenue Forecast'].map((l) => (
                <div key={l} className="rounded-lg bg-white border border-blue-100 p-2">
                  <div className="text-xs font-semibold text-blue-700">{l}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── NEW: Recent Activity Feed (activity_events) ────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Agent Activity Feed
            </CardTitle>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Activity size={12} />
              <span>Last 15 events</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {metricsLoading ? (
            <div className="px-5 pb-4 space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}
            </div>
          ) : activities.length === 0 ? (
            <div className="px-5 pb-6 text-sm text-muted-foreground text-center py-8">
              No activity events yet — agent actions will appear here
            </div>
          ) : (
            <div className="divide-y">
              {activities.map((ev) => {
                const dept = ev.department ?? 'system';
                const accent = DEPT_COLORS[dept] ?? '#94a3b8';
                const msg = ev.message ?? ev.content ?? ev.event_type ?? 'Agent action';
                return (
                  <div key={ev.id} className="flex items-start gap-3 px-5 py-3">
                    <div
                      className="mt-0.5 w-2 h-2 rounded-full shrink-0 mt-1.5"
                      style={{ background: accent }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold" style={{ color: accent }}>
                        {(ev.agent_name ?? dept).toUpperCase()}
                        {ev.event_type && (
                          <span className="ml-1.5 text-muted-foreground font-normal">· {ev.event_type}</span>
                        )}
                      </div>
                      <div className="text-xs text-foreground mt-0.5 line-clamp-2">{msg}</div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0 mt-0.5">
                      {timeAgo(ev.created_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Existing: Recent Activity (last 5 tickets) ─────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Recent Activity
            </CardTitle>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp size={12} />
              <span>Last 5 tickets</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {loading ? (
            <div className="px-5 pb-4 space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}
            </div>
          ) : tickets.slice(0, 5).length === 0 ? (
            <div className="px-5 pb-5 text-sm text-muted-foreground text-center py-8">No tickets yet</div>
          ) : (
            <div className="divide-y">
              {tickets.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <Users size={14} className="text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{t.project_name || 'Untitled'}</div>
                      <div className="text-xs text-muted-foreground">{t.company_name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{t.ticket_type}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      ['DEPLOYED', 'CLOSED'].includes(t.status) ? 'bg-emerald-100 text-emerald-700' :
                      ['BUILDING', 'ANALYZING'].includes(t.status) ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {t.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      ${(PRIORITY_VALUE[t.priority] ?? 4000).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AgentButton config={agentConfigs.ceo} />
    </div>
  );
}
