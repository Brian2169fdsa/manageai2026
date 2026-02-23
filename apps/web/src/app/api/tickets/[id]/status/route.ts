import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, statusChangedHtml } from '@/lib/email/notifications';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Valid status transitions (state machine)
const VALID_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ['ANALYZING'],
  ANALYZING: ['QUESTIONS_PENDING', 'BUILDING'],
  QUESTIONS_PENDING: ['BUILDING', 'ANALYZING'],
  BUILDING: ['REVIEW_PENDING'],
  REVIEW_PENDING: ['APPROVED', 'BUILDING'],
  APPROVED: ['DEPLOYED'],
  DEPLOYED: ['CLOSED'],
  // Allow re-opening from closed for admins
  CLOSED: ['SUBMITTED'],
};

/**
 * PATCH /api/tickets/[id]/status
 * Body: { status: string, comments?: string }
 * Validates the transition, updates the ticket, logs to activity_events, sends email.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params;

    const body = await req.json();
    const { status: newStatus, comments } = body as { status: string; comments?: string };

    if (!newStatus) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    // Fetch current ticket
    const { data: ticket, error: fetchError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (fetchError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const currentStatus: string = ticket.status;

    // Validate transition
    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status transition: ${currentStatus} → ${newStatus}`,
          allowed_transitions: allowed,
        },
        { status: 422 }
      );
    }

    // Update ticket status
    const { error: updateError } = await supabase
      .from('tickets')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', ticketId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Log to activity_events (best-effort, no failure on error)
    void Promise.resolve(
      supabase.from('activity_events').insert({
        ticket_id: ticketId,
        event_type: 'status_changed',
        payload: { from: currentStatus, to: newStatus, comments: comments ?? null },
        created_at: new Date().toISOString(),
      })
    );

    // Send status-changed email (best-effort)
    if (ticket.contact_email) {
      const html = statusChangedHtml(ticket, currentStatus, newStatus, comments);
      await sendEmail({
        to: ticket.contact_email,
        subject: `[Manage AI] Ticket Status Updated: ${newStatus.replace('_', ' ')}`,
        html,
        ticket_id: ticketId,
      }).catch((e) => console.error('[status-route] Email send failed:', e));
    }

    return NextResponse.json({ success: true, status: newStatus, previous: currentStatus });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
