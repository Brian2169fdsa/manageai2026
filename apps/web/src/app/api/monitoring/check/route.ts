/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkWorkflowHealth } from '@/lib/monitoring/n8n-monitor';
import { checkScenarioHealth } from '@/lib/monitoring/make-monitor';
import { publishEvent } from '@/lib/events';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function isCronAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    const host = request.headers.get('host') ?? '';
    return host.startsWith('localhost') || host.startsWith('127.0.0.1');
  }
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * Hourly cron: checks all deployed automations for health.
 * GET /api/monitoring/check (Vercel Cron)
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  let checked = 0;
  let errors = 0;

  try {
    // Fetch all active automations
    const { data: automations, error: fetchErr } = await supabase
      .from('client_automations')
      .select('*, client_accounts(company_name)')
      .in('status', ['active', 'error']);

    if (fetchErr) {
      console.error('[monitoring] Failed to fetch automations:', fetchErr.message);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!automations || automations.length === 0) {
      return NextResponse.json({ status: 'ok', checked: 0, message: 'No automations to check' });
    }

    for (const auto of automations) {
      checked++;

      let health;
      try {
        if (auto.platform === 'n8n' && auto.external_id) {
          // n8n requires instance URL and API key per client — stored in config
          const instanceUrl = process.env.N8N_INSTANCE_URL;
          const apiKey = process.env.N8N_API_KEY;
          if (instanceUrl && apiKey) {
            health = await checkWorkflowHealth(instanceUrl, apiKey, auto.external_id);
          }
        } else if (auto.platform === 'make' && auto.external_id) {
          const region = process.env.MAKE_REGION ?? 'us1';
          const apiToken = process.env.MAKE_API_TOKEN;
          if (apiToken) {
            health = await checkScenarioHealth(region, apiToken, Number(auto.external_id));
          }
        }
      } catch (err: any) {
        console.error(`[monitoring] Error checking ${auto.id}:`, err.message);
      }

      if (health) {
        // Update the automation record
        await supabase
          .from('client_automations')
          .update({
            health: health.status,
            last_checked: new Date().toISOString(),
            last_run: health.lastRun ?? auto.last_run,
            error_count: health.errorCount,
            status: health.status === 'inactive' ? 'paused' : 'active',
          })
          .eq('id', auto.id);

        // Publish error event if failing
        if (health.status === 'failing') {
          errors++;
          const clientName = (auto as any).client_accounts?.company_name ?? 'Unknown';
          await publishEvent({
            type: 'automation.error',
            payload: {
              automationId: auto.id,
              clientName,
              platform: auto.platform,
              workflowId: auto.external_id,
              errorMessage: health.lastError,
              successRate: health.successRate,
            },
            fromAgent: 'monitoring-cron',
            toAgents: ['Delivery AI', 'Engineering AI'],
            priority: 'urgent',
          });
        }
      }
    }
  } catch (err: any) {
    console.error('[monitoring] Unexpected error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  console.log(`[monitoring] Checked ${checked} automations, ${errors} errors found`);
  return NextResponse.json({
    status: 'ok',
    checked,
    errors,
    ran: new Date().toISOString(),
  });
}
