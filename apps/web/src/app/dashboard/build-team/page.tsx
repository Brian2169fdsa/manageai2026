'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { Ticket } from '@/types';
import {
  Bot, Sparkles, Cpu, Brain, GitBranch, Zap,
  CheckCircle, Clock, ArrowUpRight,
} from 'lucide-react';

const AGENTS = [
  {
    name: 'Analysis Agent',
    description: 'Reads submitted tickets, extracts requirements, asks clarifying questions.',
    icon: Brain,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    status: 'active',
    model: 'claude-sonnet-4-6',
    triggered: 'On ticket submit',
  },
  {
    name: 'Build Agent',
    description: 'Generates build plan, solution demo HTML, and workflow JSON using n8n-MCP.',
    icon: Cpu,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-100',
    status: 'active',
    model: 'claude-sonnet-4-6',
    triggered: 'On user confirmation',
  },
  {
    name: 'Template Agent',
    description: 'Matches new tickets to existing templates to accelerate builds.',
    icon: GitBranch,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
    status: 'active',
    model: 'Template DB lookup',
    triggered: 'During build phase',
  },
  {
    name: 'Deploy Agent',
    description: 'One-click deploy to n8n, Make.com, or Zapier via platform APIs.',
    icon: Zap,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    status: 'coming-soon',
    model: 'Platform APIs',
    triggered: 'On approval',
  },
  {
    name: 'QA Agent',
    description: 'Reviews workflow JSON for errors, validates nodes, suggests improvements.',
    icon: CheckCircle,
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-100',
    status: 'coming-soon',
    model: 'claude-sonnet-4-6',
    triggered: 'Post-build',
  },
  {
    name: 'Client Agent',
    description: 'Sends automated updates to clients, answers questions via email.',
    icon: Bot,
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    status: 'coming-soon',
    model: 'claude-sonnet-4-6',
    triggered: 'On status change',
  },
];

export default function BuildTeamPage() {
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

  const analyzed = tickets.filter((t) =>
    ['QUESTIONS_PENDING', 'BUILDING', 'REVIEW_PENDING', 'APPROVED', 'DEPLOYED', 'CLOSED'].includes(t.status)
  ).length;
  const built = tickets.filter((t) => ['REVIEW_PENDING', 'APPROVED', 'DEPLOYED', 'CLOSED'].includes(t.status)).length;

  const activeAgents = AGENTS.filter((a) => a.status === 'active').length;

  // Avg build time: mean of (updated_at - created_at) for completed tickets
  const avgBuildTimeDays = (() => {
    const completed = tickets.filter((t) =>
      ['APPROVED', 'DEPLOYED', 'CLOSED'].includes(t.status)
    );
    if (completed.length === 0) return null;
    const totalDays = completed.reduce((sum, t) => {
      const ms = new Date(t.updated_at).getTime() - new Date(t.created_at).getTime();
      return sum + ms / 86400000;
    }, 0);
    return (totalDays / completed.length).toFixed(1);
  })();

  const stats = [
    { label: 'Tickets analyzed', value: loading ? '–' : analyzed, icon: Brain, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Builds generated', value: loading ? '–' : built, icon: Cpu, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Active agents', value: activeAgents, icon: Bot, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Avg build time', value: loading ? '–' : avgBuildTimeDays !== null ? `${avgBuildTimeDays}d` : 'N/A', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Bot size={22} className="text-blue-500" />
            <h1 className="text-2xl font-bold">Build Team</h1>
            <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-600 bg-blue-50 ml-1">
              <Sparkles size={9} className="mr-1" /> AI-Powered
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Your autonomous AI agents — always on, always building
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
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

      {/* Agent cards */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">AI Agent Roster</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {AGENTS.map((agent) => {
            const Icon = agent.icon;
            return (
              <Card key={agent.name} className={`border ${agent.border}`}>
                <CardContent className="pt-5 pb-5 px-5">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl ${agent.bg} shrink-0`}>
                      <Icon size={18} className={agent.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{agent.name}</span>
                        {agent.status === 'active' ? (
                          <span className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-medium">
                            <span className="w-1 h-1 rounded-full bg-emerald-500 inline-block" />
                            Live
                          </span>
                        ) : (
                          <Badge variant="outline" className="text-[9px] border-muted text-muted-foreground">
                            Coming Soon
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{agent.description}</p>
                      <div className="flex gap-3 mt-2.5">
                        <div className="text-[10px] text-muted-foreground">
                          <span className="font-medium text-foreground">Model:</span> {agent.model}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          <span className="font-medium text-foreground">Trigger:</span> {agent.triggered}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent agent activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Recent Agent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {loading ? (
            <div className="px-5 pb-4 space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-muted animate-pulse rounded" />)}
            </div>
          ) : tickets.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">No activity yet</div>
          ) : (
            <div className="divide-y">
              {[...tickets].slice(0, 10).map((t) => {
                const agentName =
                  ['ANALYZING', 'QUESTIONS_PENDING'].includes(t.status) ? 'Analysis Agent' :
                  ['BUILDING', 'REVIEW_PENDING'].includes(t.status) ? 'Build Agent' :
                  t.status === 'SUBMITTED' ? 'System' :
                  t.status === 'DEPLOYED' ? 'Deploy Agent' : 'Template Agent';
                const action =
                  t.status === 'SUBMITTED' ? 'Ticket received' :
                  t.status === 'ANALYZING' ? 'Running analysis' :
                  t.status === 'QUESTIONS_PENDING' ? 'Questions generated' :
                  t.status === 'BUILDING' ? 'Build in progress' :
                  t.status === 'REVIEW_PENDING' ? 'Artifacts ready' :
                  t.status === 'APPROVED' ? 'Approved, awaiting deploy' :
                  t.status === 'DEPLOYED' ? 'Deployed successfully' : 'Closed';
                return (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-xs">
                    <Bot size={12} className="text-blue-400 shrink-0" />
                    <span className="font-medium text-blue-700 shrink-0">{agentName}</span>
                    <ArrowUpRight size={10} className="text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{action}</span>
                    <span className="text-muted-foreground truncate">· {t.project_name || 'Untitled'}</span>
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
