/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AgentEvent } from '@/lib/events';
import { EVENT_HANDLERS } from '@/lib/events/handlers';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const REACTION_TIMEOUT_MS = 30_000;

// ── Call agent/chat with a timeout ────────────────────────────────────────────

async function callAgentChat(
  department: string,
  prompt: string
): Promise<{ success: boolean; response?: string; error?: string }> {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REACTION_TIMEOUT_MS);

  try {
    const res = await fetch(`${appUrl}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        department,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => `HTTP ${res.status}`);
      return { success: false, error: `agent/chat returned ${res.status}: ${errText.slice(0, 200)}` };
    }

    const data = await res.json();
    return { success: true, response: data.message ?? JSON.stringify(data) };
  } catch (err: any) {
    clearTimeout(timer);
    const isTimeout = err.name === 'AbortError';
    return {
      success: false,
      error: isTimeout ? `timeout after ${REACTION_TIMEOUT_MS}ms` : err.message,
    };
  }
}

// ── POST /api/agent/react ─────────────────────────────────────────────────────

/**
 * Receives an AgentEvent, finds matching handlers in EVENT_HANDLERS,
 * calls /api/agent/chat for each matching toAgent in parallel,
 * logs reactions to activity_events, returns { reacted, total, results }.
 * Never throws — always returns 200.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  let event: AgentEvent;
  try {
    event = (await req.json()) as AgentEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!event.type || !event.toAgents || !Array.isArray(event.toAgents)) {
    return NextResponse.json(
      { error: 'type and toAgents are required' },
      { status: 400 }
    );
  }

  // Find handlers registered for this event type
  const handlers = EVENT_HANDLERS[event.type] ?? [];

  // Filter to handlers whose agentName is in event.toAgents
  const matchingHandlers = handlers.filter((h) =>
    event.toAgents.includes(h.agentName)
  );

  console.log(
    `[agent:react] event=${event.type} toAgents=[${event.toAgents.join(', ')}] ` +
    `handlers_registered=${handlers.length} matched=${matchingHandlers.length}`
  );

  if (matchingHandlers.length === 0) {
    return NextResponse.json({ reacted: 0, total: 0, results: [] });
  }

  // Run all reactions in parallel
  const settled = await Promise.allSettled(
    matchingHandlers.map(async (handler) => {
      const prompt = handler.generateReaction(event);
      console.log(`[agent:react] calling ${handler.agentName} (${handler.department})`);

      const result = await callAgentChat(handler.department, prompt);

      // Log reaction outcome to activity_events (best-effort)
      void Promise.resolve(
        supabase.from('activity_events').insert({
          ticket_id: (event.payload.ticketId as string) ?? null,
          event_type: `agent_reaction.${event.type}`,
          event_message: result.success
            ? (result.response ?? '').slice(0, 500)
            : result.error,
          agent_name: handler.agentName,
          metadata: {
            triggeredBy: event.type,
            fromAgent: event.fromAgent,
            department: handler.department,
            prompt: prompt.slice(0, 200),
            success: result.success,
          },
        })
      );

      if (!result.success) {
        console.warn(
          `[agent:react] ${handler.agentName} reaction failed: ${result.error}`
        );
      } else {
        console.log(
          `[agent:react] ${handler.agentName} reacted (${(result.response ?? '').length} chars)`
        );
      }

      return {
        agent: handler.agentName,
        department: handler.department,
        success: result.success,
        error: result.error,
        responsePreview: result.response
          ? result.response.slice(0, 200)
          : undefined,
      };
    })
  );

  const results = settled.map((r) =>
    r.status === 'fulfilled'
      ? r.value
      : { success: false, error: (r.reason as Error)?.message ?? 'unknown error' }
  );

  const reacted = results.filter((r: any) => r.success).length;

  console.log(
    `[agent:react] ${event.type} complete — ${reacted}/${matchingHandlers.length} reactions succeeded`
  );

  return NextResponse.json({
    reacted,
    total: matchingHandlers.length,
    results,
  });
}
