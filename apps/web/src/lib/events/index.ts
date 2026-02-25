/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type EventType =
  | 'deal.closed'
  | 'ticket.submitted'
  | 'ticket.approved'
  | 'ticket.deployed'
  | 'automation.error'
  | 'client.at_risk'
  | 'build.completed'
  | 'build.failed';

export interface AgentEvent {
  type: EventType;
  payload: Record<string, unknown>;
  fromAgent: string;
  toAgents: string[];
  priority: 'urgent' | 'high' | 'normal' | 'low';
}

// ── publishEvent ───────────────────────────────────────────────────────────────

/**
 * Publishes an agent event to the activity_events table.
 * For urgent/high priority events, also triggers /api/agent/react (fire and forget).
 * Never throws — all errors are logged only.
 */
export async function publishEvent(event: AgentEvent): Promise<void> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase.from('activity_events').insert({
      ticket_id: (event.payload.ticketId as string) ?? null,
      event_type: event.type,
      event_message: JSON.stringify(event.payload),
      agent_name: event.fromAgent,
      metadata: {
        toAgents: event.toAgents,
        priority: event.priority,
        payload: event.payload,
      },
    });

    if (error) {
      console.error('[publishEvent] DB insert failed:', error.message, 'event:', event.type);
    } else {
      console.log(`[publishEvent] ${event.type} published from ${event.fromAgent} → [${event.toAgents.join(', ')}]`);
    }

    // For high-priority events, trigger agent reactions immediately (fire and forget)
    if (event.priority === 'urgent' || event.priority === 'high') {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
      fetch(`${appUrl}/api/agent/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      }).catch((e: any) => console.error('[publishEvent] react trigger failed:', e.message));
    }
  } catch (err: any) {
    console.error('[publishEvent] unexpected error:', err.message, 'event:', JSON.stringify(event));
  }
}
