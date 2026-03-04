/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AutomationHealth } from './n8n-monitor';

/**
 * Checks the health of a deployed Make.com scenario by querying the Make API.
 * Returns a standardized AutomationHealth object.
 */
export async function checkScenarioHealth(
  region: string,
  apiToken: string,
  scenarioId: number
): Promise<AutomationHealth> {
  const base = `https://${region}.make.com/api/v2`;
  const headers: Record<string, string> = {
    Authorization: `Token ${apiToken}`,
    'Content-Type': 'application/json',
  };

  try {
    // Get scenario details
    const scRes = await fetch(`${base}/scenarios/${scenarioId}`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    if (!scRes.ok) {
      return {
        status: 'unknown',
        lastRun: null,
        successRate: 0,
        errorCount: 0,
        lastError: `Scenario API returned ${scRes.status}`,
        totalRuns: 0,
      };
    }

    const { scenario } = await scRes.json();
    const isActive = scenario?.islinked === true;

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

    // Get scenario logs (last 10 executions)
    const logRes = await fetch(
      `${base}/scenarios/${scenarioId}/logs?pg[limit]=10&pg[sortDir]=desc`,
      { headers, signal: AbortSignal.timeout(10_000) }
    );

    if (!logRes.ok) {
      return {
        status: 'unknown',
        lastRun: scenario.lastExec ?? null,
        successRate: 0,
        errorCount: 0,
        lastError: `Logs API returned ${logRes.status}`,
        totalRuns: 0,
      };
    }

    const logData = await logRes.json();
    const logs: any[] = Array.isArray(logData.scenarioLogs) ? logData.scenarioLogs : [];

    if (logs.length === 0) {
      return {
        status: 'healthy',
        lastRun: scenario.lastExec ?? null,
        successRate: 100,
        errorCount: 0,
        lastError: null,
        totalRuns: 0,
      };
    }

    const successes = logs.filter((l: any) => l.status === 1); // 1 = success in Make
    const errors = logs.filter((l: any) => l.status === 3 || l.status === 4); // 3=warning, 4=error
    const successRate = Math.round((successes.length / logs.length) * 100);
    const lastRun = logs[0]?.timestamp ?? scenario.lastExec ?? null;
    const lastError = errors.length > 0 ? (errors[0]?.detail ?? 'Scenario error') : null;

    let status: AutomationHealth['status'] = 'healthy';
    if (successRate < 50) status = 'failing';
    else if (successRate < 80) status = 'degraded';

    return {
      status,
      lastRun,
      successRate,
      errorCount: errors.length,
      lastError,
      totalRuns: logs.length,
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
  return !!process.env.MAKE_MONITOR_ENABLED;
}
