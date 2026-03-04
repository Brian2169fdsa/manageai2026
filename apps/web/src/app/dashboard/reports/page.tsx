'use client';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { ClientReport } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AgentButton } from '@/components/agents/AgentButton';
import { agentConfigs } from '@/lib/agents/configs';
import {
  Search,
  FileText,
  Calendar,
  Send,
  Clock,
  Eye,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_CONFIG: Record<string, { label: string; badge: string; icon: typeof FileText }> = {
  monthly: { label: 'Monthly', badge: 'bg-blue-100 text-blue-700', icon: Calendar },
  quarterly: { label: 'Quarterly', badge: 'bg-purple-100 text-purple-700', icon: BarChart3 },
  incident: { label: 'Incident', badge: 'bg-red-100 text-red-700', icon: AlertTriangle },
};

export default function ReportsPage() {
  const [reports, setReports] = useState<ClientReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: raw, error } = await supabase
        .from('client_reports')
        .select('*, client_accounts(company_name)')
        .order('created_at', { ascending: false });

      if (error) {
        const isMissing =
          error.message?.includes('does not exist') ||
          error.code === 'PGRST116' ||
          (error as { code?: string }).code === '42P01';
        if (isMissing) setTableMissing(true);
        setReports([]);
      } else {
        setReports(
          (raw ?? []).map((r) => ({
            ...r,
            company_name:
              (r.client_accounts as { company_name?: string } | null)?.company_name ?? 'Unknown',
          }))
        );
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      const matchesSearch =
        !search || (r.company_name ?? '').toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'all' || r.report_type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [reports, search, typeFilter]);

  const stats = useMemo(() => {
    const total = reports.length;
    const sent = reports.filter((r) => r.sent_at).length;
    const draft = reports.filter((r) => !r.sent_at).length;
    return { total, sent, draft };
  }, [reports]);

  const previewReport = previewId ? reports.find((r) => r.id === previewId) : null;

  function fmtDate(d: unknown): string {
    if (!d) return '—';
    try {
      return new Date(String(d)).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Client Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monthly, quarterly, and incident reports for all clients
        </p>
      </div>

      {tableMissing && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle size={14} className="inline mr-2" />
          The <code className="font-mono text-xs bg-amber-100 px-1 rounded">client_reports</code> table
          has not been created yet. Run{' '}
          <code className="font-mono text-xs bg-amber-100 px-1 rounded">scripts/migrate-new-tables.sql</code>.
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mb-1">
              <FileText size={13} /> Total Reports
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium mb-1">
              <Send size={13} /> Sent
            </div>
            <p className="text-2xl font-bold text-emerald-700">{stats.sent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-xs text-amber-600 font-medium mb-1">
              <Clock size={13} /> Drafts
            </div>
            <p className="text-2xl font-bold text-amber-700">{stats.draft}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by client…"
            className="pl-8 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
            <SelectItem value="incident">Incident</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Report list + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2 max-h-[520px] overflow-y-auto">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText size={32} className="mb-2 opacity-30" />
              <p className="text-sm font-medium">No reports yet</p>
              <p className="text-xs mt-1">Use the Delivery Agent to generate client reports</p>
            </div>
          ) : (
            filtered.map((report) => {
              const tc = TYPE_CONFIG[report.report_type] ?? TYPE_CONFIG.monthly;
              const TypeIcon = tc.icon;
              return (
                <button
                  key={report.id}
                  onClick={() => setPreviewId(report.id)}
                  className={cn(
                    'w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-all',
                    previewId === report.id
                      ? 'bg-blue-50 border-blue-200 shadow-sm'
                      : 'bg-white hover:shadow-sm'
                  )}
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <TypeIcon size={16} className="text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{report.company_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', tc.badge)}>
                        {tc.label}
                      </Badge>
                      <span>{fmtDate(report.created_at)}</span>
                      {report.sent_at && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-600">
                          Sent
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Eye size={14} className="text-muted-foreground shrink-0" />
                </button>
              );
            })
          )}
        </div>

        {/* Preview pane */}
        <Card className="min-h-[300px]">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Eye size={13} /> Report Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {previewReport?.content ? (
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: previewReport.content }}
              />
            ) : (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                Select a report to preview
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AgentButton config={agentConfigs.delivery} />
    </div>
  );
}
