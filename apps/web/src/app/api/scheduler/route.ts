import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runScheduledJob } from '@/lib/scheduler/runner';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/**
 * Vercel Cron validation:
 * - Set CRON_SECRET in Vercel env vars.
 * - Vercel automatically sends `Authorization: Bearer {CRON_SECRET}` on cron requests.
 * - The route validates the header to prevent unauthorized job triggers.
 * - If CRON_SECRET is unset, only localhost requests are allowed (dev mode).
 */
function isCronAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    const host = request.headers.get('host') ?? '';
    return host.startsWith('localhost') || host.startsWith('127.0.0.1');
  }

  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

/** GET — called by Vercel Cron with CRON_SECRET in Authorization header */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jobName = new URL(request.url).searchParams.get('job');
  if (!jobName) {
    return NextResponse.json({ error: 'Missing ?job= parameter' }, { status: 400 });
  }

  const result = await runScheduledJob(jobName);

  return NextResponse.json({
    status: result.success ? 'ok' : 'error',
    jobName: result.jobName,
    success: result.success,
    duration: result.duration,
    output: result.output,
    ran: new Date().toISOString(),
  });
}

/**
 * POST — called by the UI "Run Now" button.
 * Validates the Supabase user session (JWT) passed in Authorization header.
 * Body: { job: string }
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const jobName = (body as { job?: string }).job;
  if (!jobName) {
    return NextResponse.json({ error: 'Missing job parameter' }, { status: 400 });
  }

  const result = await runScheduledJob(jobName);

  return NextResponse.json({
    status: result.success ? 'ok' : 'error',
    jobName: result.jobName,
    success: result.success,
    duration: result.duration,
    output: result.output,
    ran: new Date().toISOString(),
  });
}
