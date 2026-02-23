import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// Allow up to 5 minutes for AI analysis
export const maxDuration = 300;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** Robustly extract JSON from Claude's response, which may include markdown fences */
function extractJson(raw: string): Record<string, unknown> {
  console.log('[analyze-ticket] Raw Claude response (first 500 chars):', raw.slice(0, 500));

  // Try to strip markdown code fences first
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : raw.trim();

  // Find the outermost JSON object
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
    console.error('[analyze-ticket] JSON string attempted:', jsonStr.slice(0, 300));
    return {};
  }
}

export async function POST(req: NextRequest) {
  console.log('\n========== [analyze-ticket] POST called ==========');

  // ── Env var diagnostics ──────────────────────────────────────────────────
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
    console.error('[analyze-ticket] Ticket is null for id:', ticket_id);
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  console.log('[analyze-ticket] Ticket fetched:', {
    id: ticket.id,
    company: ticket.company_name,
    type: ticket.ticket_type,
    what_to_build: ticket.what_to_build?.slice(0, 80),
  });

  // ── 2. If answers provided, persist them to ai_questions before re-analysis ──
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

  // ── 3. Build context message ─────────────────────────────────────────────
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

  if (transcript && transcript.trim()) {
    contextParts.push(`\n=== TRANSCRIPT / NOTES ===\n${transcript.trim()}`);
  }

  if (links && links.length > 0) {
    contextParts.push(`\n=== REFERENCE LINKS ===\n${links.join('\n')}`);
  }

  if (answers && answers.length > 0) {
    contextParts.push('\n=== ANSWERS TO PREVIOUS QUESTIONS ===');
    answers.forEach((a, i) => {
      contextParts.push(`Q${i + 1}: ${a.question}`);
      contextParts.push(`A${i + 1}: ${a.answer || '(no answer provided)'}`);
    });
  }

  const userMessage = contextParts.join('\n');
  console.log('[analyze-ticket] Context message length:', userMessage.length, 'chars');

  // ── 4. Call Claude ───────────────────────────────────────────────────────
  console.log('[analyze-ticket] Calling Claude API (claude-sonnet-4-6)...');
  const startTime = Date.now();

  let rawText: string;
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `You are an expert AI automation architect at ManageAI. You specialize in building n8n, Make.com, and Zapier workflows for businesses.

A client has submitted a build request. Analyze all provided information carefully and respond with ONLY a valid JSON object — no markdown, no explanation, no code fences. Just the raw JSON.

The JSON must have exactly this structure:
{
  "summary": "2-3 sentence overview of what they need",
  "understanding": "Detailed paragraph explaining the trigger, data flow, systems involved, and what you believe they need built",
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
- Ask at most 5 specific, actionable questions
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

  // ── 5. Parse response ────────────────────────────────────────────────────
  const result = extractJson(rawText);

  // Validate required fields, provide defaults if missing
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

  // ── 6. Update ticket in DB ───────────────────────────────────────────────
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
    // Non-fatal — still return the result to the client
  } else {
    console.log('[analyze-ticket] Ticket updated. New status:', newStatus);
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
