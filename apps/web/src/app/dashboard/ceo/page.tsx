'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';
import { Ticket } from '@/types';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import {
  Crown, DollarSign, FolderOpen, Users,
  TrendingUp, CheckCircle, Clock,
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

export default function CEOPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTickets((data as Ticket[]) ?? []);
        setLoading(false);
      });
  }, []);

  const total = tickets.length;
  const completed = tickets.filter((t) => ['DEPLOYED', 'CLOSED'].includes(t.status)).length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const pipeline = tickets.reduce((sum, t) => sum + (PRIORITY_VALUE[t.priority] ?? 4000), 0);
  const activeProjects = tickets.filter((t) =>
    ['ANALYZING', 'QUESTIONS_PENDING', 'BUILDING', 'REVIEW_PENDING', 'APPROVED'].includes(t.status)
  ).length;

  // Status distribution for pie chart
  const statusGroups = [
    { name: 'Submitted', value: tickets.filter((t) => ['SUBMITTED', 'CONTEXT_PENDING'].includes(t.status)).length },
    { name: 'In Progress', value: tickets.filter((t) => ['ANALYZING', 'QUESTIONS_PENDING', 'BUILDING'].includes(t.status)).length },
    { name: 'In Review', value: tickets.filter((t) => ['REVIEW_PENDING', 'APPROVED'].includes(t.status)).length },
    { name: 'Deployed', value: tickets.filter((t) => t.status === 'DEPLOYED').length },
    { name: 'Closed', value: tickets.filter((t) => t.status === 'CLOSED').length },
  ].filter((d) => d.value > 0);

  // Platform breakdown
  const platformData = ['n8n', 'make', 'zapier'].map((p) => ({
    name: p === 'n8n' ? 'n8n' : p === 'make' ? 'Make.com' : 'Zapier',
    count: tickets.filter((t) => t.ticket_type === p).length,
  }));

  // Revenue pipeline by priority
  const pipelineData = ['critical', 'high', 'medium', 'low'].map((p) => ({
    name: p.charAt(0).toUpperCase() + p.slice(1),
    value: tickets.filter((t) => t.priority === p).length * (PRIORITY_VALUE[p] ?? 4000),
    count: tickets.filter((t) => t.priority === p).length,
  }));

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

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
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

      {/* KPI cards */}
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

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status distribution */}
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

        {/* Revenue pipeline */}
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

      {/* Platform breakdown */}
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

        {/* AI Brief placeholder */}
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

      {/* Team performance */}
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
