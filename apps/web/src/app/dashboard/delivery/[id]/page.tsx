'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Ticket, TicketArtifact, TicketAsset, AIQuestion } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Building2,
  User,
  Mail,
  Calendar,
  Tag,
  Cpu,
  Download,
  Eye,
  FileText,
  Link2,
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  Package,
  MessageSquare,
  Clock,
  Save,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Status configuration ─────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'ANALYZING', label: 'Analyzing' },
  { key: 'QUESTIONS_PENDING', label: 'Questions' },
  { key: 'BUILDING', label: 'Building' },
  { key: 'REVIEW_PENDING', label: 'Review' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'DEPLOYED', label: 'Delivered' },
];

const STATUS_ORDER = [
  'SUBMITTED',
  'CONTEXT_PENDING',
  'ANALYZING',
  'QUESTIONS_PENDING',
  'BUILDING',
  'REVIEW_PENDING',
  'APPROVED',
  'DEPLOYED',
  'CLOSED',
];

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  SUBMITTED: { label: 'Submitted', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  CONTEXT_PENDING: { label: 'Context Pending', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  ANALYZING: { label: 'Analyzing', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  QUESTIONS_PENDING: { label: 'Questions Pending', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  BUILDING: { label: 'Building', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  REVIEW_PENDING: { label: 'Awaiting Review', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  APPROVED: { label: 'Approved', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  DEPLOYED: { label: 'Delivered', className: 'bg-green-100 text-green-700 border-green-200' },
  CLOSED: { label: 'Closed', className: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const PRIORITY_CONFIG: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const ARTIFACT_CONFIG = {
  build_plan: {
    label: 'Build Plan',
    icon: '📄',
    iconBg: 'bg-blue-100',
    border: 'border-blue-200',
    gradient: 'from-blue-50 to-indigo-50',
    desc: 'Full implementation guide',
  },
  solution_demo: {
    label: 'Solution Demo',
    icon: '🎬',
    iconBg: 'bg-purple-100',
    border: 'border-purple-200',
    gradient: 'from-purple-50 to-violet-50',
    desc: 'Interactive HTML presentation',
  },
  workflow_json: {
    label: 'Workflow JSON',
    icon: '⚙️',
    iconBg: 'bg-emerald-100',
    border: 'border-emerald-200',
    gradient: 'from-emerald-50 to-green-50',
    desc: 'Import into your platform',
  },
  ai_analysis: {
    label: 'AI Analysis',
    icon: '🤖',
    iconBg: 'bg-gray-100',
    border: 'border-gray-200',
    gradient: 'from-gray-50 to-slate-50',
    desc: 'Raw AI analysis output',
  },
} as const;

// ── Allowed status transitions for the team ──────────────────────────────────
const STATUS_TRANSITIONS: Record<string, string[]> = {
  REVIEW_PENDING: ['APPROVED', 'BUILDING'],
  APPROVED: ['DEPLOYED', 'REVIEW_PENDING'],
  DEPLOYED: ['CLOSED'],
  BUILDING: ['REVIEW_PENDING'],
  QUESTIONS_PENDING: ['BUILDING'],
};

export default function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [artifacts, setArtifacts] = useState<TicketArtifact[]>([]);
  const [assets, setAssets] = useState<TicketAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    async function load() {
      const [ticketRes, artifactsRes, assetsRes] = await Promise.all([
        supabase.from('tickets').select('*').eq('id', id).single(),
        supabase.from('ticket_artifacts').select('*').eq('ticket_id', id).order('created_at'),
        supabase.from('ticket_assets').select('*').eq('ticket_id', id).order('created_at'),
      ]);
      const t = ticketRes.data as Ticket;
      setTicket(t);
      setNotes(t?.description ?? '');
      setArtifacts((artifactsRes.data as TicketArtifact[]) ?? []);
      setAssets((assetsRes.data as TicketAsset[]) ?? []);
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleView(artifact: TicketArtifact) {
    setViewingId(artifact.id);
    try {
      const { data, error } = await supabase.storage
        .from('ticket-files')
        .createSignedUrl(artifact.file_path, 3600);
      if (error || !data?.signedUrl) {
        toast.error('Could not open: ' + (error?.message ?? 'Unknown error'));
        return;
      }
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Failed to open file');
    } finally {
      setViewingId(null);
    }
  }

  async function handleDownload(artifact: TicketArtifact) {
    setDownloadingId(artifact.id);
    try {
      const { data, error } = await supabase.storage.from('ticket-files').download(artifact.file_path);
      if (error || !data) {
        toast.error('Download failed: ' + (error?.message ?? 'Unknown error'));
        return;
      }
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = artifact.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${artifact.file_name}`);
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleSaveNotes() {
    if (!ticket) return;
    setSavingNotes(true);
    const { error } = await supabase
      .from('tickets')
      .update({ description: notes, updated_at: new Date().toISOString() })
      .eq('id', ticket.id);
    if (error) {
      toast.error('Failed to save notes');
    } else {
      toast.success('Notes saved');
    }
    setSavingNotes(false);
  }

  async function handleStatusChange(newStatus: string) {
    if (!ticket) return;
    setUpdatingStatus(true);
    const { error } = await supabase
      .from('tickets')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', ticket.id);
    if (error) {
      toast.error('Failed to update status');
    } else {
      setTicket((prev) => prev ? { ...prev, status: newStatus as Ticket['status'] } : prev);
      toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label ?? newStatus}`);
    }
    setUpdatingStatus(false);
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-20">
        <AlertCircle size={40} className="mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="text-muted-foreground font-medium">Project not found</p>
        <Link href="/dashboard/delivery">
          <Button variant="outline" size="sm" className="mt-4 gap-2">
            <ArrowLeft size={13} /> Back to Delivery
          </Button>
        </Link>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[ticket.status] ?? { label: ticket.status, className: 'bg-gray-100 text-gray-700' };
  const currentStatusIndex = STATUS_ORDER.indexOf(ticket.status);
  const transitions = STATUS_TRANSITIONS[ticket.status] ?? [];
  const qaHistory = (ticket.ai_questions ?? []) as AIQuestion[];

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Delivery
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight">
              {ticket.project_name || 'Untitled Project'}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {ticket.company_name} · #{ticket.id.slice(0, 8)}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-xs px-3 py-1.5 rounded-full font-semibold border', statusConfig.className)}>
              {statusConfig.label}
            </span>
            {/* Status transition buttons */}
            {transitions.length > 0 && (
              <div className="flex gap-1.5">
                {transitions.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1"
                    onClick={() => handleStatusChange(s)}
                    disabled={updatingStatus}
                  >
                    {updatingStatus ? <Loader2 size={12} className="animate-spin" /> : null}
                    → {STATUS_CONFIG[s]?.label ?? s}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status timeline */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-0">
            {PIPELINE_STAGES.map((stage, i) => {
              const stageIndex = STATUS_ORDER.indexOf(stage.key);
              const isDone = stageIndex < currentStatusIndex;
              const isCurrent = stage.key === ticket.status ||
                (ticket.status === 'CONTEXT_PENDING' && stage.key === 'SUBMITTED');
              const isUpcoming = stageIndex > currentStatusIndex;

              return (
                <div key={stage.key} className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center gap-1 min-w-0">
                    <div
                      className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                        isDone ? 'bg-green-500 text-white' :
                        isCurrent ? 'bg-blue-600 text-white ring-2 ring-blue-200' :
                        'bg-gray-100 text-gray-400'
                      )}
                    >
                      {isDone ? '✓' : i + 1}
                    </div>
                    <span className={cn(
                      'text-[10px] font-medium text-center leading-tight',
                      isCurrent ? 'text-blue-700' : isDone ? 'text-green-700' : 'text-muted-foreground'
                    )}>
                      {stage.label}
                    </span>
                  </div>
                  {i < PIPELINE_STAGES.length - 1 && (
                    <div className={cn('h-0.5 flex-1 mx-1 mb-4', isDone ? 'bg-green-400' : 'bg-gray-200')} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Customer info */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Building2 size={14} /> Customer Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            <InfoRow icon={<Building2 size={13} />} label="Company" value={ticket.company_name} />
            <InfoRow icon={<User size={13} />} label="Contact" value={ticket.contact_name} />
            <InfoRow icon={<Mail size={13} />} label="Email" value={ticket.contact_email} />
            <InfoRow
              icon={<Cpu size={13} />}
              label="Platform"
              value={
                <span
                  className={cn('text-xs px-2 py-0.5 rounded-full font-medium', {
                    'bg-orange-100 text-orange-700': ticket.ticket_type === 'n8n',
                    'bg-purple-100 text-purple-700': ticket.ticket_type === 'make',
                    'bg-yellow-100 text-yellow-800': ticket.ticket_type === 'zapier',
                  })}
                >
                  {ticket.ticket_type === 'n8n' ? 'n8n' : ticket.ticket_type === 'make' ? 'Make.com' : 'Zapier'}
                </span>
              }
            />
            <InfoRow
              icon={<Tag size={13} />}
              label="Priority"
              value={
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', PRIORITY_CONFIG[ticket.priority])}>
                  {ticket.priority}
                </span>
              }
            />
            <InfoRow
              icon={<Calendar size={13} />}
              label="Created"
              value={new Date(ticket.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            />
            {ticket.complexity_estimate && (
              <InfoRow
                icon={<Clock size={13} />}
                label="Complexity"
                value={<span className="capitalize">{ticket.complexity_estimate}</span>}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Project brief */}
      {(ticket.what_to_build || ticket.expected_outcome) && (
        <Card>
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Project Brief
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {ticket.what_to_build && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  What to Build
                </div>
                <p className="text-sm leading-relaxed">{ticket.what_to_build}</p>
              </div>
            )}
            {ticket.expected_outcome && (
              <div className="border-t pt-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Expected Outcome
                </div>
                <p className="text-sm leading-relaxed">{ticket.expected_outcome}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI Analysis */}
      {(ticket.ai_summary || ticket.ai_understanding) && (
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader className="pb-3 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-green-900 flex items-center gap-2">
                <CheckCircle size={14} className="text-green-600" />
                AI Analysis
              </CardTitle>
              {ticket.complexity_estimate && (
                <span className="text-xs bg-white border border-green-200 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  {ticket.complexity_estimate} complexity
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {ticket.ai_summary && (
              <p className="text-sm text-green-800 font-medium">{ticket.ai_summary}</p>
            )}
            {ticket.ai_understanding && (
              <div className="bg-white/80 rounded-lg p-4 border border-green-200">
                <p className="text-sm text-gray-700 leading-relaxed">{ticket.ai_understanding}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Q&A History */}
      {qaHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <MessageSquare size={14} /> Q&A History
              <span className="ml-auto font-normal normal-case text-xs bg-muted px-2 py-0.5 rounded-full">
                {qaHistory.filter((q) => q.answer).length}/{qaHistory.length} answered
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {qaHistory.map((q, i) => (
              <div key={q.id} className="space-y-1.5">
                <div className="flex items-start gap-2.5">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium text-gray-800">{q.question}</p>
                    {q.answer ? (
                      <div className="bg-gray-50 rounded-lg px-3 py-2 border">
                        <p className="text-sm text-gray-600">{q.answer}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No answer provided</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {q.category}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Deliverables */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <div className="flex items-center gap-2">
            <Package size={14} className="text-muted-foreground" />
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Deliverables
            </CardTitle>
            {artifacts.length > 0 && (
              <span className="ml-auto text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-medium">
                {artifacts.length} generated
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {artifacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No deliverables generated yet.</p>
              <p className="text-xs mt-1">Complete the ticket wizard to generate them.</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-4 gap-1.5"
                onClick={() => router.push(`/dashboard/tickets/${ticket.id}`)}
              >
                View Ticket
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['build_plan', 'solution_demo', 'workflow_json'] as const).map((type) => {
                const artifact = artifacts.find((a) => a.artifact_type === type);
                const cfg = ARTIFACT_CONFIG[type];
                const isViewing = viewingId === artifact?.id;
                const isDownloading = downloadingId === artifact?.id;
                const isMcp = artifact?.metadata?.mcp_assisted as boolean;
                const templateMatch = artifact?.metadata?.template_matched as string | null;

                return (
                  <div
                    key={type}
                    className={cn(
                      'border rounded-xl p-4 bg-gradient-to-b space-y-3',
                      artifact ? cn(cfg.border, cfg.gradient) : 'border-border bg-muted/20 opacity-50'
                    )}
                  >
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-xl', artifact ? cfg.iconBg : 'bg-muted')}>
                      {cfg.icon}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{cfg.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{cfg.desc}</div>
                      {artifact && (
                        <div className="text-xs text-muted-foreground mt-1">
                          v{artifact.version} · {new Date(artifact.created_at).toLocaleDateString()}
                        </div>
                      )}
                      {isMcp && (
                        <div className="text-xs text-blue-600 font-medium mt-0.5">⚡ MCP-assisted</div>
                      )}
                      {templateMatch && (
                        <div className="text-xs text-purple-600 font-medium mt-0.5 truncate" title={templateMatch}>
                          📋 {templateMatch}
                        </div>
                      )}
                    </div>
                    {artifact ? (
                      <div className="space-y-1.5">
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 gap-1 text-xs h-8 bg-white/80 hover:bg-white"
                            onClick={() => handleView(artifact)}
                            disabled={isViewing || isDownloading}
                          >
                            {isViewing ? <Loader2 size={11} className="animate-spin" /> : <Eye size={11} />}
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 gap-1 text-xs h-8 bg-white/80 hover:bg-white"
                            onClick={() => handleDownload(artifact)}
                            disabled={isViewing || isDownloading}
                          >
                            {isDownloading ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                            Save
                          </Button>
                        </div>
                        {type === 'workflow_json' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full gap-1 text-xs h-8 bg-white/80 hover:bg-white text-blue-600 border-blue-200"
                            onClick={() => toast.info('n8n direct deploy coming soon')}
                          >
                            ⚡ Deploy to n8n (soon)
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic">Not yet generated</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Uploaded files */}
      {assets.length > 0 && (
        <Card>
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <FileText size={14} /> Uploaded Files
              <span className="ml-auto font-normal normal-case text-xs bg-muted px-2 py-0.5 rounded-full">
                {assets.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y rounded-lg border overflow-hidden">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-3 px-3 py-2.5 bg-background hover:bg-muted/30 transition-colors"
                >
                  {asset.asset_type === 'link' ? (
                    <Link2 size={14} className="text-blue-500 shrink-0" />
                  ) : (
                    <FileText size={14} className="text-muted-foreground shrink-0" />
                  )}
                  <span className="text-sm flex-1 truncate">
                    {asset.asset_type === 'link' ? (
                      <a
                        href={asset.external_url ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {asset.external_url}
                      </a>
                    ) : (
                      asset.file_name ?? 'Unknown'
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                    {asset.category}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Internal notes */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <MessageSquare size={14} /> Internal Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Add internal notes about this project (only visible to your team)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[100px] text-sm resize-none"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSaveNotes}
              disabled={savingNotes}
            >
              {savingNotes ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Save size={13} />
              )}
              Save Notes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── InfoRow helper ────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
