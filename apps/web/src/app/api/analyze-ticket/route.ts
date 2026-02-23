import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { ticket_id, transcript, links, answers } = await req.json();

    if (!ticket_id) {
      return NextResponse.json({ error: 'ticket_id is required' }, { status: 400 });
    }

    // Fetch ticket from DB
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticket_id)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Build user context message
    const contextParts: string[] = [
      `Company: ${ticket.company_name}`,
      `Contact: ${ticket.contact_name} (${ticket.contact_email})`,
      `Project: ${ticket.project_name || 'N/A'}`,
      `Build Platform: ${ticket.ticket_type}`,
      `What to Build: ${ticket.what_to_build || 'Not specified'}`,
      `Expected Outcome: ${ticket.expected_outcome || 'Not specified'}`,
      `Priority: ${ticket.priority}`,
    ];

    if (transcript) {
      contextParts.push(`\nTranscript/Notes:\n${transcript}`);
    }

    if (links?.length) {
      contextParts.push(`\nReference Links:\n${links.join('\n')}`);
    }

    if (answers?.length) {
      contextParts.push('\nAnswers to Previous Questions:');
      answers.forEach((a: { question: string; answer: string }) => {
        if (a.answer) contextParts.push(`Q: ${a.question}\nA: ${a.answer}`);
      });
    }

    const userMessage = contextParts.join('\n');

    const systemPrompt = `You are an expert AI automation architect at ManageAI. You specialize in building
n8n, Make.com, and Zapier workflows for businesses.

A client has submitted a build request. Analyze all provided information and:

1. Provide a clear summary of what they need automated
2. Show your understanding of the trigger, data flow, and systems involved
3. Ask specific clarifying questions if anything is unclear (max 5-8 questions)
4. Assess complexity and recommend the best platform

Respond ONLY with valid JSON:
{
  "summary": "2-3 sentence overview",
  "understanding": "Detailed paragraph of what you believe they need",
  "questions": [
    {"id": "q1", "question": "...", "category": "technical"},
    {"id": "q2", "question": "...", "category": "business"}
  ],
  "ready_to_build": false,
  "recommended_platform": "n8n",
  "complexity_estimate": "moderate",
  "risk_flags": ["needs OAuth setup for Gmail", "rate limiting on API"]
}

If the client has answered all questions or you have enough information to proceed, set ready_to_build to true and return an empty questions array.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const rawText = message.content[0].type === 'text' ? message.content[0].text : '{}';
    // Extract JSON from response (strip any markdown code blocks)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    // Update ticket in DB
    await supabase
      .from('tickets')
      .update({
        ai_summary: result.summary,
        ai_understanding: result.understanding,
        ai_questions: result.questions ?? [],
        ready_to_build: result.ready_to_build ?? false,
        recommended_platform: result.recommended_platform,
        complexity_estimate: result.complexity_estimate,
        status: result.ready_to_build ? 'BUILDING' : 'QUESTIONS_PENDING',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket_id);

    return NextResponse.json(result);
  } catch (error) {
    console.error('analyze-ticket error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
