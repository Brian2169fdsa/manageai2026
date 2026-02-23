'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, AlertCircle, Download, Eye, Loader2, Sparkles, ChevronRight, RefreshCw } from 'lucide-react';
import { AIQuestion, TicketArtifact } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  ticketId: string;
  summary: string;
  understanding: string;
  questions: AIQuestion[];
  artifacts: TicketArtifact[];
  readyToBuild: boolean;
  reAnalyzing: boolean;
  onBack: () => void;
  onAnswersSubmitted: (answers: AIQuestion[]) => Promise<void>;
  onGenerateBuild: () => Promise<void>;
  isGenerating: boolean;
}

const artifactDefs = [
  {
    type: 'build_plan' as const,
    label: 'Build Plan',
    icon: '📄',
    desc: 'Step-by-step implementation guide',
    color: 'from-blue-50 to-indigo-50 border-blue-200',
    iconBg: 'bg-blue-100',
  },
  {
    type: 'solution_demo' as const,
    label: 'Solution Demo',
    icon: '🎬',
    desc: 'Interactive HTML presentation',
    color: 'from-purple-50 to-violet-50 border-purple-200',
    iconBg: 'bg-purple-100',
  },
  {
    type: 'workflow_json' as const,
    label: 'Workflow JSON',
    icon: '⚙️',
    desc: 'Import directly into your platform',
    color: 'from-emerald-50 to-green-50 border-emerald-200',
    iconBg: 'bg-emerald-100',
  },
] as const;

