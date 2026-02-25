import { createClient } from '@supabase/supabase-js';
import { getJobByName, getJobsBySchedule, ScheduledJob } from './index';

export interface JobResult {
  success: boolean;
  output: string;
  duration: number;
  jobName: string;
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function executeJob(job: ScheduledJob): Promise<JobResult> {
  const startedAt = Date.now();
  const supabase = getSupabase();

  // Insert a "running" record to track this job
  let runId: string | null = null;
  try {
    const { data } = await supabase
      .from('scheduled_job_runs')
      .insert({
        job_name: job.name,
        department: job.department,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    runId = data?.id ?? null;
  } catch {
    // Table may not exist yet — continue anyway
  }

  let success = false;
  let output = '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const response = await fetch(`${appUrl}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        department: job.department,
        messages: [{ role: 'user', content: job.task }],
        isScheduled: true,
        jobName: job.name,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      output = data.response ?? data.message ?? JSON.stringify(data).slice(0, 500);
      success = true;
    } else {
      output = `HTTP ${response.status}: ${response.statusText}`;
    }
  } catch (err: unknown) {
    output = err instanceof Error ? err.message : 'Unknown error';
    if (output.includes('aborted') || output.includes('abort')) {
      output = 'Timed out after 60 seconds';
    }
  }

  const duration = Date.now() - startedAt;

  // Update run record
  try {
    if (runId) {
      await supabase
        .from('scheduled_job_runs')
        .update({
          status: success ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
          output: output.slice(0, 2000),
          error: success ? null : output,
        })
        .eq('id', runId);
    }
  } catch {
    // Best-effort
  }

  // Also log to activity_events for agent visibility
  try {
    await supabase.from('activity_events').insert({
      event_type: 'scheduled_job_run',
      agent_name: job.agentName,
      department: job.department,
      payload: {
        job_name: job.name,
        success,
        duration_ms: duration,
        output: output.slice(0, 1000),
      },
      created_at: new Date().toISOString(),
    });
  } catch {
    // Best-effort
  }

  return { success, output, duration, jobName: job.name };
}

/** Run a single scheduled job by name (used by cron endpoint). */
export async function runScheduledJob(jobName: string): Promise<JobResult> {
  const job = getJobByName(jobName);
  if (!job) {
    return { success: false, output: `Job "${jobName}" not found`, duration: 0, jobName };
  }
  if (!job.enabled) {
    return { success: false, output: `Job "${jobName}" is disabled`, duration: 0, jobName };
  }
  return executeJob(job);
}

/** Run a job manually (same logic — exported with a distinct name for clarity). */
export const runJobByName = runScheduledJob;

/** Run all enabled jobs that match a given cron expression. */
export async function runAllJobsForSchedule(cronExpression: string): Promise<JobResult[]> {
  const jobs = getJobsBySchedule(cronExpression);
  return Promise.all(jobs.map((j) => executeJob(j)));
}
