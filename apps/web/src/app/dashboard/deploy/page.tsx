'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { Ticket } from '@/types';
import {
  Rocket, CheckCircle, XCircle, Clock, Package,
  ExternalLink, Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const PLATFORM_COLOR: Record<string, string> = {
  n8n: 'bg-red-100 text-red-700',
  make: 'bg-purple-100 text-purple-700',
  zapier: 'bg-orange-100 text-orange-700',
};

interface DeploymentRecord {
  id: string;
  ticket_id: string;
  platform: string;
  status: string;
  external_url?: string;
  created_at: string;
  // joined
  company_name?: string;
  project_name?: string;
}

export default function DeployPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploymentRecords, setDeploymentRecords] = useState<DeploymentRecord[]>([]);

  useEffect(() => {
    supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTickets((data as Ticket[]) ?? []);
        setLoading(false);
      });

    // Also fetch actual deployment records from deployments table
    supabase
      .from('deployments')
      .select('id, ticket_id, platform, status, external_url, created_at')
      .order('created_at', { ascending: false })
      .limit(25)
      .then(async ({ data }) => {
        if (data && data.length > 0) {
          const ticketIds = [...new Set(data.map((d) => d.ticket_id))];
          const { data: ticketData } = await supabase
            .from('tickets')
            .select('id, company_name, project_name')
            .in('id', ticketIds);
          const ticketMap = new Map((ticketData ?? []).map((t) => [t.id, t]));
          setDeploymentRecords(
            data.map((d) => ({
              ...d,
              company_name: ticketMap.get(d.ticket_id)?.company_name ?? 'Unknown',
              project_name: ticketMap.get(d.ticket_id)?.project_name ?? 'Untitled',
            }))
          );
        }
      });
  }, []);

  const readyToDeploy = tickets.filter((t) => t.status === 'APPROVED');
  const deployed = tickets.filter((t) => t.status === 'DEPLOYED');
  const total = tickets.length;

  const deployedToday = deployed.filter((t) => {
    const d = new Date(t.updated_at);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
  });

  // Success rate: use actual deployment records when available
  const deploySuccessCount = deploymentRecords.filter(
    (d) => d.status === 'deployed' || d.status === 'success'
  ).length;
  const deployFailCount = deploymentRecords.filter((d) => d.status === 'failed').length;
  const successRate = loading
    ? '–'
    : deploymentRecords.length > 0
    ? `${Math.round((deploySuccessCount / deploymentRecords.length) * 100)}%`
    : deployed.length > 0
    ? `${Math.round((deployed.length / Math.max(total, 1)) * 100)}%`
    : '—';

  const kpis = [
    {
      label: 'Ready to Deploy',
      value: loading ? '–' : readyToDeploy.length,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      sub: 'Awaiting deployment',
    },
    {
      label: 'Deployed Today',
      value: loading ? '–' : deployedToday.length,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      sub: 'Live in production',
    },
    {
      label: 'Total Deployed',
      value: loading ? '–' : deploymentRecords.length > 0 ? deploymentRecords.length : deployed.length,
      icon: Rocket,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      sub: 'All time',
    },
    {
      label: 'Success Rate',
      value: successRate,
      icon: Package,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      sub: deploymentRecords.length > 0 ? `${deployFailCount} failed` : 'Based on ticket status',
    },
  ];

  // Platform breakdown for deploys
  const platformBreakdown = ['n8n', 'make', 'zapier'].map((p) => ({
    name: p,
    deployed: deployed.filter((t) => t.ticket_type === p).length,
    ready: readyToDeploy.filter((t) => t.ticket_type === p).length,
  }));

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Rocket size={22} className="text-blue-500" />
            <h1 className="text-2xl font-bold">Deploy</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Manage deployments and track live automations
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, bg, border, sub }) => (
          <Card key={label} className={`border ${border}`}>
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

      {/* Deploy queue */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Deploy Queue
            </CardTitle>
            {readyToDeploy.length > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-medium">
                {readyToDeploy.length} ready
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {loading ? (
            <div className="px-5 pb-4 space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse rounded" />)}
            </div>
          ) : readyToDeploy.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <CheckCircle size={32} className="mx-auto text-emerald-200 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Queue is empty</p>
              <p className="text-xs text-muted-foreground mt-1">No tickets are approved and waiting to deploy</p>
            </div>
          ) : (
            <div className="divide-y">
              {readyToDeploy.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{t.project_name || 'Untitled'}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${PLATFORM_COLOR[t.ticket_type]}`}>
                        {t.ticket_type}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t.company_name} · {t.contact_name}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {new Date(t.updated_at).toLocaleDateString()}
                    </span>
                    <Link href={`/dashboard/tickets/${t.id}`}>
                      <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
                        <ExternalLink size={11} /> View
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      className="gap-1 h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                      disabled
                      title="One-click deploy coming soon"
                    >
                      <Rocket size={11} /> Deploy
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Platform breakdown + One-click Deploy placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Platform Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {platformBreakdown.map(({ name, deployed: dep, ready }) => (
                <div key={name}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${PLATFORM_COLOR[name]}`}>{name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{ready} ready</span>
                      <span className="font-semibold">{dep} deployed</span>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 relative">
                    <div
                      className="h-2 rounded-full bg-blue-400"
                      style={{ width: `${dep + ready > 0 ? Math.round((dep / Math.max(dep + ready, 1)) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* One-click deploy placeholder */}
        <Card className="border-blue-100 bg-gradient-to-br from-blue-50/50 to-white">
          <CardContent className="pt-5 pb-5 px-5 h-full flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Rocket size={16} className="text-blue-600" />
              </div>
              <span className="font-semibold text-sm">One-Click Deploy</span>
              <Badge variant="outline" className="text-[9px] ml-auto border-blue-200 text-blue-600">
                <Sparkles size={8} className="mr-1" /> Coming Soon
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Deploy directly to your n8n instance, Make.com account, or Zapier — without leaving ManageAI.
              One click to push workflow JSON live.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {['n8n', 'Make.com', 'Zapier'].map((p) => (
                <div key={p} className="text-center rounded-lg border border-blue-100 bg-white py-2 px-1">
                  <div className="text-xs font-semibold text-blue-700">{p}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">API push</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deployment history */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Deployment History
            </CardTitle>
            {deploymentRecords.length > 0 && (
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                from deployments table
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {loading ? (
            <div className="px-5 pb-4 space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}
            </div>
          ) : deploymentRecords.length > 0 ? (
            // Prefer actual deployment records (have external URLs, real status)
            <div className="divide-y">
              {deploymentRecords.map((d) => {
                const isSuccess = d.status === 'deployed' || d.status === 'success';
                const isFailed = d.status === 'failed';
                return (
                  <div key={d.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    {isFailed ? (
                      <XCircle size={14} className="text-red-500 shrink-0" />
                    ) : (
                      <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{d.project_name}</div>
                      <div className="text-xs text-muted-foreground">{d.company_name}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', PLATFORM_COLOR[d.platform] ?? 'bg-gray-100 text-gray-600')}>
                        {d.platform}
                      </span>
                      <span className={cn(
                        'text-[10px] rounded-full px-2 py-0.5 font-medium capitalize',
                        isFailed ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                      )}>
                        {d.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {new Date(d.created_at).toLocaleDateString()}
                      </span>
                      {d.external_url ? (
                        <a
                          href={d.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open in platform"
                        >
                          <ExternalLink size={13} className="text-muted-foreground hover:text-blue-600 transition-colors" />
                        </a>
                      ) : (
                        <Link href={`/dashboard/tickets/${d.ticket_id}`}>
                          <ExternalLink size={13} className="text-muted-foreground hover:text-blue-600 transition-colors" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : deployed.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground">No deployments yet</p>
            </div>
          ) : (
            // Fallback: tickets with DEPLOYED status
            <div className="divide-y">
              {deployed.map((t) => (
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
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-medium">
                      Deployed
                    </span>
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {new Date(t.updated_at).toLocaleDateString()}
                    </span>
                    <Link href={`/dashboard/tickets/${t.id}`}>
                      <ExternalLink size={13} className="text-muted-foreground hover:text-blue-600 transition-colors" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
