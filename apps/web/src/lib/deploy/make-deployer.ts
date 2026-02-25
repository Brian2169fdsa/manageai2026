import { publishEvent } from '@/lib/events';

export interface MakeConfig {
  apiToken: string;
  teamId: number;
  folderId?: number;
  region?: 'us1' | 'eu1' | 'eu2'; // defaults to 'us1'
}

/** Optional context for event publishing after a successful deploy */
export interface DeployContext {
  ticketId?: string;
  clientName?: string;
}

export interface DeployResult {
  success: boolean;
  scenarioId?: string;
  url?: string;
  type?: string;
  error?: string;
}

const VALID_REGIONS = new Set(['us1', 'eu1', 'eu2']);

/**
 * Deploys a Make.com blueprint to a team via the Make.com REST API.
 * POST https://{region}.make.com/api/v2/scenarios?teamId={teamId}
 */
export async function deployToMake(
  blueprintJson: Record<string, unknown>,
  config: MakeConfig,
  context?: DeployContext
): Promise<DeployResult> {
  if (!config.apiToken || !config.teamId) {
    return { success: false, error: 'Make.com not configured — provide apiToken and teamId' };
  }

  const region = config.region ?? 'us1';
  if (!VALID_REGIONS.has(region)) {
    return { success: false, error: `Invalid Make.com region "${region}". Must be one of: us1, eu1, eu2` };
  }

  const base = `https://${region}.make.com`;

  try {
    const body: Record<string, unknown> = {
      blueprint: JSON.stringify(blueprintJson),
    };

    if (config.folderId) {
      body.folderId = config.folderId;
    }

    const res = await fetch(`${base}/api/v2/scenarios?teamId=${config.teamId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${config.apiToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Make.com create failed (${res.status}): ${errText}` };
    }

    const created = await res.json() as { scenario?: { id?: string | number; name?: string } };
    const scenarioId = String(created.scenario?.id ?? '');

    if (!scenarioId) {
      return { success: false, error: 'Make.com returned no scenario ID' };
    }

    const result: DeployResult = {
      success: true,
      scenarioId,
      url: `${base}/scenarios/${scenarioId}`,
    };

    // Publish deployment event (fire and forget)
    publishEvent({
      type: 'ticket.deployed',
      payload: {
        ticketId: context?.ticketId ?? null,
        platform: 'make',
        clientName: context?.clientName ?? 'Unknown Client',
        deployUrl: result.url,
        scenarioId,
      },
      fromAgent: 'Engineering AI',
      toAgents: ['Delivery AI', 'Marketing AI'],
      priority: 'normal',
    }).catch((e: Error) => console.error('[make-deployer] publishEvent failed:', e.message));

    return result;
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/** Test connectivity to Make.com API by listing scenarios (limit 1) */
export async function testMakeConnection(config: MakeConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const region = config.region ?? 'us1';
    if (!VALID_REGIONS.has(region)) {
      return { ok: false, message: `Invalid region "${region}"` };
    }
    const res = await fetch(`https://${region}.make.com/api/v2/scenarios?teamId=${config.teamId}&pg[limit]=1`, {
      headers: { Authorization: `Token ${config.apiToken}` },
    });
    if (res.ok) return { ok: true, message: 'Connection successful' };
    return { ok: false, message: `HTTP ${res.status}: ${await res.text()}` };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
