'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { OpportunityAssessment } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Building2,
  User,
  Globe,
  Calendar,
  Share2,
  Download,
  AlertCircle,
  Loader2,
  CheckCircle2,
  TrendingUp,
  Clock,
  DollarSign,
  Zap,
  Send,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  sent: { label: 'Sent to Prospect', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  converted: { label: 'Converted', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

function formatCurrency(n: number | undefined): string {
  if (!n) return '–';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-white border rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className={cn('text-2xl font-bold', accent ?? 'text-foreground')}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export default function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [assessment, setAssessment] = useState<OpportunityAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [generatingBlueprint, setGeneratingBlueprint] = useState(false);
  const [blueprintContent, setBlueprintContent] = useState<string | null>(null);
  const [showBlueprint, setShowBlueprint] = useState(false);

  useEffect(() => {
    supabase
      .from('opportunity_assessments')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        const a = data as OpportunityAssessment;
        setAssessment(a);
        if (a?.blueprint_content) {
          setBlueprintContent(a.blueprint_content);
        }
        setLoading(false);
      });
  }, [id]);

  async function handleGenerateBlueprint() {
    if (!assessment) return;
    setGeneratingBlueprint(true);
    try {
      const res = await fetch('/api/blueprint/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessment_id: assessment.id }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 207) {
        toast.error(data.error || 'Blueprint generation failed');
        return;
      }
      setBlueprintContent(data.html);
      setShowBlueprint(true);
      toast.success('AI Blueprint generated!');
    } catch {
      toast.error('Blueprint generation failed');
    } finally {
      setGeneratingBlueprint(false);
    }
  }

  function handleCopyShareLink() {
    const url = `${window.location.origin}/share/assessment/${id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success('Share link copied to clipboard!'))
      .catch(() => toast.error('Could not copy link'));
  }

  function handlePrint() {
    const iframe = document.getElementById('assessment-frame') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } else {
      window.print();
    }
  }

  async function handleMarkSent() {
    if (!assessment) return;
    setUpdatingStatus(true);
    const { error } = await supabase
      .from('opportunity_assessments')
      .update({ status: 'sent' })
      .eq('id', id);
    if (error) {
      toast.error('Failed to update status');
    } else {
      setAssessment((prev) => (prev ? { ...prev, status: 'sent' } : prev));
      toast.success('Marked as sent');
    }
    setUpdatingStatus(false);
  }

  async function handleMarkConverted() {
    if (!assessment) return;
    setUpdatingStatus(true);
    const { error } = await supabase
      .from('opportunity_assessments')
      .update({ status: 'converted' })
      .eq('id', id);
    if (error) {
      toast.error('Failed to update status');
    } else {
      setAssessment((prev) => (prev ? { ...prev, status: 'converted' } : prev));
      toast.success('Marked as converted!');
    }
    setUpdatingStatus(false);
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="text-center py-20">
        <AlertCircle size={40} className="mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="text-muted-foreground font-medium">Assessment not found</p>
        <Link href="/dashboard/opportunities">
          <Button variant="outline" size="sm" className="mt-4 gap-2">
            <ArrowLeft size={13} /> Back to Assessments
          </Button>
        </Link>
      </div>
    );
  }

  const metrics = assessment.assessment?.metrics;
  const formData = assessment.form_data;
  const statusConfig =
    STATUS_CONFIG[assessment.status] ?? { label: assessment.status, className: 'bg-gray-100 text-gray-700' };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
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
              {assessment.company_name} — Opportunity Assessment
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Contact: {assessment.contact_name} ·{' '}
              {formData?.industry && <span>{formData.industry} · </span>}
              ID {assessment.id.slice(0, 8)}
            </p>
          </div>
          <span
            className={cn(
              'shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold border mt-1',
              statusConfig.className
            )}
          >
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Actions row */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleCopyShareLink}
        >
          <Share2 size={13} /> Copy Share Link
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint}>
          <Download size={13} /> Download PDF
        </Button>
        <Button
          size="sm"
          className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
          onClick={blueprintContent ? () => setShowBlueprint((v) => !v) : handleGenerateBlueprint}
          disabled={generatingBlueprint}
        >
          {generatingBlueprint ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <FileText size={12} />
          )}
          {generatingBlueprint
            ? 'Generating Blueprint…'
            : blueprintContent
            ? showBlueprint ? 'Hide Blueprint' : 'View Blueprint'
            : 'Generate Blueprint'}
          {blueprintContent && !generatingBlueprint && (
            showBlueprint ? <ChevronUp size={12} /> : <ChevronDown size={12} />
          )}
        </Button>
        {assessment.status === 'draft' && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50"
            onClick={handleMarkSent}
            disabled={updatingStatus}
          >
            {updatingStatus ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Send size={12} />
            )}
            Mark as Sent
          </Button>
        )}
        {assessment.status === 'sent' && (
          <Button
            size="sm"
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleMarkConverted}
            disabled={updatingStatus}
          >
            {updatingStatus ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <CheckCircle2 size={12} />
            )}
            Mark as Converted
          </Button>
        )}
        <span className="text-xs text-muted-foreground self-center ml-1">
          — Share link is public (no login required)
        </span>
      </div>

      {/* ROI Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard
            icon={<Clock size={13} />}
            label="Hours Saved / Week"
            value={metrics.hours_saved_per_week ? `${metrics.hours_saved_per_week}h` : '–'}
            sub="across all automations"
            accent="text-blue-700"
          />
          <MetricCard
            icon={<DollarSign size={13} />}
            label="Annual Savings"
            value={formatCurrency(metrics.annual_cost_savings)}
            sub="@ $50/hr loaded cost"
            accent="text-emerald-700"
          />
          <MetricCard
            icon={<TrendingUp size={13} />}
            label="3-Year ROI"
            value={metrics.three_year_roi ? `${metrics.three_year_roi}%` : '–'}
            sub={`payback in ${metrics.payback_months ?? '?'} months`}
            accent="text-emerald-700"
          />
          <MetricCard
            icon={<Zap size={13} />}
            label="Opportunities"
            value={metrics.opportunities_count ? `${metrics.opportunities_count}` : '–'}
            sub={
              metrics.implementation_cost_low && metrics.implementation_cost_high
                ? `${formatCurrency(metrics.implementation_cost_low)} – ${formatCurrency(metrics.implementation_cost_high)} investment`
                : 'automation opportunities'
            }
            accent="text-blue-700"
          />
        </div>
      )}

      {/* Company Card */}
      <Card>
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Building2 size={14} /> Company Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            <InfoRow icon={<Building2 size={13} />} label="Company" value={assessment.company_name} />
            <InfoRow icon={<User size={13} />} label="Contact" value={assessment.contact_name} />
            <InfoRow
              icon={<Building2 size={13} />}
              label="Industry"
              value={formData?.industry || '–'}
            />
            <InfoRow
              icon={<User size={13} />}
              label="Company Size"
              value={formData?.company_size || '–'}
            />
            <InfoRow
              icon={<DollarSign size={13} />}
              label="Annual Revenue"
              value={formData?.annual_revenue || '–'}
            />
            {formData?.website && (
              <InfoRow
                icon={<Globe size={13} />}
                label="Website"
                value={
                  <a
                    href={formData.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {formData.website}
                  </a>
                }
              />
            )}
          </div>

          {formData?.pain_points && formData.pain_points.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Pain Points
              </div>
              <div className="flex flex-wrap gap-1.5">
                {formData.pain_points.map((p) => (
                  <span key={p} className="text-xs bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {formData?.current_tools && formData.current_tools.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Current Tools
              </div>
              <div className="flex flex-wrap gap-1.5">
                {formData.current_tools.map((t) => (
                  <span key={t} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assessment Preview */}
      {assessment.html_content ? (
        <Card>
          <CardHeader className="pb-3 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600" />
                Assessment Document
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                Generated{' '}
                {new Date(assessment.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0 pb-0 rounded-b-xl overflow-hidden">
            <div className="border-t">
              <iframe
                id="assessment-frame"
                srcDoc={assessment.html_content}
                title="Opportunity Assessment"
                sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups"
                className="w-full border-none"
                style={{ height: '800px', display: 'block' }}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertCircle size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Assessment document not available</p>
          </CardContent>
        </Card>
      )}

      {/* Blueprint Panel */}
      {blueprintContent && showBlueprint && (
        <Card>
          <CardHeader className="pb-3 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <FileText size={14} className="text-indigo-600" />
                AI Blueprint
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Full implementation plan</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => {
                    const iframe = document.getElementById('blueprint-frame') as HTMLIFrameElement;
                    if (iframe?.contentWindow) {
                      iframe.contentWindow.focus();
                      iframe.contentWindow.print();
                    }
                  }}
                >
                  <Download size={11} /> Print
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                  onClick={handleGenerateBlueprint}
                  disabled={generatingBlueprint}
                >
                  {generatingBlueprint ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
                  Regenerate
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 pb-0 rounded-b-xl overflow-hidden">
            <div className="border-t">
              <iframe
                id="blueprint-frame"
                srcDoc={blueprintContent}
                title="AI Blueprint"
                sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups"
                className="w-full border-none"
                style={{ height: '900px', display: 'block' }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground pb-4">
        <Calendar size={12} />
        Created {new Date(assessment.created_at).toLocaleString('en-US', {
          month: 'long', day: 'numeric', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })}
      </div>
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
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
