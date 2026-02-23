'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';
import { Ticket } from '@/types';
import {
  Megaphone, FileText, Users, TrendingUp, BarChart3, Calendar,
} from 'lucide-react';
import { AgentButton } from '@/components/agents/AgentButton';
import { agentConfigs } from '@/lib/agents/configs';

// Simple calendar content for this month
function ContentCalendar() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const events: Record<number, { label: string; color: string }> = {
    3: { label: 'Blog: n8n Intro', color: 'bg-blue-100 text-blue-700' },
    7: { label: 'Social burst', color: 'bg-purple-100 text-purple-700' },
    10: { label: 'Case study', color: 'bg-emerald-100 text-emerald-700' },
    14: { label: 'Newsletter', color: 'bg-amber-100 text-amber-700' },
    18: { label: 'LinkedIn post', color: 'bg-blue-100 text-blue-700' },
    21: { label: 'Webinar promo', color: 'bg-rose-100 text-rose-700' },
    25: { label: 'Blog: ROI', color: 'bg-blue-100 text-blue-700' },
    28: { label: 'Monthly wrap', color: 'bg-emerald-100 text-emerald-700' },
  };

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

  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground mb-3">{monthName}</div>
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
                  {events[day] && (
                    <div className={`rounded px-0.5 py-0.5 leading-tight text-[9px] font-medium truncate ${events[day].color}`}>
                      {events[day].label}
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function MarketingPage() {
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

  const templateUsage = [
    { name: 'Lead Capture → CRM', uses: 24, trend: '+3' },
    { name: 'Email Sequence', uses: 18, trend: '+5' },
    { name: 'Slack Notifier', uses: 14, trend: '+1' },
    { name: 'Invoice Automation', uses: 11, trend: '0' },
    { name: 'Data Sync', uses: 9, trend: '+2' },
  ];

  const kpis = [
    {
      label: 'Content Published',
      value: '28',
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      sub: 'This month',
    },
    {
      label: 'Social Reach',
      value: '14.2k',
      icon: Users,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      sub: '+18% vs last month',
    },
    {
      label: 'Lead Gen',
      value: loading ? '–' : String(Math.max(tickets.length + 9, 9)),
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      sub: 'From content',
    },
    {
      label: 'Campaign ROI',
      value: '340%',
      icon: BarChart3,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      sub: 'Avg across campaigns',
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
        {/* Content calendar */}
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
            <ContentCalendar />
          </CardContent>
        </Card>

        {/* Template usage */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Top Templates Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {templateUsage.map((t, i) => {
                const pct = Math.round((t.uses / templateUsage[0].uses) * 100);
                return (
                  <div key={t.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{t.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{t.uses} uses</span>
                        <span className={`font-semibold ${t.trend !== '0' ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                          {t.trend !== '0' ? `↑${t.trend}` : '—'}
                        </span>
                      </div>
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
          </CardContent>
        </Card>
      </div>

      <AgentButton config={agentConfigs.marketing} />
    </div>
  );
}
