import { publishEvent } from '@/lib/events';

export interface N8nConfig {
  instanceUrl: string;
  apiKey: string;
}

/** Optional context for event publishing after a successful deploy */
export interface DeployContext {
  ticketId?: string;
  clientName?: string;
}

export interface DeployResult {
  success: boolean;
  workflowId?: string;
  url?: string;
  error?: string;
}

/**
 * Deploys a workflow JSON to a self-hosted n8n instance via the n8n REST API.
 * POST /api/v1/workflows → create
 * POST /api/v1/workflows/{id}/activate → activate
 */
export async function deployToN8n(
  workflowJson: Record<string, unknown>,
  config: N8nConfig,
  context?: DeployContext
): Promise<DeployResult> {
  if (!config.instanceUrl || !config.apiKey) {
    return { success: false, error: 'n8n instance not configured — provide instanceUrl and apiKey' };
  }

  const base = config.instanceUrl.replace(/\/$/, '');

  try {
    // Step 1: Create the workflow
    const createRes = await fetch(`${base}/api/v1/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': config.apiKey,
      },
      body: JSON.stringify(workflowJson),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      return { success: false, error: `n8n create failed (${createRes.status}): ${errText}` };
    }

    const created = await createRes.json() as { id?: string };
    const workflowId = created.id;

    if (!workflowId) {
      return { success: false, error: 'n8n returned no workflow ID after creation' };
    }

    // Step 2: Activate the workflow
    const activateRes = await fetch(`${base}/api/v1/workflows/${workflowId}/activate`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': config.apiKey,
      },
    });

    if (!activateRes.ok) {
      const errText = await activateRes.text();
      console.warn(`[n8n-deployer] Workflow created (${workflowId}) but activation failed: ${errText}`);
      // Still a partial success — workflow exists, just not active
      return {
        success: true,
        workflowId,
        url: `${base}/workflow/${workflowId}`,
        error: `Created but not activated: ${errText}`,
      };
    }

    const result: DeployResult = {
      success: true,
      workflowId,
      url: `${base}/workflow/${workflowId}`,
    };

    // Publish deployment event (fire and forget)
    publishEvent({
      type: 'ticket.deployed',
      payload: {
        ticketId: context?.ticketId ?? null,
        platform: 'n8n',
        clientName: context?.clientName ?? 'Unknown Client',
        deployUrl: result.url,
        workflowId,
      },
      fromAgent: 'Engineering AI',
      toAgents: ['Delivery AI', 'Marketing AI'],
      priority: 'normal',
    }).catch((e: Error) => console.error('[n8n-deployer] publishEvent failed:', e.message));

    return result;
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/** Test connectivity to an n8n instance */
export async function testN8nConnection(config: N8nConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const base = config.instanceUrl.replace(/\/$/, '');
    const res = await fetch(`${base}/api/v1/workflows?limit=1`, {
      headers: { 'X-N8N-API-KEY': config.apiKey },
    });
    if (res.ok) return { ok: true, message: 'Connection successful' };
    return { ok: false, message: `HTTP ${res.status}: ${await res.text()}` };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
