'use client';
import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';
import { Ticket } from '@/types';
import {
  Layers, Lightbulb, GitBranch, Star, CheckCircle2, Circle, Clock,
  MessageSquare, Database,
} from 'lucide-react';
import { AgentButton } from '@/components/agents/AgentButton';
import { agentConfigs } from '@/lib/agents/configs';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  'in-progress': { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: Clock },
  planned:       { label: 'Planned',     color: 'bg-amber-100 text-amber-700', icon: Circle },
  backlog:       { label: 'Backlog',     color: 'bg-muted text-muted-foreground', icon: Circle },
  done:          { label: 'Done',        color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
} as const;

const PLATFORM_LABELS: Record<string, string> = {
  n8n:    'n8n Automation Builds',
  make:   'Make.com Automation Builds',
  zapier: 'Zapier Automation Builds',
};

const PLATFORM_TAGS: Record<string, string> = {
  n8n:    'n8n',
  make:   'Make.com',
  zapier: 'Zapier',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface TemplateCounts {
  n8n: number;
  make: number;
  zapier: number;
}

interface DeploymentStats {
  total: number;
  success: number;
  failed: number;
}

interface FeedbackItem {
  id: string;
  company: string;
  summary: string;
  created_at: string;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProductPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [templateCounts, setTemplateCounts] = useState<TemplateCounts>({ n8n: 0, make: 0, zapier: 0 });
  const [deployStats, setDeployStats] = useState<DeploymentStats>({ total: 0, success: 0, failed: 0 });
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [deployLoading, setDeployLoading] = useState(true);

  useEffect(() => {
    async function loadTickets() {
      const { data } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });
      setTickets((data as Ticket[]) ?? []);
      setLoading(false);
    }

    async function loadTemplateCounts() {
      const [n8nRes, makeRes, zapierRes] = await Promise.all([
        supabase.from('templates').select('id', { count: 'exact', head: true }).eq('platform', 'n8n'),
        supabase.from('templates').select('id', { count: 'exact', head: true }).eq('platform', 'make'),
        supabase.from('templates').select('id', { count: 'exact', head: true }).eq('platform', 'zapier'),
      ]);
      setTemplateCounts({
        n8n:    n8nRes.count    ?? 0,
        make:   makeRes.count   ?? 0,
        zapier: zapierRes.count ?? 0,
      });
      setTemplateLoading(false);
    }

    async function loadDeployStats() {
      const { data } = await supabase.from('deployments').select('status');
      const all = (data ?? []) as Array<{ status: string }>;
      const success = all.filter(
        (d) => d.status === 'deployed' || d.status === 'manual_guide_generated'
      ).length;
      const failed = all.filter((d) => d.status === 'failed').length;
      setDeployStats({ total: all.length, success, failed });
      setDeployLoading(false);
    }

    // Pull AI summaries from recent tickets as client feedback patterns
    async function loadFeedback() {
      const { data } = await supabase
        .from('tickets')
        .select('id, company_name, ai_summary, created_at')
        .not('ai_summary', 'is', null)
        .neq('ai_summary', '')
        .order('created_at', { ascending: false })
        .limit(5);
      setFeedback(
        ((data ?? []) as Array<{
          id: string;
          company_name: string;
          ai_summary: string | null;
          created_at: string;
        }>)
          .filter((t) => !!t.ai_summary)
          .map((t) => ({
            id: t.id,
            company: t.company_name,
            summary: t.ai_summary as string,
            created_at: t.created_at,
          }))
      );
    }

    loadTickets();
    loadTemplateCounts();
    loadDeployStats();
    loadFeedback();
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────────

  const submitted = useMemo(
    () =>
      tickets.filter((t) =>
        ['SUBMITTED', 'ANALYZING', 'QUESTIONS_PENDING', 'CONTEXT_PENDING'].includes(t.status)
      ).length,
    [tickets]
  );

  const building = useMemo(
    () => tickets.filter((t) => t.status === 'BUILDING').length,
    [tickets]
  );

  const reviewPending = useMemo(
    () => tickets.filter((t) => t.status === 'REVIEW_PENDING').length,
    [tickets]
  );

  const deployed = useMemo(
    () => tickets.filter((t) => t.status === 'DEPLOYED').length,
    [tickets]
  );

  const sprintProgress =
    tickets.length > 0
      ? Math.round(((deployed + building) / tickets.length) * 100)
      : 0;

  // Group tickets by ticket_type — count = demand signal ("votes")
  const featureRequests = useMemo(() => {
    const groups: Record<string, number> = {};
    tickets.forEach((t) => {
      const key = t.ticket_type ?? 'other';
      groups[key] = (groups[key] ?? 0) + 1;
    });
    return Object.entries(groups)
      .map(([type, count]) => ({
        title:  PLATFORM_LABELS[type] ?? `${type} Builds`,
        votes:  count,
        tag:    PLATFORM_TAGS[type] ?? type,
        status: (count >= 5 ? 'in-progress' : count >= 3 ? 'planned' : 'backlog') as keyof typeof STATUS_CONFIG,
      }))
      .sort((a, b) => b.votes - a.votes);
  }, [tickets]);

  const deploySuccessRate =
    deployStats.total > 0
      ? Math.round((deployStats.success / deployStats.total) * 100)
      : null;

  const totalTemplates = templateCounts.n8n + templateCounts.make + templateCounts.zapier;

  const kpis = [
    {
      label: 'Pending Requests',
      value: loading ? '–' : submitted,
      icon:  Lightbulb,
      color: 'text-amber-600',
      bg:    'bg-amber-50',
      sub:   'Submitted & in queue',
    },
    {
      label: 'In Review',
      value: loading ? '–' : reviewPending,
      icon:  GitBranch,
      color: 'text-purple-600',
      bg:    'bg-purple-50',
      sub:   'Awaiting approval',
    },
    {
      label: 'Active Builds',
      value: loading ? '–' : building,
      icon:  Clock,
      color: 'text-blue-600',
      bg:    'bg-blue-50',
      sub:   `${sprintProgress}% sprint progress`,
    },
    {
      label: 'Deployed',
      value: loading ? '–' : deployed,
      icon:  CheckCircle2,
      color: 'text-emerald-600',
      bg:    'bg-emerald-50',
      sub:   `of ${loading ? '–' : tickets.length} total tickets`,
    },
  ];

  const health = [
    {
      label: 'Total Templates',
      value: templateLoading ? '–' : totalTemplates.toLocaleString(),
      ok: true,
    },
    {
      label: 'Builds Completed',
      value: loading ? '–' : deployed.toString(),
      ok: true,
    },
    {
      label: 'Deploy Success Rate',
      value: deployLoading
        ? '–'
        : deployStats.total === 0
        ? '—'
        : `${deploySuccessRate}%`,
      ok: deploySuccessRate === null || deploySuccessRate >= 80,
    },
    {
      label: 'n8n Templates',
      value: templateLoading ? '–' : templateCounts.n8n.toLocaleString(),
      ok: true,
    },
    {
      label: 'Make Templates',
      value: templateLoading ? '–' : templateCounts.make.toLocaleString(),
      ok: true,
    },
    {
      label: 'Review Pending',
      value: loading ? '–' : reviewPending.toString(),
      ok: reviewPending < 5,
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────

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
        {/* Feature Request Board — demand by platform, derived from real tickets */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Feature Request Board
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {loading ? (
              <div className="px-5 pb-4 space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : featureRequests.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No data yet
              </div>
            ) : (
              <div className="divide-y">
                {featureRequests.map((fr) => {
                  const cfg = STATUS_CONFIG[fr.status];
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
            )}
          </CardContent>
        </Card>

        {/* Platform health — real template counts + deployment stats */}
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
                  className={`rounded-xl border p-3 ${
                    ok ? 'border-emerald-100 bg-emerald-50/40' : 'border-amber-100 bg-amber-50/40'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        ok ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                      {label}
                    </span>
                  </div>
                  <div className="text-lg font-bold">{value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client feedback — AI summaries from real tickets */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare size={14} className="text-muted-foreground" />
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Client Feedback Patterns
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {feedback.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No client feedback yet
            </div>
          ) : (
            <div className="divide-y">
              {feedback.map((item) => (
                <div key={item.id} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold">{item.company}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{item.summary}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template library breakdown — real counts per platform */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-muted-foreground" />
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Template Library
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6 text-center">
            {(
              [
                { key: 'n8n',    label: 'n8n'      },
                { key: 'make',   label: 'Make.com'  },
                { key: 'zapier', label: 'Zapier'    },
              ] as const
            ).map(({ key, label }) => (
              <div key={key}>
                <div className="text-3xl font-bold">
                  {templateLoading ? '–' : templateCounts[key].toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{label}</div>
                <div className="text-[10px] text-muted-foreground">templates</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AgentButton config={agentConfigs.product} />
    </div>
  );
}
