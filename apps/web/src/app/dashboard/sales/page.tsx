'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';
import { Ticket } from '@/types';
import {
  TrendingUp, DollarSign, Users, Percent, Target, MoveRight, AlertCircle, Settings,
} from 'lucide-react';
import { AgentButton } from '@/components/agents/AgentButton';
import { agentConfigs } from '@/lib/agents/configs';

interface PipedriveDeal {
  id: number;
  title: string;
  status: string;
  value: number;
  currency: string;
  stage_id: number;
  stage_name: string;
  expected_close_date: string | null;
  person_name: string;
  org_name: string;
  owner_name: string;
  pipeline_id: number;
}

interface PipelineStage {
  id: number;
  name: string;
  order_nr?: number;
  order?: number;
  pipeline_id: number;
}

type KanbanColumn = {
  stage: PipelineStage;
  deals: PipedriveDeal[];
};

export default function SalesPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [deals, setDeals] = useState<PipedriveDeal[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })
        .then(({ data }) => setTickets((data as Ticket[]) ?? [])),

      fetch('/api/pipedrive/pipeline')
        .then((r) => r.json())
        .then((data) => {
          setStages(data.stages ?? []);
          setDemoMode(!!data.demo_mode);
        })
        .catch(() => {}),

      fetch('/api/pipedrive/deals?status=open')
        .then((r) => r.json())
        .then((data) => setDeals(data.deals ?? []))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const openDeals = deals.filter((d) => d.status === 'open');
  const wonDeals = deals.filter((d) => d.status === 'won');
  const lostDeals = deals.filter((d) => d.status === 'lost');

  const pipelineValue = openDeals.reduce((sum, d) => sum + Number(d.value ?? 0), 0);
  const wonValue = wonDeals.reduce((sum, d) => sum + Number(d.value ?? 0), 0);
  const winRate = wonDeals.length + lostDeals.length > 0
    ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100)
    : 0;
  const avgDealSize = wonDeals.length > 0 ? Math.round(wonValue / wonDeals.length) : 0;

  const thisMonth = new Date(); thisMonth.setDate(1);
  const newLeads = openDeals.length > 0
    ? openDeals.length
    : tickets.filter((t) => t.status === 'SUBMITTED' && new Date(t.created_at) >= thisMonth).length;

  const kpis = [
    {
      label: 'Pipeline Value',
      value: loading ? '–' : pipelineValue > 0 ? `$${(pipelineValue / 1000).toFixed(0)}k` : '–',
      icon: DollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      sub: `${openDeals.length} open deals`,
    },
    {
      label: 'New Leads',
      value: loading ? '–' : newLeads,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      sub: 'Active opportunities',
    },
    {
      label: 'Win Rate',
      value: loading ? '–' : wonDeals.length + lostDeals.length > 0 ? `${winRate}%` : '–',
      icon: Percent,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      sub: `${wonDeals.length} closed won`,
    },
    {
      label: 'Avg Deal Size',
      value: loading ? '–' : avgDealSize > 0 ? `$${avgDealSize.toLocaleString()}` : '–',
      icon: Target,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      sub: 'Per closed deal',
    },
  ];

  // ── Kanban: group Pipedrive deals by stage ────────────────────────────────
  const activeStages = stages.length > 0 ? stages : FALLBACK_STAGES;
  const kanbanCols: KanbanColumn[] = activeStages
    .slice()
    .sort((a, b) => (a.order_nr ?? a.order ?? 0) - (b.order_nr ?? b.order ?? 0))
    .map((stage) => ({
      stage,
      deals: openDeals.filter((d) => d.stage_id === stage.id),
    }));

  const palette = [
    { border: 'border-slate-200', dot: 'bg-slate-400' },
    { border: 'border-blue-200', dot: 'bg-blue-500' },
    { border: 'border-amber-200', dot: 'bg-amber-500' },
    { border: 'border-violet-200', dot: 'bg-violet-500' },
    { border: 'border-emerald-200', dot: 'bg-emerald-500' },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp size={22} className="text-blue-500" />
            <h1 className="text-2xl font-bold">Sales Dashboard</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Live Pipedrive pipeline, opportunities, and deal tracking
          </p>
        </div>
      </div>

      {/* Demo mode banner */}
      {demoMode && !loading && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertCircle size={16} className="shrink-0 text-amber-600" />
          <span>Showing sample data — connect Pipedrive to see real deal data.</span>
          <a
            href="/dashboard/settings/deploy"
            className="ml-auto flex items-center gap-1 text-amber-700 font-semibold hover:underline whitespace-nowrap"
          >
            <Settings size={13} /> Settings
          </a>
        </div>
      )}

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

      {/* Kanban pipeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Live Pipeline {demoMode ? '(Sample Data)' : '· Pipedrive'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: `repeat(${Math.min(kanbanCols.length, 5)}, minmax(0, 1fr))`,
              }}
            >
              {kanbanCols.map((col, i) => {
                const colors = palette[i % palette.length];
                return (
                  <div key={col.stage.id} className={`rounded-xl border-2 ${colors.border} bg-muted/20 p-3`}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} />
                      <span className="text-xs font-semibold uppercase tracking-wide truncate">
                        {col.stage.name}
                      </span>
                      <span className="ml-auto text-xs font-bold text-muted-foreground shrink-0">
                        {col.deals.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {col.deals.slice(0, 5).map((deal) => (
                        <div
                          key={deal.id}
                          className="bg-white rounded-lg border border-muted p-2.5 text-xs shadow-sm"
                        >
                          <div className="font-medium truncate">{deal.title}</div>
                          <div className="text-muted-foreground mt-0.5 truncate">
                            {deal.org_name || deal.person_name || '—'}
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            {deal.expected_close_date && (
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(deal.expected_close_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            )}
                            {deal.value > 0 && (
                              <span className="text-[10px] font-semibold text-blue-600 ml-auto">
                                ${Number(deal.value).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {col.deals.length === 0 && (
                        <div className="py-4 text-center text-[11px] text-muted-foreground">
                          Empty
                        </div>
                      )}
                      {col.deals.length > 5 && (
                        <div className="text-center text-[10px] text-muted-foreground pt-1">
                          +{col.deals.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pipeline flow indicator */}
          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground flex-wrap">
            {kanbanCols.map((col, i) => (
              <span key={col.stage.id} className="flex items-center gap-2">
                {i > 0 && <MoveRight size={12} />}
                <span className={i === kanbanCols.length - 1 ? 'text-emerald-600 font-medium' : ''}>
                  {col.stage.name}
                </span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <AgentButton config={agentConfigs.sales} />
    </div>
  );
}

// Fallback stage structure when Pipedrive not connected
const FALLBACK_STAGES: PipelineStage[] = [
  { id: 1, name: 'Lead', order_nr: 1, pipeline_id: 1 },
  { id: 2, name: 'Qualified', order_nr: 2, pipeline_id: 1 },
  { id: 3, name: 'Proposal', order_nr: 3, pipeline_id: 1 },
  { id: 4, name: 'Negotiation', order_nr: 4, pipeline_id: 1 },
  { id: 5, name: 'Closed Won', order_nr: 5, pipeline_id: 1 },
];
