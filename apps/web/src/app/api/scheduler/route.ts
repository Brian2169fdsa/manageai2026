import { NextRequest, NextResponse } from 'next/server';
import { runScheduledJob } from '@/lib/scheduler/runner';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // If no secret is configured, allow localhost requests for testing
  if (!cronSecret) {
    const host = request.headers.get('host') ?? '';
    return host.startsWith('localhost') || host.startsWith('127.0.0.1');
  }

  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
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
