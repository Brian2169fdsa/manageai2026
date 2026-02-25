import { createClient } from '@supabase/supabase-js';

// Lazy-initialised so the module can be imported at build time without env vars
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ── Shared HTML helpers ────────────────────────────────────────────────────────

function emailWrapper(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F8F9FB; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); overflow: hidden; }
  .header { background: #1A1A2E; padding: 28px 32px; }
  .header-title { color: #fff; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; margin: 0; }
  .header-sub { color: #8892b0; font-size: 13px; margin: 4px 0 0; }
  .body { padding: 32px; color: #1A1A2E; }
  .body h2 { font-size: 22px; margin: 0 0 8px; }
  .body p { font-size: 15px; line-height: 1.6; color: #444; margin: 0 0 16px; }
  .info-row { display: flex; gap: 12px; margin-bottom: 8px; }
  .label { font-size: 12px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.5px; min-width: 110px; }
  .value { font-size: 14px; color: #1A1A2E; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .badge-blue { background: #EBF4FF; color: #4A8FD6; }
  .badge-green { background: #EAFAF1; color: #27AE60; }
  .badge-orange { background: #FEF3E2; color: #E67E22; }
  .badge-red { background: #FDECEA; color: #E74C3C; }
  .btn { display: inline-block; padding: 12px 28px; background: #4A8FD6; color: #fff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; margin-top: 8px; }
  .divider { border: none; border-top: 1px solid #F0F0F0; margin: 24px 0; }
  .footer { padding: 20px 32px; background: #F8F9FB; border-top: 1px solid #F0F0F0; color: #888; font-size: 12px; text-align: center; }
  .comments-box { background: #F8F9FB; border-left: 4px solid #4A8FD6; padding: 16px; border-radius: 0 8px 8px 0; font-size: 14px; color: #333; line-height: 1.6; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <p class="header-title">MANAGE AI</p>
    <p class="header-sub">Automation Intelligence Platform</p>
  </div>
  <div class="body">
    ${bodyHtml}
  </div>
  <div class="footer">
    You're receiving this because you have an active ticket on Manage AI. <br>
    Questions? Reply to this email or contact your account manager.
  </div>
</div>
</body>
</html>`;
}

function infoRow(label: string, value: string): string {
  return `<div class="info-row"><span class="label">${label}</span><span class="value">${value}</span></div>`;
}

// ── Email Templates ────────────────────────────────────────────────────────────

interface Ticket {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  project_name?: string | null;
  ticket_type: string;
  status: string;
  priority?: string | null;
}

interface Deployment {
  id?: string;
  external_url?: string;
  platform?: string;
}

export function ticketSubmittedHtml(ticket: Ticket): string {
  return emailWrapper(
    'Build Request Received',
    `<h2>We've received your build request</h2>
    <p>Thanks ${ticket.contact_name}! Our AI is about to analyze your project requirements. We'll send you another email when the analysis is complete — usually within a few minutes.</p>
    <hr class="divider">
    ${infoRow('Company', ticket.company_name)}
    ${infoRow('Project', ticket.project_name ?? 'Automation Project')}
    ${infoRow('Platform', ticket.ticket_type.toUpperCase())}
    ${infoRow('Priority', ticket.priority ?? 'medium')}
    ${infoRow('Status', '<span class="badge badge-blue">Submitted</span>')}
    <hr class="divider">
    <p style="font-size:13px;color:#888;">Ticket ID: ${ticket.id}</p>`
  );
}

export function analysisCompleteHtml(ticket: Ticket): string {
  return emailWrapper(
    'AI Analysis Complete — Action Required',
    `<h2>AI has analyzed your project</h2>
    <p>Good news, ${ticket.contact_name}! Our AI has reviewed your requirements for <strong>${ticket.project_name ?? ticket.company_name}</strong> and may have some clarifying questions before we start building.</p>
    <p>Please log in to review the AI's understanding and answer any questions so we can start building your automation.</p>
    <hr class="divider">
    ${infoRow('Company', ticket.company_name)}
    ${infoRow('Project', ticket.project_name ?? 'Automation Project')}
    ${infoRow('Platform', ticket.ticket_type.toUpperCase())}
    ${infoRow('Status', '<span class="badge badge-orange">Questions Pending</span>')}
    <hr class="divider">
    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://manageai.app'}/dashboard/tickets/${ticket.id}" class="btn">Review & Answer Questions →</a>`
  );
}

export function buildCompleteHtml(ticket: Ticket): string {
  return emailWrapper(
    'Your Deliverables Are Ready',
    `<h2>Your build is complete 🎉</h2>
    <p>Hi ${ticket.contact_name}, great news! Your automation deliverables for <strong>${ticket.project_name ?? ticket.company_name}</strong> are ready for review.</p>
    <p>Your package includes:</p>
    <ul style="font-size:15px;line-height:2;color:#444;padding-left:20px;">
      <li><strong>Build Plan</strong> — step-by-step implementation guide</li>
      <li><strong>Solution Demo</strong> — interactive walkthrough of your automation</li>
      <li><strong>Workflow JSON</strong> — ready to import into ${ticket.ticket_type.toUpperCase()}</li>
    </ul>
    <hr class="divider">
    ${infoRow('Company', ticket.company_name)}
    ${infoRow('Project', ticket.project_name ?? 'Automation Project')}
    ${infoRow('Platform', ticket.ticket_type.toUpperCase())}
    ${infoRow('Status', '<span class="badge badge-orange">Awaiting Review</span>')}
    <hr class="divider">
    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://manageai.app'}/dashboard/tickets/${ticket.id}" class="btn">View Deliverables →</a>`
  );
}

export function approvalRequiredHtml(ticket: Ticket, reviewer: { name: string; email: string }): string {
  return emailWrapper(
    `Build #${ticket.id.slice(0, 8)} Needs Your Approval`,
    `<h2>A build needs your approval</h2>
    <p>Hi ${reviewer.name}, a completed build for <strong>${ticket.project_name ?? ticket.company_name}</strong> is awaiting your approval before it can be deployed.</p>
    <hr class="divider">
    ${infoRow('Company', ticket.company_name)}
    ${infoRow('Project', ticket.project_name ?? 'Automation Project')}
    ${infoRow('Platform', ticket.ticket_type.toUpperCase())}
    ${infoRow('Priority', ticket.priority ?? 'medium')}
    ${infoRow('Status', '<span class="badge badge-orange">Review Pending</span>')}
    <hr class="divider">
    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://manageai.app'}/dashboard/tickets/${ticket.id}" class="btn">Review & Approve →</a>`
  );
}

export function deploymentCompleteHtml(ticket: Ticket, deployment: Deployment): string {
  return emailWrapper(
    'Your Workflow Has Been Deployed',
    `<h2>Deployment successful 🚀</h2>
    <p>Hi ${ticket.contact_name}, your <strong>${ticket.project_name ?? ticket.company_name}</strong> automation has been deployed and is now live!</p>
    ${deployment.external_url ? `<p><strong>Live URL:</strong> <a href="${deployment.external_url}" style="color:#4A8FD6;">${deployment.external_url}</a></p>` : ''}
    <hr class="divider">
    ${infoRow('Company', ticket.company_name)}
    ${infoRow('Project', ticket.project_name ?? 'Automation Project')}
    ${infoRow('Platform', ticket.ticket_type.toUpperCase())}
    ${infoRow('Status', '<span class="badge badge-green">Deployed</span>')}
    <hr class="divider">
    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://manageai.app'}/dashboard/tickets/${ticket.id}" class="btn">View Deployment Details →</a>`
  );
}

export function statusChangedHtml(ticket: Ticket, oldStatus: string, newStatus: string, comments?: string): string {
  const statusBadge = newStatus === 'APPROVED' ? 'badge-green'
    : newStatus === 'DEPLOYED' ? 'badge-green'
    : newStatus === 'BUILDING' ? 'badge-blue'
    : newStatus === 'REVIEW_PENDING' ? 'badge-orange'
    : newStatus === 'CLOSED' ? 'badge-red'
    : 'badge-blue';

  return emailWrapper(
    `Ticket Status Updated — ${newStatus.replace('_', ' ')}`,
    `<h2>Status Update</h2>
    <p>Hi ${ticket.contact_name}, the status of your build request for <strong>${ticket.project_name ?? ticket.company_name}</strong> has been updated.</p>
    <hr class="divider">
    ${infoRow('Company', ticket.company_name)}
    ${infoRow('Project', ticket.project_name ?? 'Automation Project')}
    ${infoRow('Previous Status', oldStatus.replace('_', ' '))}
    ${infoRow('New Status', `<span class="badge ${statusBadge}">${newStatus.replace('_', ' ')}</span>`)}
    ${comments ? `<hr class="divider"><p><strong>Note from reviewer:</strong></p><div class="comments-box">${comments}</div>` : ''}
    <hr class="divider">
    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://manageai.app'}/dashboard/tickets/${ticket.id}" class="btn">View Ticket →</a>`
  );
}

// ── Send Function ──────────────────────────────────────────────────────────────

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  ticket_id?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  const { to, subject, html, ticket_id } = opts;
  const supabase = getSupabase();

  // Always log to DB regardless of whether Resend is configured
  const logRow = {
    to_email: to,
    subject,
    ticket_id: ticket_id ?? null,
    status: 'pending',
    sent_at: null as string | null,
    error: null as string | null,
  };

  let logId: string | null = null;

  const { data: logData } = await supabase
    .from('email_notifications')
    .insert(logRow)
    .select('id')
    .single();
  logId = logData?.id ?? null;

  if (!process.env.RESEND_API_KEY) {
    console.log(`[email] RESEND_API_KEY not set — logging only. To: ${to} | Subject: ${subject}`);
    if (logId) {
      await supabase
        .from('email_notifications')
        .update({ status: 'logged_only', sent_at: new Date().toISOString() })
        .eq('id', logId);
    }
    return { success: true };
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? 'Manage AI <noreply@manageai.app>',
      to,
      subject,
      html,
    });

    if (error) {
      console.error('[email] Resend send error:', error);
      if (logId) {
        await supabase
          .from('email_notifications')
          .update({ status: 'failed', error: String(error) })
          .eq('id', logId);
      }
      return { success: false, error: String(error) };
    }

    if (logId) {
      await supabase
        .from('email_notifications')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', logId);
    }

    console.log(`[email] Sent successfully to ${to}: ${subject}`);
    return { success: true };
  } catch (err) {
    const message = (err as Error).message;
    console.error('[email] Exception:', message);
    if (logId) {
      await supabase
        .from('email_notifications')
        .update({ status: 'failed', error: message })
        .eq('id', logId);
    }
    return { success: false, error: message };
  }
}
