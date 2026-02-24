import { createClient } from '@supabase/supabase-js';

// Public share page — no auth required
export const dynamic = 'force-dynamic';

async function getArtifactHtml(ticketId: string): Promise<string | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: artifact } = await supabase
    .from('ticket_artifacts')
    .select('file_path, file_name')
    .eq('ticket_id', ticketId)
    .eq('artifact_type', 'build_plan')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!artifact?.file_path) return null;

  const { data: fileData, error } = await supabase.storage
    .from('ticket-files')
    .download(artifact.file_path);

  if (error || !fileData) return null;

  return fileData.text();
}

async function getTicket(ticketId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data } = await supabase
    .from('tickets')
    .select('project_name, company_name')
    .eq('id', ticketId)
    .single();
  return data;
}

export default async function SharePlanPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  const [html, ticket] = await Promise.all([
    getArtifactHtml(ticketId),
    getTicket(ticketId),
  ]);

  if (!html) {
    return (
      <html lang="en">
        <body style={{ fontFamily: 'system-ui, sans-serif', background: '#F8F9FB', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', margin: 0 }}>
          <div style={{ textAlign: 'center', maxWidth: 480, padding: '40px 24px' }}>
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: -1, marginBottom: 16 }}>
              <span style={{ color: '#2A2A3E' }}>MANAGE</span>
              <span style={{ color: '#4A8FD6' }}>AI</span>
            </div>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1A1A2E', marginBottom: 8 }}>
              Build plan not found
            </h1>
            <p style={{ fontSize: 14, color: '#8890A0', lineHeight: 1.6, marginBottom: 24 }}>
              This build plan link is either invalid or the plan hasn&apos;t been generated yet.
            </p>
            <a
              href="https://manageai.io"
              style={{ display: 'inline-block', background: '#4A8FD6', color: '#fff', padding: '10px 24px', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 500 }}
            >
              Visit ManageAI
            </a>
          </div>
        </body>
      </html>
    );
  }

  const title = ticket
    ? `${ticket.project_name || 'Build Plan'} — ${ticket.company_name} | ManageAI`
    : 'Build Plan | ManageAI';

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <style>{`* { margin: 0; padding: 0; box-sizing: border-box; } body, html { height: 100%; } iframe { display: block; width: 100%; height: 100vh; border: none; }`}</style>
      </head>
      <body>
        <iframe
          srcDoc={html}
          title={title}
          sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups"
          style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
        />
      </body>
    </html>
  );
}
