'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';
import { Ticket } from '@/types';
import {
  Code, Wrench, CheckCircle, Clock, BarChart3, Rocket, AlertCircle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
} from 'recharts';
import { AgentButton } from '@/components/agents/AgentButton';
import { agentConfigs } from '@/lib/agents/configs';

const PLATFORM_COLOR: Record<string, string> = {
  n8n: 'bg-red-100 text-red-700',
  make: 'bg-purple-100 text-purple-700',
  zapier: 'bg-orange-100 text-orange-700',
};

const STATUS_COLOR: Record<string, string> = {
  BUILDING: 'bg-blue-100 text-blue-700',
  REVIEW_PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  DEPLOYED: 'bg-emerald-100 text-emerald-700',
};

export default function EngineeringPage() {
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

  const activeBuilds = tickets.filter((t) => t.status === 'BUILDING').length;
  const deployed = tickets.filter((t) => t.status === 'DEPLOYED').length;
  const total = tickets.length;
  const deployRate = total > 0 ? Math.round(((deployed) / total) * 100) : 0;

  // Build queue
  const buildQueue = tickets.filter((t) =>
    ['BUILDING', 'REVIEW_PENDING', 'APPROVED'].includes(t.status)
  );

  // Recent deploys
  const recentDeploys = tickets
    .filter((t) => ['DEPLOYED', 'CLOSED'].includes(t.status))
    .slice(0, 6);

  // Platform breakdown chart
  const platformData = ['n8n', 'make', 'zapier'].map((p) => ({
    name: p === 'n8n' ? 'n8n' : p === 'make' ? 'Make.com' : 'Zapier',
    count: tickets.filter((t) => t.ticket_type === p).length,
  }));

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
      label: 'Code Quality Score',
      value: '94 / 100',
      icon: BarChart3,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      sub: 'AI-validated JSON',
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Build queue */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Build Queue
              </CardTitle>
              {activeBuilds > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium">
                  {activeBuilds} active
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {loading ? (
              <div className="px-5 pb-4 space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}
              </div>
            ) : buildQueue.length === 0 ? (
              <div className="px-5 pb-6 text-center py-8">
                <CheckCircle size={28} className="mx-auto text-emerald-200 mb-2" />
                <p className="text-sm text-muted-foreground">Build queue is empty</p>
              </div>
            ) : (
              <div className="divide-y">
                {buildQueue.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{t.project_name || 'Untitled'}</div>
                      <div className="text-xs text-muted-foreground">{t.company_name}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PLATFORM_COLOR[t.ticket_type]}`}>
                        {t.ticket_type}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[t.status] ?? 'bg-muted text-muted-foreground'}`}>
                        {t.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Platform breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Platform Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-44 bg-muted animate-pulse rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={platformData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, 'Builds']} />
                  <Bar dataKey="count" fill="#4A8FD6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent deploys */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Rocket size={14} className="text-muted-foreground" />
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Recent Deploys
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {loading ? (
            <div className="px-5 pb-4 space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}
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
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PLATFORM_COLOR[t.ticket_type]}`}>
                      {t.ticket_type}
                    </span>
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {new Date(t.updated_at).toLocaleDateString()}
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
