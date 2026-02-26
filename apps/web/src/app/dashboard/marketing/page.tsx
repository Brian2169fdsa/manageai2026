'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';
import { Ticket } from '@/types';
import {
  Megaphone, FileText, Users, TrendingUp, BarChart3, Calendar, Activity,
} from 'lucide-react';
import { AgentButton } from '@/components/agents/AgentButton';
import { agentConfigs } from '@/lib/agents/configs';

interface ActivityEvent {
  id: string;
  created_at: string;
  department?: string;
  agent_name?: string;
  event_type?: string;
  message?: string;
  content?: string;
}

interface DeploymentRecord {
  id: string;
  platform: string;
  status: string;
  created_at: string;
}

// Content calendar — driven by real activity_events
function ContentCalendar({ events, loading }: { events: ActivityEvent[]; loading: boolean }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const EVENT_COLORS = [
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
  ];

  const calendarEvents: Record<number, { label: string; color: string }> = {};
  events.forEach((ev, i) => {
    const d = new Date(ev.created_at);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!calendarEvents[day]) {
        const raw = ev.message ?? ev.event_type ?? 'Content event';
        calendarEvents[day] = {
          label: raw.length > 15 ? raw.slice(0, 14) + '…' : raw,
          color: EVENT_COLORS[i % EVENT_COLORS.length],
        };
      }
    }
  });

  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
  const hasEvents = Object.keys(calendarEvents).length > 0;

  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground mb-3">{monthName}</div>
      {loading ? (
        <div className="h-40 bg-muted animate-pulse rounded-lg" />
      ) : (
        <>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div key={d} className="text-[10px] font-semibold text-muted-foreground pb-1">{d}</div>
            ))}
            {weeks.map((w, wi) =>
              w.map((day, di) => (
                <div
                  key={`${wi}-${di}`}
                  className={`min-h-[44px] rounded-md p-0.5 text-[10px] border ${
                    day === now.getDate() ? 'border-blue-300 bg-blue-50' : 'border-transparent'
                  }`}
                >
                  {day !== null && (
                    <>
                      <div className={`font-medium mb-0.5 ${day === now.getDate() ? 'text-blue-700' : 'text-foreground'}`}>
                        {day}
                      </div>
                      {calendarEvents[day] && (
                        <div className={`rounded px-0.5 py-0.5 leading-tight text-[9px] font-medium truncate ${calendarEvents[day].color}`}>
                          {calendarEvents[day].label}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
          {!hasEvents && (
            <div className="mt-3 text-center text-xs text-muted-foreground">No content scheduled</div>
          )}
        </>
      )}
    </div>
  );
}

export default function MarketingPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [contentEvents, setContentEvents] = useState<ActivityEvent[]>([]);
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [marketingActionCount, setMarketingActionCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [deploymentsLoading, setDeploymentsLoading] = useState(true);

  useEffect(() => {
    // Tickets — completed builds = case study candidates
    supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTickets((data as Ticket[]) ?? []);
        setLoading(false);
      });

    // Activity events for content calendar + agent action count
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    Promise.all([
      supabase
        .from('activity_events')
        .select('id, created_at, department, agent_name, event_type, message, content')
        .or('department.eq.marketing,event_type.ilike.%content%')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('activity_events')
        .select('id', { count: 'exact', head: true })
        .eq('department', 'marketing')
        .gte('created_at', since30d),
    ]).then(([evRes, countRes]) => {
      setContentEvents((evRes.data as ActivityEvent[]) ?? []);
      setMarketingActionCount(countRes.count ?? 0);
      setEventsLoading(false);
    });

    // Deployments last 30 days — for ROI basis metrics
    supabase
      .from('deployments')
      .select('id, platform, status, created_at')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setDeployments((data as DeploymentRecord[]) ?? []);
        setDeploymentsLoading(false);
      });
  }, []);

  // Derived values
  const completedBuilds = tickets.filter((t) => ['DEPLOYED', 'CLOSED'].includes(t.status)).length;
  const newTickets30d = tickets.filter(
    (t) => new Date(t.created_at).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
  ).length;
  const successfulDeploys = deployments.filter(
    (d) => d.status === 'deployed' || d.status === 'manual_guide_generated'
  ).length;

  // Platform usage from tickets (real data replacing hardcoded template list)
  const platformTotals = (['n8n', 'make', 'zapier'] as const)
    .map((p) => ({
      name: p === 'n8n' ? 'n8n Workflows' : p === 'make' ? 'Make.com Scenarios' : 'Zapier Zaps',
      uses: tickets.filter((t) => t.ticket_type === p).length,
      platform: p,
    }))
    .filter((p) => p.uses > 0)
    .sort((a, b) => b.uses - a.uses);

  const maxUses = Math.max(1, ...platformTotals.map((p) => p.uses));

  const kpis = [
    {
      label: 'Completed Builds',
      value: loading ? '–' : String(completedBuilds),
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      sub: 'Case study-ready',
    },
    {
      label: 'Social Reach',
      value: '—',
      icon: Users,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      sub: 'No data source yet',
    },
    {
      label: 'New Tickets (30d)',
      value: loading ? '–' : String(newTickets30d),
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      sub: 'Inbound this month',
    },
    {
      label: 'Agent Actions (30d)',
      value: eventsLoading ? '–' : String(marketingActionCount ?? 0),
      icon: BarChart3,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      sub: 'Marketing AI activity',
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone size={22} className="text-purple-500" />
            <h1 className="text-2xl font-bold">Marketing Dashboard</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Content, campaigns, and lead generation overview
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Content calendar — real activity_events */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-muted-foreground" />
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Content Calendar
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ContentCalendar events={contentEvents} loading={eventsLoading} />
          </CardContent>
        </Card>

        {/* Platform usage — real ticket counts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Platform Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-8 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : platformTotals.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">No data</div>
            ) : (
              <div className="space-y-3">
                {platformTotals.map((p, i) => {
                  const pct = Math.round((p.uses / maxUses) * 100);
                  return (
                    <div key={p.platform}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-muted-foreground">{p.uses} builds</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: `hsl(${214 - i * 20}, 84%, ${56 - i * 3}%)`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Deploy stats from deployments table */}
            {!deploymentsLoading && (
              <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-3">
                <div className="text-center p-3 rounded-xl bg-muted/30 border border-muted">
                  <div className="text-lg font-bold text-emerald-600">{successfulDeploys}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Successful deploys (30d)</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-muted/30 border border-muted">
                  <div className="text-lg font-bold">{deployments.length}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Deploy attempts (30d)</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Marketing agent activity feed */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-muted-foreground" />
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Marketing Agent Activity
              </CardTitle>
            </div>
            {!eventsLoading && contentEvents.length > 0 && (
              <span className="text-xs text-muted-foreground">{contentEvents.length} events</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {eventsLoading ? (
            <div className="px-5 pb-4 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : contentEvents.length === 0 ? (
            <div className="px-5 pb-8 text-center py-8 text-sm text-muted-foreground">
              No marketing agent activity yet — actions will appear here
            </div>
          ) : (
            <div className="divide-y">
              {contentEvents.slice(0, 8).map((ev) => {
                const msg = ev.message ?? ev.content ?? ev.event_type ?? 'Agent action';
                const ts = new Date(ev.created_at);
                const timeStr = ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return (
                  <div key={ev.id} className="flex items-start gap-3 px-5 py-3">
                    <div className="mt-1.5 w-2 h-2 rounded-full shrink-0 bg-amber-400" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-amber-600">
                        {(ev.agent_name ?? 'MARKETING AI').toUpperCase()}
                        {ev.event_type && (
                          <span className="ml-1.5 text-muted-foreground font-normal">
                            · {ev.event_type}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-foreground mt-0.5 line-clamp-2">{msg}</div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0 mt-0.5">{timeStr}</div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AgentButton config={agentConfigs.marketing} />
    </div>
  );
}
