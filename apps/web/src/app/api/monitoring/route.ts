import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** GET — Fetch all client automations with enriched client data */
export async function GET() {
  try {
    const { data: automations, error } = await supabase
      .from('client_automations')
      .select('*, client_accounts(company_name)')
      .order('created_at', { ascending: false });

    if (error) {
      // Table might not exist yet — return empty with flag
      const isMissing =
        error.message?.includes('does not exist') ||
        error.code === 'PGRST116' ||
        (error as { code?: string }).code === '42P01';
      if (isMissing) {
        return NextResponse.json({ data: [], table_missing: true });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Flatten the join
    const enriched = (automations ?? []).map((a) => ({
      ...a,
      company_name: (a.client_accounts as { company_name?: string } | null)?.company_name ?? 'Unknown',
      client_accounts: undefined,
    }));

    return NextResponse.json({ data: enriched });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** POST — Run a health check on all active automations */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const cronSecret = body.secret;

    // Optional auth for cron jobs
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      // If CRON_SECRET is set but doesn't match, allow only if no secret passed (manual trigger)
      if (cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { data: automations, error } = await supabase
      .from('client_automations')
      .select('*')
      .in('status', ['active', 'error']);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results = [];
    for (const auto of automations ?? []) {
      const health = await checkAutomationHealth(auto);
      results.push(health);

      // Update the record
      await supabase
        .from('client_automations')
        .update({
          health: health.health,
          status: health.status,
          last_checked: new Date().toISOString(),
          last_run: health.last_run ?? auto.last_run,
          run_count: health.run_count ?? auto.run_count,
          error_count: health.error_count ?? auto.error_count,
        })
        .eq('id', auto.id);
    }

    return NextResponse.json({
      checked: results.length,
      healthy: results.filter((r) => r.health === 'healthy').length,
      degraded: results.filter((r) => r.health === 'degraded').length,
      failing: results.filter((r) => r.health === 'failing').length,
      results,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

interface HealthCheckResult {
  id: string;
  health: 'healthy' | 'degraded' | 'failing';
  status: 'active' | 'paused' | 'error' | 'unknown';
  last_run?: string;
  run_count?: number;
  error_count?: number;
  message: string;
}

async function checkAutomationHealth(automation: {
  id: string;
  platform: string;
  external_id?: string;
  external_url?: string;
  status: string;
  last_run?: string;
  error_count?: number;
  run_count?: number;
}): Promise<HealthCheckResult> {
  // If no external_id, we can't check — mark as unknown
  if (!automation.external_id && !automation.external_url) {
    return {
      id: automation.id,
      health: 'degraded',
      status: 'unknown',
      message: 'No external ID or URL configured — cannot verify health',
    };
  }

  // Platform-specific health checks
  try {
    switch (automation.platform) {
      case 'n8n':
        return await checkN8nHealth(automation);
      case 'make':
        return await checkMakeHealth(automation);
      default:
        // Zapier has no public API — use heuristic
        return checkHeuristic(automation);
    }
  } catch {
    return {
      id: automation.id,
      health: 'degraded',
      status: automation.status as 'active' | 'paused' | 'error' | 'unknown',
      message: 'Health check failed — platform unreachable',
    };
  }
}

async function checkN8nHealth(automation: {
  id: string;
  external_id?: string;
  external_url?: string;
  status: string;
  run_count?: number;
  error_count?: number;
}): Promise<HealthCheckResult> {
  // Extract instance URL from external_url
  const baseUrl = automation.external_url?.replace(/\/workflow\/.*$/, '');
  if (!baseUrl) {
    return { id: automation.id, health: 'degraded', status: 'unknown', message: 'No n8n instance URL' };
  }

  // Try to check workflow status via n8n API
  // This requires the n8n API key to be stored — for now return heuristic
  return checkHeuristic(automation);
}

async function checkMakeHealth(automation: {
  id: string;
  external_id?: string;
  status: string;
  run_count?: number;
  error_count?: number;
}): Promise<HealthCheckResult> {
  // Make.com scenarios can be checked via their API
  // For now return heuristic-based check
  return checkHeuristic(automation);
}

function checkHeuristic(automation: {
  id: string;
  status: string;
  last_run?: string;
  run_count?: number;
  error_count?: number;
}): HealthCheckResult {
  const errorRate =
    automation.run_count && automation.error_count
      ? automation.error_count / automation.run_count
      : 0;

  const lastRunAge = automation.last_run
    ? (Date.now() - new Date(automation.last_run).getTime()) / 86400000
    : Infinity;

  let health: 'healthy' | 'degraded' | 'failing' = 'healthy';
  let status = automation.status as 'active' | 'paused' | 'error' | 'unknown';
  let message = 'Automation running normally';

  if (errorRate > 0.3) {
    health = 'failing';
    status = 'error';
    message = `High error rate: ${Math.round(errorRate * 100)}% of runs failed`;
  } else if (errorRate > 0.1) {
    health = 'degraded';
    message = `Elevated error rate: ${Math.round(errorRate * 100)}% of runs failed`;
  } else if (lastRunAge > 7) {
    health = 'degraded';
    message = `No runs in ${Math.round(lastRunAge)} days — may be stalled`;
  }

  return {
    id: automation.id,
    health,
    status,
    last_run: automation.last_run,
    run_count: automation.run_count,
    error_count: automation.error_count,
    message,
  };
}
