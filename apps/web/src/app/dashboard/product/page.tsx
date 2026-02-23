'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';
import { Ticket } from '@/types';
import {
  Layers, Lightbulb, Bug, GitBranch, Star, CheckCircle2, Circle, Clock,
} from 'lucide-react';
import { AgentButton } from '@/components/agents/AgentButton';
import { agentConfigs } from '@/lib/agents/configs';

const FEATURE_REQUESTS = [
  { title: 'Slack integration for ticket updates', votes: 14, status: 'planned', tag: 'Integration' },
  { title: 'Bulk ticket import via CSV', votes: 11, status: 'in-progress', tag: 'Import/Export' },
  { title: 'Client portal with read-only view', votes: 9, status: 'planned', tag: 'Client' },
  { title: 'Zapier output support', votes: 8, status: 'backlog', tag: 'Platform' },
  { title: 'Webhook delivery notifications', votes: 6, status: 'backlog', tag: 'Notifications' },
];

const STATUS_CONFIG = {
  'in-progress': { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: Clock },
  planned: { label: 'Planned', color: 'bg-amber-100 text-amber-700', icon: Circle },
  backlog: { label: 'Backlog', color: 'bg-muted text-muted-foreground', icon: Circle },
  done: { label: 'Done', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
};

export default function ProductPage() {
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

  const building = tickets.filter((t) => t.status === 'BUILDING').length;
  const reviewPending = tickets.filter((t) => t.status === 'REVIEW_PENDING').length;
  const deployed = tickets.filter((t) => t.status === 'DEPLOYED').length;

  const kpis = [
    {
      label: 'Feature Requests',
      value: FEATURE_REQUESTS.length,
      icon: Lightbulb,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      sub: '2 in progress',
    },
    {
      label: 'Bugs Filed',
      value: 3,
      icon: Bug,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      sub: '1 critical',
    },
    {
      label: 'Sprint Progress',
      value: loading ? '–' : `${Math.min(deployed + building, 99)}%`,
      icon: GitBranch,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      sub: `${building} active builds`,
    },
    {
      label: 'Customer Feedback',
      value: '4.7 / 5',
      icon: Star,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      sub: 'Based on 18 reviews',
    },
  ];

  // Platform health
  const health = [
    { label: 'Uptime', value: '99.9%', ok: true },
    { label: 'Builds completed', value: loading ? '–' : String(deployed), ok: true },
    { label: 'Avg analysis time', value: '~18s', ok: true },
    { label: 'Error rate', value: '0.8%', ok: true },
    { label: 'AI accuracy', value: '94%', ok: true },
    { label: 'Review pending', value: loading ? '–' : String(reviewPending), ok: reviewPending < 5 },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Layers size={22} className="text-indigo-500" />
            <h1 className="text-2xl font-bold">Product Dashboard</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Feature roadmap, platform health, and customer feedback
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
        {/* Feature requests */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Feature Request Board
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="divide-y">
              {FEATURE_REQUESTS.map((fr) => {
                const cfg = STATUS_CONFIG[fr.status as keyof typeof STATUS_CONFIG];
                return (
                  <div key={fr.title} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{fr.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-medium">
                          {fr.tag}
                        </span>
                        <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Star size={12} className="text-amber-400" />
                      <span className="text-xs font-semibold">{fr.votes}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Platform health */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Platform Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {health.map(({ label, value, ok }) => (
                <div
                  key={label}
                  className={`rounded-xl border p-3 ${ok ? 'border-emerald-100 bg-emerald-50/40' : 'border-amber-100 bg-amber-50/40'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
                  </div>
                  <div className="text-lg font-bold">{loading && label !== 'Uptime' && label !== 'Avg analysis time' && label !== 'Error rate' && label !== 'AI accuracy' ? '–' : value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <AgentButton config={agentConfigs.product} />
    </div>
  );
}
