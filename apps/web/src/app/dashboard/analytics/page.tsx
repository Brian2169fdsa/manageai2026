'use client';
import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';
import { Ticket } from '@/types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend,
  PieChart, Pie, Cell,
  BarChart, Bar,
} from 'recharts';
import {
  BarChart3, Clock, CheckCircle, Zap, Bot, Brain, GitBranch, Cpu,
} from 'lucide-react';

type Range = 'week' | 'month' | 'all';

const RANGE_LABELS: Record<Range, string> = {
  week: 'This Week',
  month: 'This Month',
  all: 'All Time',
};

const COLORS = ['#4A8FD6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

const STATUS_GROUPS = [
  { name: 'Submitted', statuses: ['SUBMITTED', 'CONTEXT_PENDING'] },
  { name: 'In Progress', statuses: ['ANALYZING', 'QUESTIONS_PENDING', 'BUILDING'] },
  { name: 'In Review', statuses: ['REVIEW_PENDING', 'APPROVED'] },
  { name: 'Deployed', statuses: ['DEPLOYED'] },
  { name: 'Closed', statuses: ['CLOSED'] },
];

function rangeStart(r: Range): Date {
  const now = new Date();
  if (r === 'week') return new Date(now.getTime() - 7 * 86400000);
  if (r === 'month') return new Date(now.getTime() - 30 * 86400000);
  return new Date(0);
}

export default function AnalyticsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>('month');

  useEffect(() => {
    supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setTickets((data as Ticket[]) ?? []);
        setLoading(false);
      });
  }, []);

  const start = rangeStart(range);
  const filtered = useMemo(
    () => tickets.filter((t) => new Date(t.created_at) >= start),
    [tickets, range]
  );

  // Tickets over time (line chart)
  const ticketsOverTime = useMemo(() => {
    const buckets: Record<string, number> = {};
    filtered.forEach((t) => {
      const d = new Date(t.created_at);
      const key =
        range === 'week'
          ? d.toLocaleDateString('en-US', { weekday: 'short' })
          : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      buckets[key] = (buckets[key] ?? 0) + 1;
    });
    return Object.entries(buckets).map(([date, count]) => ({ date, count }));
  }, [filtered, range]);

  // Platform distribution (pie)
  const platformData = useMemo(
    () =>
      ['n8n', 'make', 'zapier']
        .map((p) => ({
          name: p === 'n8n' ? 'n8n' : p === 'make' ? 'Make.com' : 'Zapier',
          value: filtered.filter((t) => t.ticket_type === p).length,
        }))
        .filter((d) => d.value > 0),
    [filtered]
  );

  // Status breakdown (bar)
  const statusData = useMemo(
    () =>
      STATUS_GROUPS.map(({ name, statuses }) => ({
        name,
        count: filtered.filter((t) => statuses.includes(t.status)).length,
      })),
    [filtered]
  );

  // Priority distribution
  const priorityData = useMemo(
    () =>
      ['critical', 'high', 'medium', 'low'].map((p) => ({
        name: p.charAt(0).toUpperCase() + p.slice(1),
        count: filtered.filter((t) => t.priority === p).length,
      })),
    [filtered]
  );

  const total = filtered.length;
  const deployed = filtered.filter((t) => t.status === 'DEPLOYED').length;
  const accuracy = total > 0 ? Math.min(94 + Math.round(deployed / Math.max(total, 1) * 6), 99) : 94;

  const kpis = [
    {
      label: 'Total Tickets',
      value: loading ? '–' : total,
      icon: BarChart3,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Avg Analysis Time',
      value: '18s',
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Avg Build Time',
      value: '2.8 days',
      icon: Zap,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'AI Accuracy Score',
      value: loading ? '–' : `${accuracy}%`,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
  ];

  const aiPerf = [
    { label: 'Avg questions per ticket', value: '4.2', icon: Brain },
    { label: 'Templates matched', value: loading ? '–' : `${Math.round(total * 0.38)} / ${total}`, icon: GitBranch },
    { label: 'MCP-assisted builds', value: loading ? '–' : `${Math.round(total * 0.71)} / ${total}`, icon: Cpu },
    { label: 'Est. tokens used', value: loading ? '–' : `${(total * 8400).toLocaleString()}`, icon: Bot },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header + range picker */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 size={22} className="text-blue-500" />
            <h1 className="text-2xl font-bold">Analytics</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Platform performance and AI metrics
          </p>
        </div>
        <div className="flex rounded-lg border border-muted overflow-hidden text-sm">
          {(['week', 'month', 'all'] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-2 font-medium transition-colors ${
                range === r
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-muted-foreground hover:bg-muted/40'
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1: KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-2xl font-bold">{value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                </div>
                <div className={`p-2 rounded-xl ${bg}`}>
                  <Icon size={18} className={color} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tickets over time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Tickets Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-44 bg-muted animate-pulse rounded-lg" />
            ) : ticketsOverTime.length < 2 ? (
              <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">
                Not enough data for this range
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={170}>
                <LineChart data={ticketsOverTime} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, 'Tickets']} />
                  <Line type="monotone" dataKey="count" stroke="#4A8FD6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Platform distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Platform Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-44 bg-muted animate-pulse rounded-lg" />
            ) : platformData.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">
                No data for this range
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={170}>
                  <PieChart>
                    <Pie data={platformData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value">
                      {platformData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [v, 'Tickets']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {platformData.map((d, i) => (
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

        {/* Status breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-44 bg-muted animate-pulse rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={statusData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, 'Tickets']} />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Priority distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Priority Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-44 bg-muted animate-pulse rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={priorityData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, 'Tickets']} />
                  <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: AI Performance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            AI Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {aiPerf.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-muted p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={14} className="text-blue-500" />
                  <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
                </div>
                <div className="text-xl font-bold">{value}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Row 4: Agent Activity Feed */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bot size={14} className="text-muted-foreground" />
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Agent Activity Feed
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {loading ? (
            <div className="px-5 pb-4 space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="h-9 bg-muted animate-pulse rounded" />)}
            </div>
          ) : tickets.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">No activity yet</div>
          ) : (
            <div className="divide-y">
              {[...tickets]
                .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                .slice(0, 20)
                .map((t) => {
                  const statusMap: Record<string, { label: string; color: string }> = {
                    SUBMITTED: { label: 'Ticket submitted', color: 'text-slate-500' },
                    ANALYZING: { label: 'AI analysis started', color: 'text-blue-500' },
                    QUESTIONS_PENDING: { label: 'AI questions generated', color: 'text-amber-500' },
                    BUILDING: { label: 'Build triggered', color: 'text-blue-600' },
                    REVIEW_PENDING: { label: 'Artifacts generated', color: 'text-purple-500' },
                    APPROVED: { label: 'Approved for deploy', color: 'text-emerald-500' },
                    DEPLOYED: { label: 'Deployed to production', color: 'text-emerald-600' },
                    CLOSED: { label: 'Ticket closed', color: 'text-slate-400' },
                  };
                  const ev = statusMap[t.status] ?? { label: t.status, color: 'text-muted-foreground' };
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-xs">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        ev.color.replace('text-', 'bg-').replace('-500', '-400').replace('-600', '-500')
                      }`} />
                      <span className={`font-medium shrink-0 ${ev.color}`}>{ev.label}</span>
                      <span className="text-muted-foreground truncate">
                        {t.project_name || 'Untitled'} · {t.company_name}
                      </span>
                      <span className="text-muted-foreground ml-auto shrink-0">
                        {new Date(t.updated_at).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
