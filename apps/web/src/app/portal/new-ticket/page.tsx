'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Progress } from '@/components/ui/progress';
import { TicketWizardStep1 } from '@/components/portal/TicketWizardStep1';
import { TicketWizardStep2 } from '@/components/portal/TicketWizardStep2';
import { TicketWizardStep3 } from '@/components/portal/TicketWizardStep3';
import { supabase } from '@/lib/supabase/client';
import { WizardStep1Data, WizardStep2Data, AIQuestion, TicketArtifact } from '@/types';
import { toast } from 'sonner';
import { Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEP_LABELS = ['Company & Project', 'Upload Context', 'AI Review'];

const defaultStep1: WizardStep1Data = {
  company_name: '',
  contact_name: '',
  contact_email: '',
  project_name: '',
  ticket_type: 'n8n',
  what_to_build: '',
  expected_outcome: '',
  priority: 'medium',
};

const defaultStep2: WizardStep2Data = {
  files: [],
  transcript: '',
  links: [],
};

export default function NewTicketPage() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [step1, setStep1] = useState<WizardStep1Data>(() => {
    const platform = searchParams.get('platform') as WizardStep1Data['ticket_type'] | null;
    const what = searchParams.get('what_to_build');
    const project = searchParams.get('project_name');
    if (!platform && !what && !project) return defaultStep1;
    return {
      ...defaultStep1,
      ...(platform && { ticket_type: platform }),
      ...(what && { what_to_build: what }),
      ...(project && { project_name: project }),
    };
  });
  const [step2, setStep2] = useState<WizardStep2Data>(defaultStep2);

  const [ticketId, setTicketId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [reAnalyzing, setReAnalyzing] = useState(false);
  const [summary, setSummary] = useState('');
  const [understanding, setUnderstanding] = useState('');
  const [questions, setQuestions] = useState<AIQuestion[]>([]);
  const [artifacts, setArtifacts] = useState<TicketArtifact[]>([]);
  const [readyToBuild, setReadyToBuild] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [analyzingStatus, setAnalyzingStatus] = useState('');

  // ── Step 2 → 3: create ticket, upload files, call AI ────────────────────
  async function handleStep2Next() {
    console.log('\n=== [wizard] handleStep2Next called ===');
    console.log('[wizard] Step1 data:', { ...step1, what_to_build: step1.what_to_build.slice(0, 80) });
    console.log('[wizard] Step2 data: files:', step2.files.length, 'transcript chars:', step2.transcript.length, 'links:', step2.links.length);

    setAnalyzing(true);
    setAnalyzingStatus('Creating ticket...');

    try {
      // ── 1. Get auth user ─────────────────────────────────────────────────
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('[wizard] Auth error:', userError);
        toast.error('Authentication error. Please sign in again.');
        return;
      }
      console.log('[wizard] Authenticated user:', user?.id);

      // ── 2. Insert ticket row ─────────────────────────────────────────────
      console.log('[wizard] Inserting ticket into Supabase...');
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          company_name: step1.company_name,
          contact_name: step1.contact_name,
          contact_email: step1.contact_email,
          project_name: step1.project_name || null,
          ticket_type: step1.ticket_type,
          what_to_build: step1.what_to_build,
          expected_outcome: step1.expected_outcome || null,
          priority: step1.priority,
          status: 'ANALYZING',
          created_by: user?.id ?? null,
        })
        .select()
        .single();

      if (ticketError) {
        console.error('[wizard] Ticket insert error:', ticketError);
        toast.error(`Failed to create ticket: ${ticketError.message}`);
        return;
      }
      if (!ticket) {
        console.error('[wizard] Ticket insert returned null');
        toast.error('Failed to create ticket (no data returned)');
        return;
      }

      console.log('[wizard] Ticket created:', ticket.id);
      setTicketId(ticket.id);

      // ── 3. Upload files ──────────────────────────────────────────────────
      if (step2.files.length > 0) {
        setAnalyzingStatus(`Uploading ${step2.files.length} file(s)...`);
        console.log('[wizard] Uploading', step2.files.length, 'files...');

        for (const file of step2.files) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const filePath = `${ticket.id}/${Date.now()}-${safeName}`;
          console.log('[wizard] Uploading file:', file.name, '→', filePath);

          const { error: uploadError } = await supabase.storage
            .from('ticket-files')
            .upload(filePath, file, { upsert: false });

          if (uploadError) {
            console.error('[wizard] File upload error for', file.name, ':', uploadError.message);
            toast.warning(`Could not upload ${file.name}: ${uploadError.message}`);
            // Continue — don't block analysis over a failed upload
          } else {
            console.log('[wizard] File uploaded:', file.name);
            const { error: assetError } = await supabase.from('ticket_assets').insert({
              ticket_id: ticket.id,
              asset_type: 'file',
              file_name: file.name,
              file_path: filePath,
              mime_type: file.type || 'application/octet-stream',
              file_size: file.size,
              category: guessCategory(file.name, file.type),
            });
            if (assetError) {
              console.error('[wizard] ticket_assets insert error:', assetError.message);
            } else {
              console.log('[wizard] ticket_asset record saved for', file.name);
            }
          }
        }
      }

      // ── 4. Save transcript ───────────────────────────────────────────────
      if (step2.transcript.trim()) {
        console.log('[wizard] Saving transcript', step2.transcript.length, 'chars...');
        const transcriptPath = `${ticket.id}/transcript-${Date.now()}.txt`;
        const transcriptBuffer = new TextEncoder().encode(step2.transcript);
        const transcriptBlob = new Blob([transcriptBuffer], { type: 'text/plain' });

        const { error: txErr } = await supabase.storage
          .from('ticket-files')
          .upload(transcriptPath, transcriptBlob, { contentType: 'text/plain', upsert: false });

        if (txErr) {
          console.warn('[wizard] Transcript upload error:', txErr.message);
        } else {
          await supabase.from('ticket_assets').insert({
            ticket_id: ticket.id,
            asset_type: 'transcript',
            file_name: 'transcript.txt',
            file_path: transcriptPath,
            category: 'transcript',
          });
          console.log('[wizard] Transcript saved');
        }
      }

      // ── 5. Save links ────────────────────────────────────────────────────
      for (const link of step2.links) {
        const { error: linkErr } = await supabase.from('ticket_assets').insert({
          ticket_id: ticket.id,
          asset_type: 'link',
          external_url: link,
          category: 'other',
        });
        if (linkErr) console.error('[wizard] Link insert error:', linkErr.message);
        else console.log('[wizard] Link saved:', link);
      }

      // ── 6. Call /api/analyze-ticket ──────────────────────────────────────
      setAnalyzingStatus('AI is analyzing your project...');
      console.log('[wizard] Calling /api/analyze-ticket for ticket:', ticket.id);

      const res = await fetch('/api/analyze-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticket.id,
          transcript: step2.transcript,
          links: step2.links,
        }),
      });

      console.log('[wizard] /api/analyze-ticket response status:', res.status, res.statusText);

      if (!res.ok) {
        const errText = await res.text();
        console.error('[wizard] analyze-ticket failed:', res.status, errText);
        toast.error(`AI analysis failed (${res.status}): ${errText.slice(0, 200)}`);
        return;
      }

      const result = await res.json();
      console.log('[wizard] Analysis result:', {
        summary: result.summary?.slice(0, 80),
        questions_count: result.questions?.length,
        ready_to_build: result.ready_to_build,
        understanding: result.understanding?.slice(0, 80),
      });

      if (!result.summary && !result.understanding) {
        console.error('[wizard] Analysis returned empty result:', result);
        toast.error('AI returned an empty response. Check server logs.');
        return;
      }

      setSummary(result.summary ?? '');
      setUnderstanding(result.understanding ?? '');
      setQuestions(result.questions ?? []);
      setReadyToBuild(result.ready_to_build ?? false);
      setStep(3);
      console.log('[wizard] Advanced to step 3');

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[wizard] Unexpected error in handleStep2Next:', e);
      toast.error('Unexpected error: ' + msg);
    } finally {
      setAnalyzing(false);
      setAnalyzingStatus('');
    }
  }

  // ── Answer submission → re-analysis ────────────────────────────────────
  async function handleAnswersSubmitted(answered: AIQuestion[]) {
    if (!ticketId) {
      console.error('[wizard] handleAnswersSubmitted called but ticketId is null');
      return;
    }
    console.log('\n=== [wizard] handleAnswersSubmitted ===');
    console.log('[wizard] Answers:', answered.map(a => ({ id: a.id, hasAnswer: !!a.answer })));

    setReAnalyzing(true);
    try {
      const res = await fetch('/api/analyze-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticketId,
          answers: answered,
          transcript: step2.transcript,
          links: step2.links,
        }),
      });

      console.log('[wizard] Re-analysis response status:', res.status);

      if (!res.ok) {
        const errText = await res.text();
        console.error('[wizard] Re-analysis failed:', res.status, errText);
        toast.error(`Re-analysis failed (${res.status}): ${errText.slice(0, 200)}`);
        return;
      }

      const result = await res.json();
      console.log('[wizard] Re-analysis result:', {
        new_questions: result.questions?.length,
        ready_to_build: result.ready_to_build,
      });

      setSummary(result.summary || summary);
      setUnderstanding(result.understanding || understanding);
      setQuestions(result.questions ?? []);
      setReadyToBuild(result.ready_to_build ?? false);

      if (result.ready_to_build) {
        toast.success('AI has everything it needs. Click "Generate Deliverables"!');
      } else {
        toast.info(`AI has ${result.questions?.length ?? 0} more question(s).`);
      }
    } catch (e) {
      console.error('[wizard] Error in handleAnswersSubmitted:', e);
      toast.error('Re-analysis failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setReAnalyzing(false);
    }
  }

  // ── Generate deliverables ────────────────────────────────────────────────
  async function handleGenerateBuild() {
    if (!ticketId) {
      console.error('[wizard] handleGenerateBuild called but ticketId is null');
      return;
    }
    console.log('\n=== [wizard] handleGenerateBuild ===');
    console.log('[wizard] Calling /api/generate-build for ticket:', ticketId);

    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId }),
      });

      console.log('[wizard] /api/generate-build response status:', res.status, res.statusText);

      if (!res.ok) {
        const errText = await res.text();
        console.error('[wizard] generate-build failed:', res.status, errText);
        toast.error(`Build generation failed (${res.status}): ${errText.slice(0, 300)}`);
        return;
      }

      const result = await res.json();
      console.log('[wizard] generate-build result:', {
        success: result.success,
        artifact_count: result.artifacts?.length,
        artifacts: result.artifacts?.map((a: TicketArtifact) => a.artifact_type),
      });

      if (!result.artifacts || result.artifacts.length === 0) {
        console.error('[wizard] No artifacts in response:', result);
        toast.error('No deliverables were generated. Check server logs.');
        return;
      }

      setArtifacts(result.artifacts);
      toast.success(`🎉 ${result.artifacts.length} deliverables generated!`);
    } catch (e) {
      console.error('[wizard] Error in handleGenerateBuild:', e);
      toast.error('Generation failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold">New Build Request</h1>
          <span className="text-xs text-muted-foreground font-medium bg-muted px-2.5 py-1 rounded-full">
            Step {step} of 3
          </span>
        </div>
        <div className="relative">
          <Progress value={(step / 3) * 100} className="h-1.5" />
          <div className="flex mt-2">
            {STEP_LABELS.map((label, i) => {
              const state = i + 1 < step ? 'done' : i + 1 === step ? 'active' : 'pending';
              return (
                <div key={label} className="flex-1 text-center">
                  <span className={cn('text-xs font-medium', {
                    'text-green-600': state === 'done',
                    'text-blue-600': state === 'active',
                    'text-muted-foreground': state === 'pending',
                  })}>
                    {state === 'done' ? '✓ ' : ''}{label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Analyzing overlay */}
      {analyzing && (
        <div className="bg-background rounded-2xl border shadow-sm p-12 flex flex-col items-center gap-5">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center">
              <Sparkles size={28} className="text-blue-600" />
            </div>
            <div className="absolute inset-0 rounded-2xl border-2 border-blue-400 border-t-transparent animate-spin" />
          </div>
          <div className="text-center space-y-2">
            <p className="font-semibold text-lg">Uploading files & analyzing your project</p>
            <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              <span>{analyzingStatus || 'Please wait...'}</span>
            </div>
            <p className="text-xs text-muted-foreground">This takes 10–30 seconds</p>
          </div>
        </div>
      )}

      {/* Step content */}
      {!analyzing && (
        <div className="bg-background rounded-2xl border shadow-sm p-6">
          {step === 1 && (
            <TicketWizardStep1
              data={step1}
              onChange={setStep1}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <TicketWizardStep2
              data={step2}
              onChange={setStep2}
              onNext={handleStep2Next}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && ticketId && (
            <TicketWizardStep3
              ticketId={ticketId}
              summary={summary}
              understanding={understanding}
              questions={questions}
              artifacts={artifacts}
              readyToBuild={readyToBuild}
              reAnalyzing={reAnalyzing}
              onBack={() => setStep(2)}
              onAnswersSubmitted={handleAnswersSubmitted}
              onGenerateBuild={handleGenerateBuild}
              isGenerating={isGenerating}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Auto-categorize uploaded file based on name/type */
function guessCategory(name: string, mimeType: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('sow') || lower.includes('statement-of-work')) return 'sow';
  if (lower.includes('spec') || lower.includes('requirement') || lower.includes('brief')) return 'specs';
  if (mimeType.startsWith('image/')) return 'screenshots';
  if (lower.endsWith('.csv') || lower.includes('data') || lower.includes('export')) return 'data';
  if (lower.includes('transcript') || lower.includes('call') || lower.includes('meeting')) return 'transcript';
  return 'other';
}
