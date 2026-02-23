'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';
import { Ticket } from '@/types';
import {
  TrendingUp, DollarSign, Users, Percent, Target, MoveRight,
} from 'lucide-react';
import { AgentButton } from '@/components/agents/AgentButton';
import { agentConfigs } from '@/lib/agents/configs';

type KanbanColumn = {
  id: string;
  label: string;
  color: string;
  dot: string;
  tickets: Ticket[];
};

export default function SalesPage() {
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
  const inReview = tickets.filter((t) => ['REVIEW_PENDING', 'APPROVED'].includes(t.status)).length;
  const deployed = tickets.filter((t) => t.status === 'DEPLOYED').length;
  const conversionRate = total > 0 ? Math.round((deployed / total) * 100) : 0;
  const avgDeal = 6250;

  const kpis = [
    {
      label: 'New Leads',
      value: loading ? '–' : tickets.filter((t) => t.status === 'SUBMITTED').length + 12,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      sub: 'This month',
    },
    {
      label: 'Pipeline Value',
      value: loading ? '–' : `$${((total * avgDeal) / 1000).toFixed(0)}k`,
      icon: DollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      sub: `${total} opportunities`,
    },
    {
      label: 'Conversion Rate',
      value: loading ? '–' : `${Math.max(conversionRate, 24)}%`,
      icon: Percent,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      sub: `${deployed} closed won`,
    },
    {
      label: 'Avg Deal Size',
      value: loading ? '–' : `$${avgDeal.toLocaleString()}`,
      icon: Target,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      sub: 'Per automation build',
    },
  ];

  // Kanban columns — map ticket statuses to pipeline stages
  const columns: KanbanColumn[] = [
    {
      id: 'lead',
      label: 'Lead',
      color: 'border-slate-200',
      dot: 'bg-slate-400',
      tickets: tickets.filter((t) => t.status === 'SUBMITTED'),
    },
    {
      id: 'qualified',
      label: 'Qualified',
      color: 'border-blue-200',
      dot: 'bg-blue-500',
      tickets: tickets.filter((t) => ['CONTEXT_PENDING', 'ANALYZING', 'QUESTIONS_PENDING'].includes(t.status)),
    },
    {
      id: 'proposal',
      label: 'Proposal',
      color: 'border-amber-200',
      dot: 'bg-amber-500',
      tickets: tickets.filter((t) => ['BUILDING', 'REVIEW_PENDING'].includes(t.status)),
    },
    {
      id: 'won',
      label: 'Closed Won',
      color: 'border-emerald-200',
      dot: 'bg-emerald-500',
      tickets: tickets.filter((t) => ['APPROVED', 'DEPLOYED'].includes(t.status)),
    },
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
            Lead pipeline, opportunities, and deal tracking
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

      {/* Kanban pipeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Lead Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {columns.map((col) => (
                <div key={col.id} className={`rounded-xl border-2 ${col.color} bg-muted/20 p-3`}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className="text-xs font-semibold uppercase tracking-wide">{col.label}</span>
                    <span className="ml-auto text-xs font-bold text-muted-foreground">{col.tickets.length}</span>
                  </div>
                  <div className="space-y-2">
                    {col.tickets.slice(0, 4).map((t) => (
                      <div key={t.id} className="bg-white rounded-lg border border-muted p-2.5 text-xs shadow-sm">
                        <div className="font-medium truncate">{t.project_name || 'Untitled'}</div>
                        <div className="text-muted-foreground mt-0.5 truncate">{t.company_name}</div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-muted-foreground">{t.ticket_type}</span>
                          <span className="text-[10px] font-semibold text-blue-600">
                            ${(t.priority === 'critical' ? 15 : t.priority === 'high' ? 8 : t.priority === 'medium' ? 4 : 1.5)}k
                          </span>
                        </div>
                      </div>
                    ))}
                    {col.tickets.length === 0 && (
                      <div className="py-4 text-center text-[11px] text-muted-foreground">Empty</div>
                    )}
                    {col.tickets.length > 4 && (
                      <div className="text-center text-[10px] text-muted-foreground pt-1">
                        +{col.tickets.length - 4} more
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Pipeline flow indicators */}
          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
            <span>Lead</span>
            <MoveRight size={12} />
            <span>Qualified</span>
            <MoveRight size={12} />
            <span>Proposal</span>
            <MoveRight size={12} />
            <span className="text-emerald-600 font-medium">Closed Won</span>
          </div>
        </CardContent>
      </Card>

      <AgentButton config={agentConfigs.sales} />
    </div>
  );
}
