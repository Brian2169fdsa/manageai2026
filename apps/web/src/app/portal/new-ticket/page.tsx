'use client';
import { useState } from 'react';
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
  const [step, setStep] = useState(1);
  const [step1, setStep1] = useState<WizardStep1Data>(defaultStep1);
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

  async function handleStep2Next() {
    setAnalyzing(true);
    try {
      // 1. Create ticket
      const { data: { user } } = await supabase.auth.getUser();
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          company_name: step1.company_name,
          contact_name: step1.contact_name,
          contact_email: step1.contact_email,
          project_name: step1.project_name,
          ticket_type: step1.ticket_type,
          what_to_build: step1.what_to_build,
          expected_outcome: step1.expected_outcome,
          priority: step1.priority,
          status: 'ANALYZING',
          created_by: user?.id,
        })
        .select()
        .single();

      if (ticketError || !ticket) {
        toast.error('Failed to create ticket: ' + ticketError?.message);
        return;
      }

      setTicketId(ticket.id);

      // 2. Upload files
      for (const file of step2.files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${ticket.id}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('ticket-files')
          .upload(filePath, file);

        if (uploadError) {
          console.warn('File upload error:', uploadError.message);
        } else {
          await supabase.from('ticket_assets').insert({
            ticket_id: ticket.id,
            asset_type: 'file',
            file_name: file.name,
            file_path: filePath,
            mime_type: file.type,
            file_size: file.size,
          });
        }
      }

      // 3. Save transcript
      if (step2.transcript.trim()) {
        const transcriptPath = `${ticket.id}/transcript-${Date.now()}.txt`;
        const blob = new Blob([step2.transcript], { type: 'text/plain' });
        await supabase.storage.from('ticket-files').upload(transcriptPath, blob);
        await supabase.from('ticket_assets').insert({
          ticket_id: ticket.id,
          asset_type: 'transcript',
          file_name: 'transcript.txt',
          file_path: transcriptPath,
          category: 'transcript',
        });
      }

      // 4. Save links
      for (const link of step2.links) {
        await supabase.from('ticket_assets').insert({
          ticket_id: ticket.id,
          asset_type: 'link',
          external_url: link,
          category: 'other',
        });
      }

      // 5. AI analysis
      const res = await fetch('/api/analyze-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticket.id,
          transcript: step2.transcript,
          links: step2.links,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        toast.error('AI analysis failed: ' + err);
        return;
      }

      const result = await res.json();
      setSummary(result.summary ?? '');
      setUnderstanding(result.understanding ?? '');
      setQuestions(result.questions ?? []);
      setReadyToBuild(result.ready_to_build ?? false);
      setStep(3);
    } catch (e) {
      toast.error('Something went wrong. Please try again.');
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleAnswersSubmitted(answered: AIQuestion[]) {
    if (!ticketId) return;
    setReAnalyzing(true);
    try {
      const res = await fetch('/api/analyze-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticketId,
          answers: answered,
          transcript: step2.transcript,
        }),
      });

      if (!res.ok) {
        toast.error('Failed to re-analyze. Try again.');
        return;
      }

      const result = await res.json();
      setSummary(result.summary ?? summary);
      setUnderstanding(result.understanding ?? understanding);
      setQuestions(result.questions ?? []);
      setReadyToBuild(result.ready_to_build ?? false);

      if (result.ready_to_build) {
        toast.success('Great! AI has enough context to build. Click "Generate Deliverables".');
      } else {
        toast.info('AI has a few more questions.');
      }
    } catch (e) {
      toast.error('Something went wrong.');
      console.error(e);
    } finally {
      setReAnalyzing(false);
    }
  }

  async function handleGenerateBuild() {
    if (!ticketId) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId }),
      });

      if (!res.ok) {
        const err = await res.text();
        toast.error('Build generation failed: ' + err);
        return;
      }

      const result = await res.json();
      if (result.artifacts?.length) {
        setArtifacts(result.artifacts);
        toast.success('🎉 All 3 deliverables generated!');
      } else {
        toast.error('No artifacts returned. Check logs.');
      }
    } catch (e) {
      toast.error('Something went wrong during build generation.');
      console.error(e);
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

        {/* Step indicator */}
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

      {/* Initial analyzing overlay */}
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
              <span>AI is reviewing your requirements... (10–30s)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {step2.files.length > 0 && `Uploading ${step2.files.length} file${step2.files.length > 1 ? 's' : ''} · `}
              Calling Claude AI
            </p>
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
