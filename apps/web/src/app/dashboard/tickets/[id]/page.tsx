'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Ticket, TicketArtifact, TicketAsset } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Building2, User, Mail, Calendar, Tag, Cpu,
  Download, Eye, FileText, Link2, ArrowLeft, Loader2,
  CheckCircle, AlertCircle, Package, Share2, ThumbsUp, ThumbsDown, RotateCcw, Rocket,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  SUBMITTED: { label: 'Submitted', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  CONTEXT_PENDING: { label: 'Context Pending', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  ANALYZING: { label: 'Analyzing', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  QUESTIONS_PENDING: { label: 'Questions Pending', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  BUILDING: { label: 'Building', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  REVIEW_PENDING: { label: 'Review Pending', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  APPROVED: { label: 'Approved', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  DEPLOYED: { label: 'Deployed', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  CLOSED: { label: 'Closed', className: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const PRIORITY_CONFIG: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const ARTIFACT_CONFIG = {
  build_plan: { label: 'Build Plan', icon: '📄', iconBg: 'bg-blue-100', border: 'border-blue-200', gradient: 'from-blue-50 to-indigo-50' },
  solution_demo: { label: 'Solution Demo', icon: '🎬', iconBg: 'bg-purple-100', border: 'border-purple-200', gradient: 'from-purple-50 to-violet-50' },
  workflow_json: { label: 'Workflow JSON', icon: '⚙️', iconBg: 'bg-emerald-100', border: 'border-emerald-200', gradient: 'from-emerald-50 to-green-50' },
  ai_analysis: { label: 'AI Analysis', icon: '🤖', iconBg: 'bg-gray-100', border: 'border-gray-200', gradient: 'from-gray-50 to-slate-50' },
} as const;

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [artifacts, setArtifacts] = useState<TicketArtifact[]>([]);
  const [assets, setAssets] = useState<TicketAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | 'request_revision' | null>(null);
  const [approvalComments, setApprovalComments] = useState('');
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [deployLoading, setDeployLoading] = useState(false);

  function handleCopyShareLink(type: 'demo' | 'plan') {
    const url = `${window.location.origin}/share/${id}/${type}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link copied to clipboard!');
    }).catch(() => {
      toast.error('Could not copy link');
    });
  }

  const hasDemo = artifacts.some((a) => a.artifact_type === 'solution_demo');
  const hasPlan = artifacts.some((a) => a.artifact_type === 'build_plan');

  useEffect(() => {
    async function load() {
      const [ticketRes, artifactsRes, assetsRes] = await Promise.all([
        supabase.from('tickets').select('*').eq('id', id).single(),
        supabase.from('ticket_artifacts').select('*').eq('ticket_id', id).order('created_at'),
        supabase.from('ticket_assets').select('*').eq('ticket_id', id).order('created_at'),
      ]);
      setTicket(ticketRes.data as Ticket);
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
        toast.error('Could not open file: ' + (error?.message ?? 'Unknown error'));
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
      const { data, error } = await supabase.storage
        .from('ticket-files')
        .download(artifact.file_path);
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

  async function handleApproval(action: 'approve' | 'reject' | 'request_revision') {
    if (!ticket) return;
    setApprovalLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comments: approvalComments || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Approval action failed');
        return;
      }
      toast.success(
        action === 'approve'
          ? 'Ticket approved!'
          : action === 'reject'
          ? 'Ticket sent back for rebuild'
          : 'Revision requested'
      );
      setTicket((prev) => prev ? { ...prev, status: data.status } : prev);
      setApprovalAction(null);
      setApprovalComments('');
    } catch {
      toast.error('Failed to process approval action');
    } finally {
      setApprovalLoading(false);
    }
  }

  async function handleDeploy() {
    if (!ticket) return;
    setDeployLoading(true);
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticket.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Deployment failed');
        return;
      }
      if (ticket.ticket_type === 'zapier') {
        toast.success('Zapier setup guide generated! Download it from the Deliverables section.');
      } else {
        toast.success(`Deployed to ${ticket.ticket_type.toUpperCase()} successfully!`);
      }
      setTicket((prev) => prev ? { ...prev, status: data.status === 'deployed' ? 'DEPLOYED' : prev.status } : prev);
    } catch {
      toast.error('Deployment request failed');
    } finally {
      setDeployLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-20">
        <AlertCircle size={40} className="mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="text-muted-foreground font-medium">Ticket not found</p>
        <Link href="/dashboard/tickets">
          <Button variant="outline" size="sm" className="mt-4 gap-2">
            <ArrowLeft size={13} /> Back to Tickets
          </Button>
        </Link>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[ticket.status] ?? { label: ticket.status, className: 'bg-gray-100 text-gray-700' };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold leading-tight">
              {ticket.project_name || 'Untitled Project'}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {ticket.company_name} · Ticket #{ticket.id.slice(0, 8)}
            </p>
          </div>
          <span className={cn('shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold border mt-1', statusConfig.className)}>
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Customer Card */}
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
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', {
                  'bg-red-100 text-red-700': ticket.ticket_type === 'n8n',
                  'bg-purple-100 text-purple-700': ticket.ticket_type === 'make',
                  'bg-orange-100 text-orange-700': ticket.ticket_type === 'zapier',
                })}>
                  {ticket.ticket_type.toUpperCase()}
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
              value={new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Project Brief */}
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

      {/* Approval Actions — only shown for REVIEW_PENDING tickets */}
      {ticket.status === 'REVIEW_PENDING' && (
        <Card className="border-purple-200 bg-purple-50/30">
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-sm font-semibold text-purple-900 flex items-center gap-2">
              <AlertCircle size={14} className="text-purple-600" />
              Review Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-purple-800">
              This build is ready for your review. Approve it to proceed to deployment, request a revision, or send it back for a full rebuild.
            </p>

            {/* Comments textarea — shown when reject or request_revision is selected */}
            {approvalAction && approvalAction !== 'approve' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-purple-900 uppercase tracking-wide">
                  {approvalAction === 'reject' ? 'Reason for rejection' : 'Revision notes'}
                </label>
                <textarea
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  placeholder={
                    approvalAction === 'reject'
                      ? 'Describe what needs to change before rebuilding...'
                      : 'Describe what needs to be revised...'
                  }
                  rows={3}
                  className="w-full rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className={cn(
                  'gap-1.5',
                  approvalAction === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                )}
                onClick={() => {
                  if (approvalAction === 'approve') {
                    handleApproval('approve');
                  } else {
                    setApprovalAction('approve');
                    setApprovalComments('');
                  }
                }}
                disabled={approvalLoading}
              >
                {approvalLoading && approvalAction === 'approve' ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <ThumbsUp size={12} />
                )}
                {approvalAction === 'approve' ? 'Confirm Approve' : 'Approve'}
              </Button>

              <Button
                size="sm"
                variant="outline"
                className={cn(
                  'gap-1.5',
                  approvalAction === 'request_revision'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
                    : 'text-amber-700 border-amber-200 hover:bg-amber-50'
                )}
                onClick={() => {
                  if (approvalAction === 'request_revision') {
                    handleApproval('request_revision');
                  } else {
                    setApprovalAction('request_revision');
                    setApprovalComments('');
                  }
                }}
                disabled={approvalLoading}
              >
                {approvalLoading && approvalAction === 'request_revision' ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <RotateCcw size={12} />
                )}
                {approvalAction === 'request_revision' ? 'Send Revision Request' : 'Request Revision'}
              </Button>

              <Button
                size="sm"
                variant="outline"
                className={cn(
                  'gap-1.5',
                  approvalAction === 'reject'
                    ? 'bg-red-600 hover:bg-red-700 text-white border-red-600'
                    : 'text-red-600 border-red-200 hover:bg-red-50'
                )}
                onClick={() => {
                  if (approvalAction === 'reject') {
                    handleApproval('reject');
                  } else {
                    setApprovalAction('reject');
                    setApprovalComments('');
                  }
                }}
                disabled={approvalLoading}
              >
                {approvalLoading && approvalAction === 'reject' ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <ThumbsDown size={12} />
                )}
                {approvalAction === 'reject' ? 'Confirm Reject' : 'Reject & Rebuild'}
              </Button>

              {approvalAction && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => { setApprovalAction(null); setApprovalComments(''); }}
                  disabled={approvalLoading}
                >
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deploy Action — shown when ticket is APPROVED and not yet deployed */}
      {ticket.status === 'APPROVED' && (
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
              <Rocket size={14} className="text-emerald-600" />
              Ready to Deploy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-emerald-800">
              This build has been approved.
              {ticket.ticket_type === 'zapier'
                ? ' Click below to generate your Zapier setup guide — Zapier does not support API-based deployment, so you will set it up manually using the guide.'
                : ` Click below to push the workflow JSON directly to your ${ticket.ticket_type.toUpperCase()} instance. Make sure your deploy credentials are configured in Settings → Deploy.`}
            </p>
            <Button
              size="sm"
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleDeploy}
              disabled={deployLoading}
            >
              {deployLoading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Rocket size={13} />
              )}
              {deployLoading
                ? 'Deploying...'
                : ticket.ticket_type === 'zapier'
                ? 'Generate Setup Guide'
                : `Deploy to ${ticket.ticket_type.toUpperCase()}`}
            </Button>
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
          {/* Share buttons row */}
          {(hasDemo || hasPlan) && (
            <div className="flex items-center gap-2 mb-4 pb-4 border-b flex-wrap">
              <span className="text-xs text-muted-foreground font-medium">Share:</span>
              {hasDemo && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-7 text-xs"
                  onClick={() => handleCopyShareLink('demo')}
                >
                  <Share2 size={11} /> Demo Link
                </Button>
              )}
              {hasPlan && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-7 text-xs"
                  onClick={() => handleCopyShareLink('plan')}
                >
                  <Share2 size={11} /> Build Plan Link
                </Button>
              )}
              <span className="text-xs text-muted-foreground ml-1">— Anyone with the link can view without logging in</span>
            </div>
          )}

          {artifacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No deliverables generated yet.</p>
              <p className="text-xs mt-1">Complete the ticket wizard to generate them.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {artifacts.map((artifact) => {
                const cfg = ARTIFACT_CONFIG[artifact.artifact_type as keyof typeof ARTIFACT_CONFIG] ?? {
                  label: artifact.artifact_type,
                  icon: '📎',
                  iconBg: 'bg-gray-100',
                  border: 'border-gray-200',
                  gradient: 'from-gray-50 to-slate-50',
                };
                const isViewing = viewingId === artifact.id;
                const isDownloading = downloadingId === artifact.id;

                return (
                  <div
                    key={artifact.id}
                    className={cn('border rounded-xl p-4 bg-gradient-to-b space-y-3', cfg.border, cfg.gradient)}
                  >
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-xl', cfg.iconBg)}>
                      {cfg.icon}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{cfg.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        v{artifact.version} · {new Date(artifact.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1 text-xs h-8 bg-white/80 hover:bg-white"
                        onClick={() => handleView(artifact)}
                        disabled={isViewing || isDownloading}
                      >
                        {isViewing ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Eye size={11} />
                        )}
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1 text-xs h-8 bg-white/80 hover:bg-white"
                        onClick={() => handleDownload(artifact)}
                        disabled={isViewing || isDownloading}
                      >
                        {isDownloading ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Download size={11} />
                        )}
                        Save
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Uploaded Files */}
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
                <div key={asset.id} className="flex items-center gap-3 px-3 py-2.5 bg-background hover:bg-muted/30 transition-colors">
                  {asset.asset_type === 'link' ? (
                    <Link2 size={14} className="text-blue-500 shrink-0" />
                  ) : (
                    <FileText size={14} className="text-muted-foreground shrink-0" />
                  )}
                  <span className="text-sm flex-1 truncate">
                    {asset.asset_type === 'link'
                      ? <a href={asset.external_url ?? '#'} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{asset.external_url}</a>
                      : asset.file_name ?? 'Unknown'
                    }
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
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-sm font-medium">
        {typeof value === 'string' ? value : value}
      </div>
    </div>
  );
}
