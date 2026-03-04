'use client';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { ClientAutomation } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AgentButton } from '@/components/agents/AgentButton';
import { agentConfigs } from '@/lib/agents/configs';
import {
  Search,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Loader2,
  ExternalLink,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const HEALTH_CONFIG: Record<string, { label: string; dot: string; badge: string; icon: typeof CheckCircle2 }> = {
  healthy: { label: 'Healthy', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  degraded: { label: 'Degraded', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  failing: { label: 'Failing', dot: 'bg-red-500', badge: 'bg-red-100 text-red-700', icon: XCircle },
};

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  active: { label: 'Active', badge: 'bg-emerald-100 text-emerald-700' },
  paused: { label: 'Paused', badge: 'bg-slate-100 text-slate-600' },
  error: { label: 'Error', badge: 'bg-red-100 text-red-700' },
  unknown: { label: 'Unknown', badge: 'bg-gray-100 text-gray-600' },
};

const PLATFORM_CONFIG: Record<string, { label: string; class: string }> = {
  n8n: { label: 'n8n', class: 'bg-orange-100 text-orange-700 border-orange-200' },
  make: { label: 'Make.com', class: 'bg-purple-100 text-purple-700 border-purple-200' },
  zapier: { label: 'Zapier', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
};

const PIE_COLORS: Record<string, string> = {
  healthy: '#10b981',
  degraded: '#f59e0b',
  failing: '#ef4444',
};

export default function MonitoringPage() {
  const [automations, setAutomations] = useState<ClientAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [search, setSearch] = useState('');
  const [healthFilter, setHealthFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');

  async function loadAutomations() {
    const { data: raw, error } = await supabase
      .from('client_automations')
      .select('*, client_accounts(company_name)')
      .order('created_at', { ascending: false });

    if (error) {
      const isMissing =
        error.message?.includes('does not exist') ||
        error.code === 'PGRST116' ||
        (error as { code?: string }).code === '42P01';
      if (isMissing) setTableMissing(true);
      setAutomations([]);
    } else {
      setAutomations(
        (raw ?? []).map((a) => ({
          ...a,
          company_name:
            (a.client_accounts as { company_name?: string } | null)?.company_name ?? 'Unknown',
        }))
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    loadAutomations();
  }, []);

  async function runHealthCheck() {
    setChecking(true);
    try {
      await fetch('/api/monitoring', { method: 'POST', body: JSON.stringify({}) });
      await loadAutomations();
    } finally {
      setChecking(false);
    }
  }

  const filtered = useMemo(() => {
    return automations.filter((a) => {
      const matchesSearch =
        !search ||
        (a.company_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (a.external_id ?? '').toLowerCase().includes(search.toLowerCase());
      const matchesHealth = healthFilter === 'all' || a.health === healthFilter;
      const matchesPlatform = platformFilter === 'all' || a.platform === platformFilter;
      return matchesSearch && matchesHealth && matchesPlatform;
    });
  }, [automations, search, healthFilter, platformFilter]);

  const stats = useMemo(() => {
    const total = automations.length;
    const healthy = automations.filter((a) => a.health === 'healthy').length;
    const degraded = automations.filter((a) => a.health === 'degraded').length;
    const failing = automations.filter((a) => a.health === 'failing').length;
    const active = automations.filter((a) => a.status === 'active').length;
    const totalRuns = automations.reduce((s, a) => s + (a.run_count ?? 0), 0);
    const totalErrors = automations.reduce((s, a) => s + (a.error_count ?? 0), 0);
    return { total, healthy, degraded, failing, active, totalRuns, totalErrors };
  }, [automations]);

  const healthPieData = useMemo(
    () =>
      [
        { name: 'Healthy', key: 'healthy', value: stats.healthy },
        { name: 'Degraded', key: 'degraded', value: stats.degraded },
        { name: 'Failing', key: 'failing', value: stats.failing },
      ].filter((d) => d.value > 0),
    [stats]
  );

  function fmtDate(d: unknown): string {
    if (!d) return '—';
    try {
      return new Date(String(d)).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Automation Monitoring</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time health of all deployed client automations
          </p>
        </div>
        <button
          onClick={runHealthCheck}
          disabled={checking}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {checking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {checking ? 'Checking…' : 'Run Health Check'}
        </button>
      </div>

      {tableMissing && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle size={14} className="inline mr-2" />
          The <code className="font-mono text-xs bg-amber-100 px-1 rounded">client_automations</code>{' '}
          table has not been created yet. Run the migration in{' '}
          <code className="font-mono text-xs bg-amber-100 px-1 rounded">scripts/migrate-new-tables.sql</code>{' '}
          to enable monitoring.
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mb-1">
              <Zap size={13} /> Total Automations
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.active} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium mb-1">
              <Wifi size={13} /> Healthy
            </div>
            <p className="text-2xl font-bold text-emerald-700">{stats.healthy}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total > 0 ? Math.round((stats.healthy / stats.total) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-xs text-amber-600 font-medium mb-1">
              <AlertTriangle size={13} /> Degraded
            </div>
            <p className="text-2xl font-bold text-amber-700">{stats.degraded}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-xs text-red-600 font-medium mb-1">
              <WifiOff size={13} /> Failing
            </div>
            <p className="text-2xl font-bold text-red-700">{stats.failing}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalErrors} total errors / {stats.totalRuns} runs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts + Filters row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pie chart */}
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Activity size={13} /> Health Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {healthPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={healthPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="44%"
                    outerRadius={65}
                    paddingAngle={3}
                    label={({ name, percent }) =>
                      (percent ?? 0) > 0.05 ? `${name} ${Math.round((percent ?? 0) * 100)}%` : ''
                    }
                  >
                    {healthPieData.map((entry) => (
                      <Cell key={entry.key} fill={PIE_COLORS[entry.key] ?? '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[180px] text-sm text-muted-foreground">
                No automations tracked yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filter controls */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by client or automation ID…"
                className="pl-8 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={healthFilter} onValueChange={setHealthFilter}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue placeholder="All Health" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Health</SelectItem>
                <SelectItem value="healthy">Healthy</SelectItem>
                <SelectItem value="degraded">Degraded</SelectItem>
                <SelectItem value="failing">Failing</SelectItem>
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
          </div>

          {/* Automation list */}
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
              ))
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Zap size={32} className="mb-2 opacity-30" />
                <p className="text-sm font-medium">No automations found</p>
                <p className="text-xs mt-1">Deploy automations to clients to start monitoring</p>
              </div>
            ) : (
              filtered.map((auto) => {
                const hc = HEALTH_CONFIG[auto.health] ?? HEALTH_CONFIG.degraded;
                const sc = STATUS_CONFIG[auto.status] ?? STATUS_CONFIG.unknown;
                const pc = PLATFORM_CONFIG[auto.platform] ?? { label: auto.platform, class: 'bg-gray-100 text-gray-600' };
                const HealthIcon = hc.icon;
                return (
                  <div
                    key={auto.id}
                    className="flex items-center gap-3 p-3 rounded-xl border bg-white hover:shadow-sm transition-shadow"
                  >
                    <div className={cn('w-2 h-2 rounded-full shrink-0', hc.dot)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {auto.company_name}
                        </span>
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', pc.class)}>
                          {pc.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>{auto.run_count ?? 0} runs</span>
                        <span>{auto.error_count ?? 0} errors</span>
                        <span>Last: {fmtDate(auto.last_run)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', hc.badge)}>
                        <HealthIcon size={10} className="mr-1" />
                        {hc.label}
                      </Badge>
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', sc.badge)}>
                        {sc.label}
                      </Badge>
                      {auto.external_url && (
                        <a
                          href={auto.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-blue-600 transition-colors"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
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
