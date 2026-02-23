import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, statusChangedHtml } from '@/lib/email/notifications';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ApprovalAction = 'approve' | 'reject' | 'request_revision';

const ACTION_STATUS_MAP: Record<ApprovalAction, string> = {
  approve: 'APPROVED',
  reject: 'BUILDING',
  request_revision: 'REVIEW_PENDING',
};

/**
 * POST /api/tickets/[id]/approve
 * Body: { action: 'approve' | 'reject' | 'request_revision', comments: string }
 *
 * - approve → APPROVED, email contact
 * - reject  → BUILDING (send back to build), email with comments
 * - request_revision → stays REVIEW_PENDING, email contact with revision request
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params;

    const body = await req.json();
    const { action, comments } = body as { action: ApprovalAction; comments?: string };

    if (!action || !['approve', 'reject', 'request_revision'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be one of: approve, reject, request_revision' },
        { status: 400 }
      );
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

    if (ticket.status !== 'REVIEW_PENDING') {
      return NextResponse.json(
        { error: `Ticket must be in REVIEW_PENDING status to approve/reject. Current: ${ticket.status}` },
        { status: 422 }
      );
    }

    const newStatus = ACTION_STATUS_MAP[action];
    const previousStatus = ticket.status;

    // Create approval record
    const { data: approval, error: approvalError } = await supabase
      .from('ticket_approvals')
      .insert({
        ticket_id: ticketId,
        action,
        comments: comments ?? null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (approvalError) {
      console.warn('[approve] Could not insert ticket_approvals row:', approvalError.message);
      // Non-fatal — proceed even if the table doesn't exist yet
    }

    // Update ticket status
    const updatePayload: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (action === 'approve') {
      updatePayload.approved_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('tickets')
      .update(updatePayload)
      .eq('id', ticketId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Log activity event (best-effort)
    void Promise.resolve(
      supabase.from('activity_events').insert({
        ticket_id: ticketId,
        event_type: `approval_${action}`,
        payload: { from: previousStatus, to: newStatus, action, comments: comments ?? null },
        created_at: new Date().toISOString(),
      })
    );

    // Send email notification (best-effort)
    if (ticket.contact_email) {
      let subject: string;

      if (action === 'approve') {
        subject = `[Manage AI] Your build has been approved — ${ticket.project_name ?? ticket.company_name}`;
      } else if (action === 'reject') {
        subject = `[Manage AI] Build sent back for revision — ${ticket.project_name ?? ticket.company_name}`;
      } else {
        subject = `[Manage AI] Revision requested — ${ticket.project_name ?? ticket.company_name}`;
      }

      const html = statusChangedHtml(ticket, previousStatus, newStatus, comments);
      await sendEmail({
        to: ticket.contact_email,
        subject,
        html,
        ticket_id: ticketId,
      }).catch((e) => console.error('[approve] Email send failed:', e));
    }

    return NextResponse.json({
      success: true,
      action,
      status: newStatus,
      previous: previousStatus,
      approval_id: approval?.id ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
