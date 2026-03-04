/* eslint-disable @typescript-eslint/no-explicit-any */

export interface AutomationHealth {
  status: 'healthy' | 'degraded' | 'failing' | 'inactive' | 'unknown';
  lastRun: string | null;
  successRate: number;
  errorCount: number;
  lastError: string | null;
  totalRuns: number;
}

/**
 * Checks the health of a deployed n8n workflow by querying its REST API.
 * Returns a standardized AutomationHealth object.
 */
export async function checkWorkflowHealth(
  instanceUrl: string,
  apiKey: string,
  workflowId: string
): Promise<AutomationHealth> {
  const base = instanceUrl.replace(/\/$/, '');
  const headers: Record<string, string> = { 'X-N8N-API-KEY': apiKey };

  try {
    // Check if workflow is active
    const wfRes = await fetch(`${base}/api/v1/workflows/${workflowId}`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    if (!wfRes.ok) {
      return {
        status: 'unknown',
        lastRun: null,
        successRate: 0,
        errorCount: 0,
        lastError: `Workflow API returned ${wfRes.status}`,
        totalRuns: 0,
      };
    }

    const wf = await wfRes.json();
    const isActive = wf.active === true;

    if (!isActive) {
      return {
        status: 'inactive',
        lastRun: null,
        successRate: 0,
        errorCount: 0,
        lastError: null,
        totalRuns: 0,
      };
    }

    // Get recent executions
    const execRes = await fetch(
      `${base}/api/v1/executions?workflowId=${workflowId}&limit=10`,
      { headers, signal: AbortSignal.timeout(10_000) }
    );

    if (!execRes.ok) {
      return {
        status: 'unknown',
        lastRun: null,
        successRate: 0,
        errorCount: 0,
        lastError: `Executions API returned ${execRes.status}`,
        totalRuns: 0,
      };
    }

    const { data: executions } = await execRes.json();
    const runs: any[] = Array.isArray(executions) ? executions : [];

    if (runs.length === 0) {
      return {
        status: 'healthy',
        lastRun: null,
        successRate: 100,
        errorCount: 0,
        lastError: null,
        totalRuns: 0,
      };
    }

    const successes = runs.filter((r: any) => r.finished && !r.stoppedAt && r.status !== 'error');
    const errors = runs.filter((r: any) => r.status === 'error');
    const successRate = Math.round((successes.length / runs.length) * 100);
    const lastRun = runs[0]?.startedAt ?? runs[0]?.createdAt ?? null;
    const lastError = errors.length > 0 ? (errors[0]?.data?.resultData?.error?.message ?? 'Execution failed') : null;

    let status: AutomationHealth['status'] = 'healthy';
    if (successRate < 50) status = 'failing';
    else if (successRate < 80) status = 'degraded';

    return {
      status,
      lastRun,
      successRate,
      errorCount: errors.length,
      lastError,
      totalRuns: runs.length,
    };
  } catch (err: any) {
    return {
      status: 'unknown',
      lastRun: null,
      successRate: 0,
      errorCount: 0,
      lastError: err.message ?? 'Connection failed',
      totalRuns: 0,
    };
  }
}

export function isConfigured(): boolean {
  return !!process.env.N8N_MONITOR_ENABLED;
}
