export interface MakeConfig {
  apiToken: string;
  teamId: number;
  folderId?: number;
  region?: string; // 'us1' | 'eu1' | 'us2' — defaults to 'us1'
}

export interface DeployResult {
  success: boolean;
  scenarioId?: string;
  url?: string;
  type?: string;
  error?: string;
}

/**
 * Deploys a Make.com blueprint to a team via the Make.com REST API.
 * POST https://{region}.make.com/api/v2/scenarios
 */
export async function deployToMake(
  blueprintJson: Record<string, unknown>,
  config: MakeConfig
): Promise<DeployResult> {
  if (!config.apiToken || !config.teamId) {
    return { success: false, error: 'Make.com not configured — provide apiToken and teamId' };
  }

  const region = config.region ?? 'us1';
  const baseUrl = `https://${region}.make.com/api/v2`;

  try {
    const body: Record<string, unknown> = {
      blueprint: blueprintJson,
      teamId: config.teamId,
      scheduling: { type: 'indefinitely', interval: 15 },
    };

    if (config.folderId) {
      body.folderId = config.folderId;
    }

    const res = await fetch(`${baseUrl}/scenarios`, {
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

    return {
      success: true,
      scenarioId,
      url: `https://www.make.com/en/scenarios/${scenarioId}`,
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/** Test connectivity to Make.com API */
export async function testMakeConnection(config: MakeConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const region = config.region ?? 'us1';
    const res = await fetch(`https://${region}.make.com/api/v2/teams/${config.teamId}`, {
      headers: { Authorization: `Token ${config.apiToken}` },
    });
    if (res.ok) return { ok: true, message: 'Connection successful' };
    return { ok: false, message: `HTTP ${res.status}: ${await res.text()}` };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
