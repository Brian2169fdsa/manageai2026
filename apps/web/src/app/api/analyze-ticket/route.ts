import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, analysisCompleteHtml } from '@/lib/email/notifications';

// Allow up to 5 minutes for AI analysis
export const maxDuration = 300;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** Robustly extract JSON from Claude's response, which may include markdown fences */
function extractJson(raw: string): Record<string, unknown> {
  console.log('[analyze-ticket] Raw Claude response (first 500 chars):', raw.slice(0, 500));
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : raw.trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    console.error('[analyze-ticket] Could not find JSON object in response');
    return {};
  }
  const jsonStr = candidate.slice(start, end + 1);
  try {
    const parsed = JSON.parse(jsonStr);
    console.log('[analyze-ticket] Parsed JSON keys:', Object.keys(parsed));
    return parsed;
  } catch (e) {
    console.error('[analyze-ticket] JSON.parse failed:', e);
    return {};
  }
}

/** Download and extract text from a Supabase Storage file (text-based files and PDFs) */
async function extractFileText(filePath: string, mimeType?: string | null): Promise<string | null> {
  const textMimes = ['text/plain', 'text/csv', 'text/html', 'application/json', 'text/markdown', 'text/'];
  const textExts = ['.txt', '.csv', '.json', '.md', '.xml', '.yaml', '.yml', '.log'];
  const isPdf = mimeType === 'application/pdf' || filePath.toLowerCase().endsWith('.pdf');
  const isLikelyText =
    textMimes.some((m) => mimeType?.startsWith(m)) ||
    textExts.some((ext) => filePath.toLowerCase().endsWith(ext));

  if (!isPdf && !isLikelyText) return null;

  const supabase = getSupabase();
  try {
    const { data, error } = await supabase.storage.from('ticket-files').download(filePath);
    if (error || !data) return null;

    if (isPdf) {
      const uint8Array = new Uint8Array(await (data as Blob).arrayBuffer());
      // Dynamic import avoids Next.js static-analysis issues with heavy PDF libraries
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: uint8Array });
      const textResult = await parser.getText();
      await parser.destroy();
      const text = textResult.text.trim();
      console.log('[analyze-ticket] PDF extracted:', filePath, text.length, 'chars');
      return text.slice(0, 8000); // Cap at 8KB per file
    }

    const text = await (data as Blob).text();
    return text.slice(0, 8000); // Cap at 8KB per file to avoid overwhelming context
  } catch (err) {
    console.error('[analyze-ticket] extractFileText error for', filePath, ':', (err as Error).message);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  console.log('\n========== [analyze-ticket] POST called ==========');
  console.log('[analyze-ticket] ANTHROPIC_API_KEY exists:', !!process.env.ANTHROPIC_API_KEY);
  console.log('[analyze-ticket] NEXT_PUBLIC_SUPABASE_URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('[analyze-ticket] SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log('[analyze-ticket] NEXT_PUBLIC_SUPABASE_ANON_KEY exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch (e) {
      console.error('[analyze-ticket] Failed to parse request body:', e);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { ticket_id, transcript, links, answers } = body as {
      ticket_id: string;
      transcript?: string;
      links?: string[];
      answers?: Array<{ id: string; question: string; answer: string; category: string }>;
    };

    console.log('[analyze-ticket] ticket_id:', ticket_id);
    console.log('[analyze-ticket] has transcript:', !!transcript);
    console.log('[analyze-ticket] links count:', links?.length ?? 0);
    console.log('[analyze-ticket] answers count:', answers?.length ?? 0);

    if (!ticket_id) {
      return NextResponse.json({ error: 'ticket_id is required' }, { status: 400 });
    }

    // ── 1. Fetch ticket ──────────────────────────────────────────────────────
    console.log('[analyze-ticket] Fetching ticket from Supabase...');
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticket_id)
      .single();

    if (ticketError) {
      console.error('[analyze-ticket] Ticket fetch error:', ticketError);
      return NextResponse.json({ error: 'Ticket not found: ' + ticketError.message }, { status: 404 });
    }
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    console.log('[analyze-ticket] Ticket fetched:', {
      id: ticket.id,
      company: ticket.company_name,
      type: ticket.ticket_type,
      what_to_build: ticket.what_to_build?.slice(0, 80),
    });

    // ── 2. Fetch all uploaded assets ─────────────────────────────────────────
    console.log('[analyze-ticket] Fetching ticket assets...');
    const { data: assets } = await supabase
      .from('ticket_assets')
      .select('*')
      .eq('ticket_id', ticket_id)
      .order('created_at');

    console.log('[analyze-ticket] Found', assets?.length ?? 0, 'assets');

    // ── 3. If answers provided, persist them to ai_questions ─────────────────
    if (answers && answers.length > 0) {
      console.log('[analyze-ticket] Persisting answered questions to DB...');
      const { error: saveErr } = await supabase
        .from('tickets')
        .update({ ai_questions: answers, updated_at: new Date().toISOString() })
        .eq('id', ticket_id);
      if (saveErr) {
        console.error('[analyze-ticket] Failed to save answers:', saveErr);
      } else {
        console.log('[analyze-ticket] Answers saved to ai_questions');
      }
    }

    // ── 4. Build context message ─────────────────────────────────────────────
    const contextParts: string[] = [
      `=== PROJECT DETAILS ===`,
      `Company: ${ticket.company_name}`,
      `Contact: ${ticket.contact_name} (${ticket.contact_email})`,
      `Project Name: ${ticket.project_name || 'Not provided'}`,
      `Build Platform: ${ticket.ticket_type}`,
      `Priority: ${ticket.priority}`,
      ``,
      `=== WHAT NEEDS TO BE BUILT ===`,
      ticket.what_to_build || 'Not specified',
      ``,
      `=== EXPECTED OUTCOME ===`,
      ticket.expected_outcome || 'Not specified',
    ];

    // Inline transcript from request body
    if (transcript && transcript.trim()) {
      contextParts.push(`\n=== TRANSCRIPT / NOTES ===\n${transcript.trim().slice(0, 10000)}`);
    }

    // Inline links from request body
    if (links && links.length > 0) {
      contextParts.push(`\n=== REFERENCE LINKS ===\n${links.join('\n')}`);
    }

    // ── 5. Download and include uploaded file contents ────────────────────────
    if (assets && assets.length > 0) {
      const fileAssets = assets.filter(
        (a) => (a.asset_type === 'file' || a.asset_type === 'transcript') && a.file_path
      );
      const linkAssets = assets.filter((a) => a.asset_type === 'link' && a.external_url);

      if (fileAssets.length > 0) {
        contextParts.push(`\n=== UPLOADED DOCUMENTS (${fileAssets.length} files) ===`);
        console.log('[analyze-ticket] Downloading', fileAssets.length, 'file assets...');

        const fileContents = await Promise.all(
          fileAssets.map(async (asset) => {
            const text = await extractFileText(asset.file_path!, asset.mime_type);
            if (text) {
              console.log('[analyze-ticket] Extracted text from:', asset.file_name, text.length, 'chars');
              return `--- ${asset.file_name} (${asset.category}) ---\n${text}`;
            } else {
              console.log('[analyze-ticket] Could not extract text from:', asset.file_name, '(unsupported binary)');
              return `--- ${asset.file_name} (${asset.category}) --- [Uploaded document — binary format, filename only]`;
            }
          })
        );

        fileContents.forEach((c) => contextParts.push(c));
      }

      if (linkAssets.length > 0) {
        contextParts.push(`\n=== REFERENCE LINKS ===`);
        linkAssets.forEach((a) => contextParts.push(a.external_url!));
      }
    }

    // ── 6. Include previous Q&A answers ─────────────────────────────────────
    if (answers && answers.length > 0) {
      contextParts.push('\n=== ANSWERS TO CLARIFYING QUESTIONS ===');
      answers.forEach((a, i) => {
        contextParts.push(`Q${i + 1} [${a.category}]: ${a.question}`);
        contextParts.push(`A${i + 1}: ${a.answer || '(no answer provided)'}`);
      });
    }

    const userMessage = contextParts.join('\n');
    console.log('[analyze-ticket] Context message length:', userMessage.length, 'chars');

    // ── 7. Call Claude ───────────────────────────────────────────────────────
    console.log('[analyze-ticket] Calling Claude API (claude-sonnet-4-6)...');
    const startTime = Date.now();

    let rawText: string;
    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: `You are an expert AI automation architect at ManageAI. You specialize in building n8n, Make.com, and Zapier workflows for businesses.

A client has submitted a build request. You have access to ALL their uploaded documents, transcripts, and reference materials. Analyze everything carefully.

Respond with ONLY a valid JSON object — no markdown, no explanation, no code fences. Just the raw JSON.

The JSON must have exactly this structure:
{
  "summary": "2-3 sentence overview of what they need",
  "understanding": "Detailed paragraph explaining the trigger, data flow, systems involved, and what you believe they need built — reference specific details from their documents",
  "questions": [
    {"id": "q1", "question": "Specific question text", "category": "technical"},
    {"id": "q2", "question": "Specific question text", "category": "business"}
  ],
  "ready_to_build": false,
  "recommended_platform": "n8n",
  "complexity_estimate": "moderate",
  "risk_flags": ["list of potential issues or blockers"]
}

Rules:
- If you have enough information to build without clarification, set ready_to_build to true and return an empty questions array
- If answers were provided to previous questions and they are sufficient, set ready_to_build to true
- Ask at most 5 specific, actionable questions — only what you truly need to build
- complexity_estimate must be one of: "simple", "moderate", "complex", "very complex"
- recommended_platform must be one of: "n8n", "make", "zapier"
- Return ONLY the JSON object, nothing else`,
        messages: [{ role: 'user', content: userMessage }],
      });

      rawText = message.content[0].type === 'text' ? message.content[0].text : '{}';
      console.log('[analyze-ticket] Claude responded in', Date.now() - startTime, 'ms');
      console.log('[analyze-ticket] Response length:', rawText.length, 'chars');
      console.log('[analyze-ticket] Stop reason:', message.stop_reason);
    } catch (claudeErr) {
      console.error('[analyze-ticket] Claude API error:', claudeErr);
      return NextResponse.json(
        { error: 'Claude API call failed: ' + (claudeErr as Error).message },
        { status: 502 }
      );
    }

    // ── 8. Parse response ────────────────────────────────────────────────────
    const result = extractJson(rawText);

    const safeResult = {
      summary: (result.summary as string) || 'Analysis complete.',
      understanding: (result.understanding as string) || 'Processing your requirements.',
      questions: (result.questions as Array<{ id: string; question: string; category: string }>) || [],
      ready_to_build: Boolean(result.ready_to_build),
      recommended_platform: (result.recommended_platform as string) || ticket.ticket_type,
      complexity_estimate: (result.complexity_estimate as string) || 'moderate',
      risk_flags: (result.risk_flags as string[]) || [],
    };

    console.log('[analyze-ticket] Analysis result:', {
      summary_length: safeResult.summary.length,
      questions_count: safeResult.questions.length,
      ready_to_build: safeResult.ready_to_build,
      complexity: safeResult.complexity_estimate,
    });

    // ── 9. Update ticket in DB ───────────────────────────────────────────────
    console.log('[analyze-ticket] Updating ticket in Supabase...');
    const newStatus = safeResult.ready_to_build ? 'BUILDING' : 'QUESTIONS_PENDING';

    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        ai_summary: safeResult.summary,
        ai_understanding: safeResult.understanding,
        ai_questions: safeResult.questions,
        ready_to_build: safeResult.ready_to_build,
        recommended_platform: safeResult.recommended_platform,
        complexity_estimate: safeResult.complexity_estimate,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket_id);

    if (updateError) {
      console.error('[analyze-ticket] DB update error:', updateError);
    } else {
      console.log('[analyze-ticket] Ticket updated. New status:', newStatus);
    }

    // Send analysis-complete email (best-effort)
    if (ticket.contact_email) {
      const html = analysisCompleteHtml({
        ...ticket,
        status: newStatus,
      });
      sendEmail({
        to: ticket.contact_email,
        subject: `[Manage AI] AI Analysis Ready — ${ticket.project_name ?? ticket.company_name}`,
        html,
        ticket_id,
      }).catch((e) => console.error('[analyze-ticket] Email send failed:', e));
    }

    console.log('[analyze-ticket] Done. Returning result to client.');
    return NextResponse.json(safeResult);
  } catch (outerErr) {
    console.error('[analyze-ticket] UNHANDLED ERROR:', outerErr);
    console.error('[analyze-ticket] Stack:', outerErr instanceof Error ? outerErr.stack : String(outerErr));
    return NextResponse.json(
      { error: 'Internal server error: ' + (outerErr instanceof Error ? outerErr.message : String(outerErr)) },
      { status: 500 }
    );
  }
}
