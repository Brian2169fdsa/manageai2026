import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ── External Artifacts API ──────────────────────────────────────────────────
// GET /api/artifacts/{ticketId}?type=all|build_plan|solution_demo|workflow_json&format=html|json|data
//
// Authentication: x-manageai-key header OR Supabase session cookie
// Used by Make.com, Zapier, and n8n to fetch build artifacts.

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const { ticketId } = await params;
  const supabase = getSupabase();

  // ── Authentication ──────────────────────────────────────────────────────
  const apiKey = req.headers.get('x-manageai-key');
  const authHeader = req.headers.get('authorization');

  let authenticated = false;

  if (apiKey) {
    // Check API key against org settings
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, settings')
      .limit(100);

    authenticated = (orgs ?? []).some(
      (org) => org.settings?.api_key === apiKey
    );
  }

  if (!authenticated && authHeader) {
    // Try Supabase JWT auth
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    authenticated = !!user;
  }

  if (!authenticated) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide x-manageai-key header or Bearer token.' },
      { status: 401 }
    );
  }

  // ── Fetch ticket ────────────────────────────────────────────────────────
  const { data: ticket, error: ticketErr } = await supabase
    .from('tickets')
    .select('id, company_name, project_name, ticket_type, status, org_id')
    .eq('id', ticketId)
    .single();

  if (ticketErr || !ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  // ── Fetch artifacts ─────────────────────────────────────────────────────
  const requestedType = req.nextUrl.searchParams.get('type') || 'all';
  const requestedFormat = req.nextUrl.searchParams.get('format') || 'all';

  let artifactQuery = supabase
    .from('ticket_artifacts')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false });

  if (requestedType !== 'all') {
    // Allow fetching both the HTML and data variants
    const types = [requestedType];
    if (requestedType === 'build_plan') types.push('build_plan_data');
    if (requestedType === 'solution_demo') types.push('solution_demo_data');
    artifactQuery = artifactQuery.in('artifact_type', types);
  }

  const { data: artifacts, error: artifactErr } = await artifactQuery;

  if (artifactErr) {
    return NextResponse.json(
      { error: 'Failed to fetch artifacts: ' + artifactErr.message },
      { status: 500 }
    );
  }

  // ── Generate signed URLs ────────────────────────────────────────────────
  const artifactMap: Record<string, {
    html_url?: string;
    json_url?: string;
    data_url?: string;
    data?: Record<string, unknown>;
    generated_at?: string;
    platform?: string;
    valid?: boolean;
  }> = {};

  for (const artifact of artifacts ?? []) {
    const { data: signedData } = await supabase.storage
      .from('ticket-files')
      .createSignedUrl(artifact.file_path, 3600); // 1 hour expiry

    const signedUrl = signedData?.signedUrl ?? null;
    const baseType = artifact.artifact_type.replace('_data', '');

    if (!artifactMap[baseType]) {
      artifactMap[baseType] = {};
    }

    if (artifact.artifact_type.endsWith('_data')) {
      artifactMap[baseType].data_url = signedUrl ?? undefined;
      // If format=data, fetch and inline the data JSON
      if (requestedFormat === 'data' || requestedFormat === 'all') {
        try {
          const { data: fileData } = await supabase.storage
            .from('ticket-files')
            .download(artifact.file_path);
          if (fileData) {
            const text = await fileData.text();
            artifactMap[baseType].data = JSON.parse(text);
          }
        } catch {
          // Non-critical — URL is still available
        }
      }
    } else if (artifact.artifact_type === 'workflow_json') {
      artifactMap[baseType].json_url = signedUrl ?? undefined;
      artifactMap[baseType].platform = artifact.metadata?.platform;
      artifactMap[baseType].valid = artifact.metadata?.valid_json;
    } else {
      artifactMap[baseType].html_url = signedUrl ?? undefined;
    }

    artifactMap[baseType].generated_at = artifact.metadata?.generated_at;
  }

  return NextResponse.json({
    ticket_id: ticketId,
    company_name: ticket.company_name,
    project_name: ticket.project_name,
    platform: ticket.ticket_type,
    status: ticket.status,
    artifacts: artifactMap,
  });
}
