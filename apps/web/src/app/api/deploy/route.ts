import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { deployToN8n } from '@/lib/deploy/n8n-deployer';
import { deployToMake } from '@/lib/deploy/make-deployer';
import { deployToZapier } from '@/lib/deploy/zapier-deployer';
import { sendEmail, deploymentCompleteHtml } from '@/lib/email/notifications';

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/deploy
 * Body: { ticket_id: string }
 *
 * Fetches the workflow_json artifact, deploys to the ticket's platform,
 * creates a deployments row, updates ticket status, sends email.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ticket_id } = body as { ticket_id: string };

    if (!ticket_id) {
      return NextResponse.json({ error: 'ticket_id is required' }, { status: 400 });
    }

    // ── 1. Fetch ticket ──────────────────────────────────────────────────────
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticket_id)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (ticket.status !== 'APPROVED') {
      return NextResponse.json(
        { error: `Ticket must be APPROVED to deploy. Current status: ${ticket.status}` },
        { status: 422 }
      );
    }

    // ── 2. Fetch workflow_json artifact ──────────────────────────────────────
    const { data: artifacts, error: artifactError } = await supabase
      .from('ticket_artifacts')
      .select('*')
      .eq('ticket_id', ticket_id)
      .eq('artifact_type', 'workflow_json')
      .order('version', { ascending: false })
      .limit(1);

    if (artifactError || !artifacts?.length) {
      return NextResponse.json({ error: 'No workflow JSON artifact found for this ticket' }, { status: 404 });
    }

    const artifact = artifacts[0];

    // ── 3. Download workflow JSON from storage ───────────────────────────────
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('ticket-files')
      .download(artifact.file_path);

    if (downloadError || !fileData) {
      return NextResponse.json({ error: 'Failed to download workflow JSON from storage' }, { status: 500 });
    }

    const rawJson = await (fileData as Blob).text();
    let workflowJson: Record<string, unknown>;
    try {
      workflowJson = JSON.parse(rawJson);
    } catch {
      return NextResponse.json({ error: 'Workflow JSON artifact is not valid JSON' }, { status: 422 });
    }

    // ── 4. Load deploy config from org settings ──────────────────────────────
    let deployConfig: Record<string, unknown> = {};

    // Try fetching from org settings if org_id is on the ticket
    if (ticket.org_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', ticket.org_id)
        .single();

      deployConfig = (org?.settings?.deploy ?? {}) as Record<string, unknown>;
    }

    // Fallback to environment variables for backward compatibility
    const n8nConfig = (deployConfig.n8n as { instanceUrl?: string; apiKey?: string }) ?? {};
    const makeConfig = (deployConfig.make as { apiToken?: string; teamId?: number; folderId?: number }) ?? {};
    const zapierConfig = { mode: 'manual' as const };

    // ── 5. Deploy by platform ────────────────────────────────────────────────
    const platform = ticket.ticket_type;
    let deployResult;

    if (platform === 'n8n') {
      deployResult = await deployToN8n(workflowJson, {
        instanceUrl: n8nConfig.instanceUrl ?? process.env.N8N_INSTANCE_URL ?? '',
        apiKey: n8nConfig.apiKey ?? process.env.N8N_API_KEY ?? '',
      });
    } else if (platform === 'make') {
      deployResult = await deployToMake(workflowJson, {
        apiToken: makeConfig.apiToken ?? process.env.MAKE_API_TOKEN ?? '',
        teamId: Number(makeConfig.teamId ?? process.env.MAKE_TEAM_ID ?? 0),
        folderId: makeConfig.folderId ? Number(makeConfig.folderId) : undefined,
      });
    } else if (platform === 'zapier') {
      deployResult = await deployToZapier(workflowJson, zapierConfig);
    } else {
      return NextResponse.json({ error: `Unsupported platform: ${platform}` }, { status: 400 });
    }

    // ── 6. Create deployment record ──────────────────────────────────────────
    const { data: deployment, error: deployInsertError } = await supabase
      .from('deployments')
      .insert({
        ticket_id,
        platform,
        status: deployResult.success ? 'deployed' : 'failed',
        external_id: (deployResult as { workflowId?: string; scenarioId?: string }).workflowId
          ?? (deployResult as { workflowId?: string; scenarioId?: string }).scenarioId
          ?? null,
        external_url: (deployResult as { url?: string }).url ?? null,
        deploy_type: (deployResult as { type?: string }).type ?? 'api',
        instructions: (deployResult as { instructions?: string }).instructions ?? null,
        error_message: deployResult.error ?? null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (deployInsertError) {
      console.warn('[deploy] Could not insert deployment row:', deployInsertError.message);
    }

    // ── 7. Update ticket status if successful ────────────────────────────────
    if (deployResult.success) {
      await supabase
        .from('tickets')
        .update({ status: 'DEPLOYED', updated_at: new Date().toISOString() })
        .eq('id', ticket_id);

      // Log activity (best-effort)
      void Promise.resolve(
        supabase.from('activity_events').insert({
          ticket_id,
          event_type: 'deployed',
          payload: {
            platform,
            external_url: (deployResult as { url?: string }).url ?? null,
            deploy_type: (deployResult as { type?: string }).type ?? 'api',
          },
          created_at: new Date().toISOString(),
        })
      );

      // Send deployment email (best-effort)
      if (ticket.contact_email) {
        const html = deploymentCompleteHtml(ticket, {
          id: deployment?.id,
          external_url: (deployResult as { url?: string }).url,
          platform,
        });
        await sendEmail({
          to: ticket.contact_email,
          subject: `[Manage AI] Your ${platform.toUpperCase()} workflow has been deployed!`,
          html,
          ticket_id,
        }).catch((e) => console.error('[deploy] Email send failed:', e));
      }
    }

    return NextResponse.json({
      success: deployResult.success,
      deployment_id: deployment?.id ?? null,
      status: deployResult.success ? 'deployed' : 'failed',
      platform,
      external_url: (deployResult as { url?: string }).url ?? null,
      deploy_type: (deployResult as { type?: string }).type ?? 'api',
      instructions: (deployResult as { instructions?: string }).instructions ?? null,
      error: deployResult.error ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
