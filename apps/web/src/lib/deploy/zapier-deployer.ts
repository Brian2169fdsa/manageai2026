export interface ZapierConfig {
  mode: 'manual'; // Zapier has no public workflow creation API
}

export interface DeployResult {
  success: boolean;
  type: string;
  instructions?: string;
  error?: string;
}

/**
 * Zapier does not have a public REST API for programmatic Zap creation.
 * This deployer provides import instructions and a formatted guide.
 */
export async function deployToZapier(
  zapJson: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _config: ZapierConfig
): Promise<DeployResult> {
  const zapName = String(zapJson.zap_name ?? zapJson.name ?? 'Your Automation');

  const steps = Array.isArray(zapJson.steps)
    ? zapJson.steps
    : Array.isArray(zapJson.actions)
    ? [{ position: 1, type: 'trigger', app: (zapJson.trigger as Record<string, unknown>)?.app ?? 'Trigger' }, ...zapJson.actions as unknown[]]
    : [];

  const stepList = steps
    .map((s) => {
      const step = s as Record<string, unknown>;
      return `  ${step.position ?? step.step ?? '?'}. [${String(step.type ?? 'action').toUpperCase()}] ${step.app} — ${step.action ?? step.event ?? ''}`;
    })
    .join('\n');

  const instructions = `
To set up "${zapName}" in Zapier:

STEPS TO IMPORT:
${stepList || '  (see workflow JSON for full step list)'}

MANUAL SETUP GUIDE:
1. Log in to zapier.com and click "Create Zap"
2. Set up the Trigger step with the app and event shown above
3. Add each Action step in order, mapping fields as described in the Build Plan
4. Test each step with sample data
5. Turn on your Zap when ready

TIPS:
• Use Zapier's "Paths" feature for any branching logic
• Use "Filter" steps to gate actions on conditions
• The workflow JSON file contains the full field mapping reference

Download the Workflow JSON from your deliverables to reference all field mappings.
`.trim();

  return {
    success: true,
    type: 'manual',
    instructions,
  };
}
