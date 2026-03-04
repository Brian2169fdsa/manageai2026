import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** GET — List all client reports, optionally filtered */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('client_id');
  const reportType = searchParams.get('type');

  try {
    let query = supabase
      .from('client_reports')
      .select('*, client_accounts(company_name)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (clientId) query = query.eq('client_id', clientId);
    if (reportType) query = query.eq('report_type', reportType);

    const { data, error } = await query;

    if (error) {
      const isMissing =
        error.message?.includes('does not exist') ||
        error.code === 'PGRST116' ||
        (error as { code?: string }).code === '42P01';
      if (isMissing) {
        return NextResponse.json({ data: [], table_missing: true });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const enriched = (data ?? []).map((r) => ({
      ...r,
      company_name:
        (r.client_accounts as { company_name?: string } | null)?.company_name ?? 'Unknown',
      client_accounts: undefined,
    }));

    return NextResponse.json({ data: enriched });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** POST — Generate a new report for a client */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { client_id, report_type, period_start, period_end } = body;

    if (!client_id || !report_type) {
      return NextResponse.json(
        { error: 'client_id and report_type are required' },
        { status: 400 }
      );
    }

    // Fetch client info
    const { data: client } = await supabase
      .from('client_accounts')
      .select('*')
      .eq('id', client_id)
      .single();

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Fetch automations for this client
    const { data: automations } = await supabase
      .from('client_automations')
      .select('*')
      .eq('client_id', client_id);

    // Fetch related tickets
    const { data: tickets } = await supabase
      .from('tickets')
      .select('id, company_name, project_name, status, ticket_type, created_at, updated_at')
      .ilike('company_name', `%${client.company_name}%`)
      .order('created_at', { ascending: false })
      .limit(50);

    // Build metrics
    const autoList = automations ?? [];
    const ticketList = tickets ?? [];
    const metrics = {
      total_automations: autoList.length,
      active_automations: autoList.filter((a) => a.status === 'active').length,
      healthy_automations: autoList.filter((a) => a.health === 'healthy').length,
      total_runs: autoList.reduce((s, a) => s + (a.run_count ?? 0), 0),
      total_errors: autoList.reduce((s, a) => s + (a.error_count ?? 0), 0),
      error_rate:
        autoList.reduce((s, a) => s + (a.run_count ?? 0), 0) > 0
          ? (
              (autoList.reduce((s, a) => s + (a.error_count ?? 0), 0) /
                autoList.reduce((s, a) => s + (a.run_count ?? 0), 0)) *
              100
            ).toFixed(1) + '%'
          : '0%',
      total_tickets: ticketList.length,
      deployed_tickets: ticketList.filter((t) => t.status === 'DEPLOYED' || t.status === 'CLOSED')
        .length,
      in_progress_tickets: ticketList.filter((t) =>
        ['SUBMITTED', 'ANALYZING', 'BUILDING', 'REVIEW_PENDING'].includes(t.status)
      ).length,
      platforms_used: [...new Set(autoList.map((a) => a.platform))],
    };

    // Generate HTML content
    const content = generateReportHTML(client.company_name, report_type, metrics, period_start, period_end);

    // Save to DB
    const { data: report, error } = await supabase
      .from('client_reports')
      .insert({
        client_id,
        report_type,
        period_start: period_start ?? null,
        period_end: period_end ?? null,
        content,
        metrics,
        created_by: 'agent',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: report });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

function generateReportHTML(
  companyName: string,
  reportType: string,
  metrics: Record<string, unknown>,
  periodStart?: string,
  periodEnd?: string
): string {
  const period =
    periodStart && periodEnd
      ? `${new Date(periodStart).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} – ${new Date(periodEnd).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
      : 'Current Period';

  return `
<div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 24px; color: #1e293b; margin-bottom: 4px;">
    ${reportType === 'monthly' ? 'Monthly' : reportType === 'quarterly' ? 'Quarterly' : 'Incident'} Performance Report
  </h1>
  <p style="color: #64748b; font-size: 14px; margin-bottom: 24px;">${companyName} — ${period}</p>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px;">
    <div style="background: #f0fdf4; border-radius: 8px; padding: 16px;">
      <div style="font-size: 12px; color: #16a34a; font-weight: 600;">Active Automations</div>
      <div style="font-size: 28px; font-weight: 700; color: #166534;">${metrics.active_automations}</div>
    </div>
    <div style="background: #eff6ff; border-radius: 8px; padding: 16px;">
      <div style="font-size: 12px; color: #2563eb; font-weight: 600;">Total Runs</div>
      <div style="font-size: 28px; font-weight: 700; color: #1e40af;">${metrics.total_runs}</div>
    </div>
    <div style="background: #f0fdf4; border-radius: 8px; padding: 16px;">
      <div style="font-size: 12px; color: #16a34a; font-weight: 600;">Healthy</div>
      <div style="font-size: 28px; font-weight: 700; color: #166534;">${metrics.healthy_automations}</div>
    </div>
    <div style="background: #fef2f2; border-radius: 8px; padding: 16px;">
      <div style="font-size: 12px; color: #dc2626; font-weight: 600;">Error Rate</div>
      <div style="font-size: 28px; font-weight: 700; color: #991b1b;">${metrics.error_rate}</div>
    </div>
  </div>

  <h2 style="font-size: 16px; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Build Pipeline</h2>
  <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: 24px;">
    <tr style="text-align: left; color: #64748b;">
      <td style="padding: 8px 0;">Total Tickets</td><td style="font-weight: 600; color: #1e293b;">${metrics.total_tickets}</td>
    </tr>
    <tr style="text-align: left; color: #64748b;">
      <td style="padding: 8px 0;">Deployed</td><td style="font-weight: 600; color: #16a34a;">${metrics.deployed_tickets}</td>
    </tr>
    <tr style="text-align: left; color: #64748b;">
      <td style="padding: 8px 0;">In Progress</td><td style="font-weight: 600; color: #2563eb;">${metrics.in_progress_tickets}</td>
    </tr>
    <tr style="text-align: left; color: #64748b;">
      <td style="padding: 8px 0;">Platforms</td><td style="font-weight: 600; color: #1e293b;">${(metrics.platforms_used as string[]).join(', ') || 'None'}</td>
    </tr>
  </table>

  <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 32px;">
    Generated by ManageAI Platform — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
  </p>
</div>`.trim();
}
