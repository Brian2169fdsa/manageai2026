'use client';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { TeammateDeployment } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AgentButton } from '@/components/agents/AgentButton';
import { agentConfigs } from '@/lib/agents/configs';
import {
  Search,
  Bot,
  CheckCircle2,
  Pause,
  Settings2,
  Building2,
  AlertTriangle,
  Users,
  Calendar,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const TEAMMATE_CONFIG: Record<
  string,
  { name: string; role: string; avatar: string; color: string }
> = {
  rebecka: {
    name: 'Rebecka',
    role: 'Executive Assistant',
    avatar: '🗓️',
    color: '#6366f1',
  },
  daniel: {
    name: 'Daniel',
    role: 'Sales Assistant',
    avatar: '🎯',
    color: '#ec4899',
  },
  sarah: {
    name: 'Sarah',
    role: 'Marketing Assistant',
    avatar: '📣',
    color: '#f59e0b',
  },
  andrew: {
    name: 'Andrew',
    role: 'Operations Assistant',
    avatar: '⚙️',
    color: '#10b981',
  },
};

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: typeof CheckCircle2 }> = {
  active: { label: 'Active', badge: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  paused: { label: 'Paused', badge: 'bg-slate-100 text-slate-600', icon: Pause },
  configuring: { label: 'Configuring', badge: 'bg-amber-100 text-amber-700', icon: Settings2 },
};

export default function TeammatesPage() {
  const [deployments, setDeployments] = useState<TeammateDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [search, setSearch] = useState('');
  const [teammateFilter, setTeammateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    async function load() {
      const { data: raw, error } = await supabase
        .from('teammate_deployments')
        .select('*, client_accounts(company_name)')
        .order('created_at', { ascending: false });

      if (error) {
        const isMissing =
          error.message?.includes('does not exist') ||
          error.code === 'PGRST116' ||
          (error as { code?: string }).code === '42P01';
        if (isMissing) setTableMissing(true);
        setDeployments([]);
      } else {
        setDeployments(
          (raw ?? []).map((d) => ({
            ...d,
            company_name:
              (d.client_accounts as { company_name?: string } | null)?.company_name ?? 'Unknown',
          }))
        );
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    return deployments.filter((d) => {
      const matchesSearch =
        !search || (d.company_name ?? '').toLowerCase().includes(search.toLowerCase());
      const matchesTeammate = teammateFilter === 'all' || d.teammate === teammateFilter;
      const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
      return matchesSearch && matchesTeammate && matchesStatus;
    });
  }, [deployments, search, teammateFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = deployments.length;
    const active = deployments.filter((d) => d.status === 'active').length;
    const byTeammate = Object.entries(TEAMMATE_CONFIG).map(([key, tc]) => ({
      name: tc.name,
      key,
      count: deployments.filter((d) => d.teammate === key).length,
      active: deployments.filter((d) => d.teammate === key && d.status === 'active').length,
      color: tc.color,
    }));
    const uniqueClients = new Set(deployments.map((d) => d.client_id)).size;
    return { total, active, byTeammate, uniqueClients };
  }, [deployments]);

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

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">AI Teammates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage Rebecka, Daniel, Sarah, and Andrew deployments across clients
        </p>
      </div>

      {tableMissing && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle size={14} className="inline mr-2" />
          The <code className="font-mono text-xs bg-amber-100 px-1 rounded">teammate_deployments</code>{' '}
          table has not been created yet. Run{' '}
          <code className="font-mono text-xs bg-amber-100 px-1 rounded">scripts/migrate-new-tables.sql</code>.
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mb-1">
              <Bot size={13} /> Total Deployments
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.active} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mb-1">
              <Building2 size={13} /> Clients Served
            </div>
            <p className="text-2xl font-bold">{stats.uniqueClients}</p>
          </CardContent>
        </Card>
        {stats.byTeammate.slice(0, 2).map((t) => (
          <Card key={t.key}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 text-xs font-medium mb-1" style={{ color: t.color }}>
                <span>{TEAMMATE_CONFIG[t.key].avatar}</span> {t.name}
              </div>
              <p className="text-2xl font-bold">{t.count}</p>
              <p className="text-xs text-muted-foreground mt-1">{t.active} active</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart + List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar chart */}
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Users size={13} /> Deployments by Teammate
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.byTeammate.some((t) => t.count > 0) ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={stats.byTeammate} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, 'Deployments']} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {stats.byTeammate.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[180px] text-sm text-muted-foreground">
                No deployments yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filters + List */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by client…"
                className="pl-8 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={teammateFilter} onValueChange={setTeammateFilter}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue placeholder="All Teammates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teammates</SelectItem>
                {Object.entries(TEAMMATE_CONFIG).map(([key, tc]) => (
                  <SelectItem key={key} value={key}>
                    {tc.avatar} {tc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="configuring">Configuring</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
              ))
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Bot size={32} className="mb-2 opacity-30" />
                <p className="text-sm font-medium">No teammate deployments yet</p>
                <p className="text-xs mt-1">Deploy AI teammates to clients to track them here</p>
              </div>
            ) : (
              filtered.map((dep) => {
                const tc = TEAMMATE_CONFIG[dep.teammate] ?? {
                  name: dep.teammate,
                  role: 'Unknown',
                  avatar: '🤖',
                  color: '#94a3b8',
                };
                const sc = STATUS_CONFIG[dep.status] ?? STATUS_CONFIG.configuring;
                const StatusIcon = sc.icon;
                return (
                  <div
                    key={dep.id}
                    className="flex items-center gap-3 p-3 rounded-xl border bg-white hover:shadow-sm transition-shadow"
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                      style={{ backgroundColor: tc.color + '18' }}
                    >
                      {tc.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{tc.name}</span>
                        <span className="text-xs text-muted-foreground">→</span>
                        <span className="text-sm font-medium truncate">{dep.company_name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>{tc.role}</span>
                        <span className="flex items-center gap-1">
                          <Calendar size={10} /> Deployed {fmtDate(dep.deployed_at)}
                        </span>
                        {dep.last_active && (
                          <span className="flex items-center gap-1">
                            <Activity size={10} /> Last active {fmtDate(dep.last_active)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', sc.badge)}>
                      <StatusIcon size={10} className="mr-1" />
                      {sc.label}
                    </Badge>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <AgentButton config={agentConfigs.delivery} />
    </div>
  );
}
