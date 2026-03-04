import { NextResponse } from 'next/server';

/**
 * GET /api/config/status
 * Returns which optional integrations are configured.
 * Used by the dashboard to show actionable warnings when keys are missing.
 */
export async function GET() {
  return NextResponse.json({
    slack:     !!process.env.SLACK_BOT_TOKEN,
    resend:    !!process.env.RESEND_API_KEY,
    pipedrive: !!process.env.PIPEDRIVE_API_TOKEN,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    supabase:  !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  });
}
