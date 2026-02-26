import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Tables required for the platform — check existence via a lightweight query
const TABLES = [
  { name: 'tickets', description: 'Build requests (core)' },
  { name: 'ticket_artifacts', description: 'AI-generated deliverables' },
  { name: 'ticket_assets', description: 'File uploads' },
  { name: 'ticket_approvals', description: 'Approval workflow records' },
  { name: 'templates', description: 'Workflow template library (8,076+)' },
  { name: 'deployments', description: 'Deployment records' },
  { name: 'organizations', description: 'Multi-tenant orgs' },
  { name: 'org_members', description: 'User-org membership' },
  { name: 'activity_events', description: 'Agent activity log & event bus' },
  { name: 'agent_conversations', description: 'Agent chat history' },
  { name: 'agent_tool_logs', description: 'Tool execution audit trail' },
  { name: 'opportunity_assessments', description: 'Tony\'s sales assessment records' },
  { name: 'client_accounts', description: 'ManageAI client accounts' },
  { name: 'client_automations', description: 'Deployed automation tracking' },
  { name: 'client_reports', description: 'Monthly client performance reports' },
  { name: 'teammate_deployments', description: 'AI teammate deployment records' },
  { name: 'scheduled_job_runs', description: 'Cron job telemetry' },
];

export async function GET() {
  const supabase = getSupabase();

  const results = await Promise.all(
    TABLES.map(async (t) => {
      try {
        const { error } = await supabase
          .from(t.name)
          .select('*', { count: 'exact', head: true });

        if (error) {
          // PGRST116 / 42P01 = relation does not exist
          const missing =
            error.code === 'PGRST116' ||
            error.message?.includes('does not exist') ||
            (error as { code?: string }).code === '42P01';
          return { ...t, exists: !missing, error: missing ? null : error.message };
        }
        return { ...t, exists: true, error: null };
      } catch {
        return { ...t, exists: false, error: 'Query failed' };
      }
    })
  );

  const missing = results.filter((r) => !r.exists);
  const existing = results.filter((r) => r.exists);

  return NextResponse.json({
    total: TABLES.length,
    existing: existing.length,
    missing: missing.length,
    tables: results,
    all_ok: missing.length === 0,
  });
}
