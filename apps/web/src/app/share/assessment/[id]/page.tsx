import { createClient } from '@supabase/supabase-js';

// Public share page — no auth required
export const dynamic = 'force-dynamic';

async function getAssessment(id: string): Promise<{
  company_name: string;
  contact_name: string;
  html_content: string | null;
  status: string;
  created_at: string;
} | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('opportunity_assessments')
    .select('company_name, contact_name, html_content, status, created_at')
    .eq('id', id)
    .single();

  return data;
}

export default async function ShareAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const assessment = await getAssessment(id);

  if (!assessment?.html_content) {
    return (
      <html lang="en">
        <body
          style={{
            fontFamily: 'system-ui, sans-serif',
            background: '#F8F9FB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            margin: 0,
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: 480, padding: '40px 24px' }}>
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                letterSpacing: -1,
                marginBottom: 16,
              }}
            >
              <span style={{ color: '#2A2A3E' }}>MANAGE</span>
              <span style={{ color: '#4A8FD6' }}>AI</span>
            </div>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: '#1A1A2E',
                marginBottom: 8,
              }}
            >
              Assessment not found
            </h1>
            <p
              style={{
                fontSize: 14,
                color: '#8890A0',
                lineHeight: 1.6,
                marginBottom: 24,
              }}
            >
              This opportunity assessment link is either invalid or the assessment
              hasn&apos;t been generated yet.
            </p>
            <a
              href="https://manageai.io"
              style={{
                display: 'inline-block',
                background: '#4A8FD6',
                color: '#fff',
                padding: '10px 24px',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Visit ManageAI
            </a>
          </div>
        </body>
      </html>
    );
  }

  const title = `${assessment.company_name} — AI Opportunity Assessment | ManageAI`;

  // Inject a CTA banner before the closing </body> tag
  const ctaBanner = `
<div style="background:#1A1A2E;color:#fff;padding:32px 24px;text-align:center;margin-top:0;font-family:'DM Sans',system-ui,sans-serif;">
  <div style="font-size:13px;color:#8890A0;letter-spacing:1px;text-transform:uppercase;font-weight:600;margin-bottom:8px;">
    Ready to move forward?
  </div>
  <div style="font-size:22px;font-weight:700;margin-bottom:8px;">
    Request Your Full AI Blueprint
  </div>
  <p style="font-size:14px;color:#B0BAC8;max-width:480px;margin:0 auto 20px;line-height:1.6;">
    Get a complete implementation roadmap, architecture design, and 90-day plan tailored specifically to ${assessment.company_name}.
  </p>
  <a href="https://manageai.io/blueprint" style="display:inline-block;background:#4A8FD6;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.2px;">
    Request AI Blueprint →
  </a>
  <div style="margin-top:20px;font-size:12px;color:#8890A0;">
    <span style="margin-right:16px;">📧 hello@manageai.io</span>
    <span>🌐 manageai.io</span>
  </div>
</div>`;

  // Inject CTA before closing body tag
  const htmlWithCta = assessment.html_content.includes('</body>')
    ? assessment.html_content.replace('</body>', `${ctaBanner}</body>`)
    : assessment.html_content + ctaBanner;

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta
          name="description"
          content={`AI Opportunity Assessment for ${assessment.company_name} — prepared by ManageAI`}
        />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body, html { height: 100%; }
          iframe { display: block; width: 100%; height: 100vh; border: none; }
        `}</style>
      </head>
      <body>
        <iframe
          srcDoc={htmlWithCta}
          title={title}
          sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups"
          style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
        />
      </body>
    </html>
  );
}