export function TicketWizardStep3({
  ticketId,
  summary,
  understanding,
  questions,
  artifacts,
  readyToBuild,
  reAnalyzing,
  onBack,
  onAnswersSubmitted,
  onGenerateBuild,
  isGenerating,
}: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submittingAnswers, setSubmittingAnswers] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  function setAnswer(questionId: string, answer: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }

  async function handleSubmitAnswers() {
    setSubmittingAnswers(true);
    const answered = questions.map((q) => ({ ...q, answer: answers[q.id] ?? '' }));
    await onAnswersSubmitted(answered);
    setSubmittingAnswers(false);
  }

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
    } catch (e) {
      toast.error('Failed to open file');
      console.error(e);
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
    } catch (e) {
      toast.error('Failed to download file');
      console.error(e);
    } finally {
      setDownloadingId(null);
    }
  }

  const unansweredCount = questions.filter((q) => !answers[q.id]?.trim()).length;
  const allAnswered = unansweredCount === 0;

  // ── Re-analyzing overlay ─────────────────────────────────────────────────
  if (reAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-5">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <Sparkles size={28} className="text-amber-600" />
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-semibold text-lg">Processing your answers...</p>
          <p className="text-sm text-muted-foreground">Saving your responses and preparing to build</p>
        </div>
      </div>
    );
  }

  // ── Full-screen generating overlay ──────────────────────────────────────
  if (isGenerating && artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-blue-100 flex items-center justify-center">
            <Sparkles size={34} className="text-blue-600" />
          </div>
          <div className="absolute inset-0 rounded-2xl border-2 border-blue-400 border-t-transparent animate-spin" />
        </div>
        <div className="text-center space-y-2">
          <p className="font-bold text-xl">Building your deliverables</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Claude is generating your Build Plan, Solution Demo, and Workflow JSON. This takes 30–60 seconds.
          </p>
        </div>
        <div className="w-full max-w-xs space-y-2">
          {['📄 Build Plan HTML', '🎬 Solution Demo', '⚙️ Workflow JSON'].map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin shrink-0 text-blue-500" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* AI Understanding */}
      <Card className="border-green-200 bg-green-50/40">
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-center gap-2">
            <CheckCircle size={17} className="text-green-600 shrink-0" />
            <CardTitle className="text-sm font-semibold text-green-900">AI Understanding</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4 space-y-2.5">
          <p className="text-sm text-green-800 font-medium leading-relaxed">{summary}</p>
          <div className="bg-white/80 rounded-lg p-3.5 border border-green-200">
            <p className="text-sm text-gray-700 leading-relaxed">{understanding}</p>
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      {questions.length > 0 && artifacts.length === 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center gap-2">
              <AlertCircle size={17} className="text-amber-600 shrink-0" />
              <CardTitle className="text-sm font-semibold text-amber-900">Clarifying Questions</CardTitle>
              <div className="ml-auto">
                {unansweredCount > 0 ? (
                  <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                    {unansweredCount} remaining
                  </span>
                ) : (
                  <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-medium">
                    All answered ✓
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-4">
            {questions.map((q, i) => (
              <div key={q.id} className="space-y-1.5">
                <div className="flex gap-2.5 items-start">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-amber-200 text-amber-800 text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm font-medium text-amber-900 leading-snug">{q.question}</p>
                </div>
                <div className="ml-7">
                  <Textarea
                    placeholder="Your answer..."
                    className={cn(
                      'min-h-[56px] text-sm resize-none transition-colors',
                      answers[q.id]?.trim()
                        ? 'border-green-300 bg-green-50/50 focus-visible:ring-green-400'
                        : 'bg-white'
                    )}
                    value={answers[q.id] ?? ''}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                  />
                </div>
              </div>
            ))}

            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 gap-2"
              onClick={handleSubmitAnswers}
              disabled={submittingAnswers || !allAnswered}
            >
              {submittingAnswers ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Submitting & Building...
                </>
              ) : (
                <>
                  <Sparkles size={15} /> Submit Answers & Build
                </>
              )}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Your answers will be saved and deliverables generated automatically
            </p>
          </CardContent>
        </Card>
      )}

      {/* Deliverables */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-center gap-2">
            <span className="text-base">📦</span>
            <CardTitle className="text-sm font-semibold">Deliverables</CardTitle>
            {artifacts.length > 0 && (
              <span className="ml-auto text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-medium">
                {artifacts.length} generated ✓
              </span>
            )}
            {readyToBuild && artifacts.length === 0 && questions.length === 0 && !isGenerating && (
              <span className="ml-auto text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full font-medium">
                Preparing...
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {/* Retry button if something went wrong */}
          {readyToBuild && artifacts.length === 0 && !isGenerating && questions.length === 0 && (
            <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm text-red-700 mb-3 font-medium">Generation didn&apos;t start automatically.</p>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2 h-10"
                onClick={onGenerateBuild}
              >
                <RefreshCw size={15} /> Generate Deliverables
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {artifactDefs.map((def) => {
              const artifact = artifacts.find((a) => a.artifact_type === def.type);
              const isViewLoading = viewingId === artifact?.id;
              const isDownloadLoading = downloadingId === artifact?.id;

              return (
                <div
                  key={def.type}
                  className={cn(
                    'border rounded-xl p-4 space-y-3 bg-gradient-to-b transition-all',
                    artifact ? def.color : 'border-border bg-muted/20 opacity-50'
                  )}
                >
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center text-xl',
                      artifact ? def.iconBg : 'bg-muted'
                    )}
                  >
                    {def.icon}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{def.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{def.desc}</div>
                  </div>
                  {artifact ? (
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1 text-xs h-8 bg-white/80 hover:bg-white"
                        onClick={() => handleView(artifact)}
                        disabled={isViewLoading || isDownloadLoading}
                      >
                        {isViewLoading ? <Loader2 size={11} className="animate-spin" /> : <Eye size={11} />}
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1 text-xs h-8 bg-white/80 hover:bg-white"
                        onClick={() => handleDownload(artifact)}
                        disabled={isViewLoading || isDownloadLoading}
                      >
                        {isDownloadLoading ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Download size={11} />
                        )}
                        Save
                      </Button>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic">
                      {isGenerating ? 'Generating...' : 'Not yet generated'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between pt-1">
        <Button variant="outline" onClick={onBack} disabled={isGenerating || submittingAnswers}>
          ← Back
        </Button>
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          onClick={() => router.push(`/dashboard/delivery/${ticketId}`)}
          disabled={artifacts.length === 0 && isGenerating}
        >
          View Delivery Dashboard <ChevronRight size={15} />
        </Button>
      </div>
    </div>
  );
}
