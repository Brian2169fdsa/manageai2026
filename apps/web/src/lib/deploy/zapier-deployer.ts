export interface ZapierConfig {
  mode: 'manual'; // Zapier has no public workflow creation API
  accountEmail?: string; // optional — for referencing in guides
}

export interface ZapierDeployResult {
  success: boolean;
  type: 'manual';
  instructions: string;       // plain-text summary for the deployments table
  setupGuideHtml: string;      // full HTML setup guide (save to Storage)
  estimatedSetupTime: string;
  error?: string;
}

interface ZapStep {
  position: number;
  type: 'trigger' | 'action' | 'filter' | 'formatter' | 'path' | 'delay' | 'loop';
  app?: string;
  app_display_name?: string;
  event?: string;
  event_description?: string;
  config?: Record<string, unknown>;
  input_mapping?: Record<string, string>;
  output_fields?: string[];
  setup_instructions?: string;
  // filter-specific
  condition?: string;
  // path-specific
  label?: string;
  steps?: ZapStep[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const APP_COLORS: Record<string, string> = {
  trigger: '#FF4A00',   // Zapier orange
  filter: '#6B7280',    // gray
  formatter: '#8B5CF6', // purple
  delay: '#F59E0B',     // amber
  loop: '#10B981',      // emerald
  action: '#4A8FD6',    // ManageAI blue
  path: '#EC4899',      // pink
};

const APP_ICONS: Record<string, string> = {
  google_sheets: '📊', gmail: '✉️', slack: '💬', hubspot: '🟠',
  salesforce: '☁️', pipedrive: '🔵', stripe: '💳', shopify: '🛍️',
  airtable: '📋', notion: '📝', trello: '📌', asana: '✅',
  webhooks: '🔗', webhook: '🔗', schedule: '⏰', openai: '🤖',
  twilio: '📱', mailchimp: '📧', sendgrid: '📤', typeform: '📋',
  calendly: '📅', github: '🐙', jira: '🔷', clickup: '🟣',
  discord: '🎮', intercom: '💬', zendesk: '🎫', filter: '🔽',
  formatter: '🔧', delay: '⏱️', loop: '🔁', paths: '🔀',
  storage: '🗄️', code: '💻', digest: '📰', default: '⚡',
};

function getAppIcon(app: string): string {
  const key = (app ?? '').toLowerCase().replace(/[^a-z_]/g, '');
  return APP_ICONS[key] ?? APP_ICONS.default;
}

function getStepColor(type: string): string {
  return APP_COLORS[type] ?? APP_COLORS.action;
}

function escHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function instructionsToHtml(text: string): string {
  if (!text) return '<em style="color:#9CA3AF">No instructions provided.</em>';
  // Convert numbered steps to styled list items
  const lines = text.split('\\n').map((line) => line.trim()).filter(Boolean);
  const listItems = lines.map((line) => {
    // Detect numbered step
    const numMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      return `<li style="margin-bottom:8px;padding-left:4px"><span style="display:inline-block;min-width:22px;height:22px;line-height:22px;text-align:center;background:#EFF6FF;color:#4A8FD6;border-radius:50%;font-size:11px;font-weight:700;margin-right:8px;flex-shrink:0">${numMatch[1]}</span>${escHtml(numMatch[2])}</li>`;
    }
    // Bullet or sub-note
    if (line.startsWith('•') || line.startsWith('-')) {
      return `<li style="margin-bottom:6px;padding-left:30px;color:#555;font-size:13px;list-style:disc">${escHtml(line.replace(/^[•\-]\s*/, ''))}</li>`;
    }
    return `<li style="margin-bottom:6px;padding-left:30px;color:#555;font-size:13px;list-style:none">${escHtml(line)}</li>`;
  });
  return `<ol style="margin:0;padding:0;list-style:none">${listItems.join('')}</ol>`;
}

function buildStepCard(step: ZapStep, index: number): string {
  const color = getStepColor(step.type ?? 'action');
  const icon = getAppIcon(step.app ?? step.type ?? 'default');
  const appName = step.app_display_name ?? step.app ?? step.type ?? 'Unknown';
  const event = step.event ?? (step.type === 'filter' ? 'Only Continue If...' : '');
  const desc = step.event_description ?? step.condition ?? '';
  const instructions = step.setup_instructions ?? '';

  // Input mapping table
  let mappingHtml = '';
  if (step.input_mapping && Object.keys(step.input_mapping).length > 0) {
    const rows = Object.entries(step.input_mapping)
      .map(([field, mapping]) => `
        <tr>
          <td style="padding:7px 12px;font-family:'JetBrains Mono',monospace;font-size:12px;color:#1A1A2E;border-bottom:1px solid #F0F2F5;background:#FAFAFE">${escHtml(field)}</td>
          <td style="padding:7px 12px;font-size:12px;color:#555;border-bottom:1px solid #F0F2F5">${escHtml(mapping)}</td>
        </tr>`)
      .join('');
    mappingHtml = `
      <div style="margin-top:16px">
        <div style="font-size:12px;font-weight:700;color:#8890A0;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Field Mappings</div>
        <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #E2E5EA">
          <thead>
            <tr style="background:#F8F9FB">
              <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#8890A0;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #E2E5EA">Field</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#8890A0;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #E2E5EA">Source / Value</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // Output fields
  let outputHtml = '';
  if (step.output_fields && step.output_fields.length > 0) {
    const pills = step.output_fields
      .map((f) => `<span style="display:inline-block;padding:2px 8px;background:#F0F2F5;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:11px;color:#555;margin:2px">${escHtml(f)}</span>`)
      .join(' ');
    outputHtml = `
      <div style="margin-top:14px">
        <div style="font-size:12px;font-weight:700;color:#8890A0;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Output Fields Available to Later Steps</div>
        <div>${pills}</div>
      </div>`;
  }

  return `
    <div style="border:1px solid #E2E5EA;border-radius:12px;overflow:hidden;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,.04)">
      <!-- Step header -->
      <div style="padding:16px 20px;display:flex;align-items:center;gap:14px;background:#FAFAFE;border-bottom:1px solid #E2E5EA">
        <div style="width:40px;height:40px;border-radius:10px;background:${color}18;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${icon}</div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="display:inline-block;min-width:22px;height:22px;line-height:22px;text-align:center;background:${color};color:#fff;border-radius:50%;font-size:11px;font-weight:700">Step ${index + 1}</span>
            <span style="font-weight:700;font-size:15px;color:#1A1A2E">${escHtml(appName)}</span>
            <span style="font-size:12px;color:${color};background:${color}14;padding:2px 8px;border-radius:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">${escHtml(step.type ?? 'action')}</span>
          </div>
          ${event ? `<div style="font-size:13px;color:#555;margin-top:3px">${escHtml(event)}</div>` : ''}
          ${desc ? `<div style="font-size:12px;color:#8890A0;margin-top:2px">${escHtml(desc)}</div>` : ''}
        </div>
      </div>
      <!-- Step body -->
      <div style="padding:20px">
        <div style="font-size:12px;font-weight:700;color:#8890A0;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Setup Instructions</div>
        ${instructionsToHtml(instructions)}
        ${mappingHtml}
        ${outputHtml}
      </div>
    </div>`;
}

// ── Main guide generator ──────────────────────────────────────────────────────

function generateSetupGuide(zapJson: Record<string, unknown>): string {
  const name = String(zapJson.name ?? 'Your Zap');
  const description = String(zapJson.description ?? '');
  const steps: ZapStep[] = Array.isArray(zapJson.steps) ? zapJson.steps as ZapStep[] : [];
  const plan = String(zapJson.required_zapier_plan ?? 'Starter');
  const taskEstimate = String(zapJson.estimated_task_usage ?? 'Varies based on trigger volume');
  const setupTime = String(zapJson.setup_time_estimate ?? '20-30 minutes');
  const premiumApps: string[] = Array.isArray(zapJson.premium_apps_used) ? zapJson.premium_apps_used as string[] : [];
  const requiredAccounts: string[] = Array.isArray(zapJson.required_accounts) ? zapJson.required_accounts as string[] : [];
  const transferInstructions = String(zapJson.transfer_instructions ?? '');

  const planColors: Record<string, string> = { Free: '#22A860', Starter: '#F59E0B', Professional: '#4A8FD6', Team: '#7C5CFC', Company: '#7C5CFC' };
  const planColor = planColors[plan] ?? '#4A8FD6';

  const stepCards = steps.map((step, i) => buildStepCard(step, i)).join('');

  const premiumWarningHtml = premiumApps.length > 0 ? `
    <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:16px 20px;margin-bottom:20px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:18px">⭐</span>
        <span style="font-weight:700;font-size:14px;color:#92400E">Premium Apps Used</span>
      </div>
      <p style="font-size:13px;color:#78350F;margin:0 0 8px">The following apps count as Premium in Zapier and may incur additional task costs:</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${premiumApps.map((app) => `<span style="background:#FEF3C7;color:#92400E;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600">${escHtml(app)}</span>`).join('')}
      </div>
    </div>` : '';

  const accountsHtml = requiredAccounts.length > 0 ? `
    <div style="margin-bottom:28px">
      <h3 style="font-size:16px;font-weight:700;color:#1A1A2E;margin:0 0 14px">Required App Accounts</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">
        ${requiredAccounts.map((account) => `
          <div style="border:1px solid #E2E5EA;border-radius:10px;padding:14px 16px;background:#FAFAFE">
            <div style="font-size:22px;margin-bottom:6px">${getAppIcon(account.toLowerCase().replace(/\s+/g, '_'))}</div>
            <div style="font-weight:700;font-size:14px;color:#1A1A2E">${escHtml(account)}</div>
            <div style="font-size:12px;color:#8890A0;margin-top:2px">Account connection required</div>
          </div>`).join('')}
      </div>
    </div>` : '';

  const transferHtml = transferInstructions ? `
    <div style="margin-top:32px;border-top:1px solid #E2E5EA;padding-top:28px">
      <h3 style="font-size:16px;font-weight:700;color:#1A1A2E;margin:0 0 14px">📋 Transfer Instructions</h3>
      <div style="background:#F8F9FB;border-radius:10px;padding:20px">
        ${instructionsToHtml(transferInstructions)}
      </div>
    </div>` : '';

  const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(name)} — Zapier Setup Guide | ManageAI</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', 'Helvetica Neue', sans-serif; background: #F8F9FB; color: #1A1A2E; line-height: 1.6; }
    @media print {
      body { background: #fff; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }
    @media (max-width: 720px) {
      .main-grid { grid-template-columns: 1fr !important; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1A1A2E,#2A2A4E);padding:20px 40px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;print-color-adjust:exact">
    <div style="display:flex;align-items:center;gap:16px">
      <div style="font-size:20px;font-weight:700;letter-spacing:-.3px">
        <span style="color:#fff">MANAGE</span><span style="color:#4A8FD6">AI</span>
      </div>
      <div style="width:1px;height:24px;background:rgba(255,255,255,.2)"></div>
      <div style="font-size:13px;color:rgba(255,255,255,.6)">Zapier Setup Guide</div>
    </div>
    <div style="display:flex;align-items:center;gap:12px">
      <span style="background:${planColor}20;color:${planColor};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;border:1px solid ${planColor}40">${escHtml(plan)} Plan Required</span>
      <button class="no-print" onclick="window.print()" style="background:#4A8FD6;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">🖨 Print Guide</button>
    </div>
  </div>

  <!-- Hero -->
  <div style="background:linear-gradient(135deg,#FF4A0008,#4A8FD608);border-bottom:1px solid #E2E5EA;padding:40px">
    <div style="max-width:840px;margin:0 auto">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <span style="font-size:32px">⚡</span>
        <div>
          <h1 style="font-size:26px;font-weight:700;color:#1A1A2E;line-height:1.2">${escHtml(name)}</h1>
          <div style="font-size:14px;color:#8890A0;margin-top:4px">Zapier Automation Setup Guide</div>
        </div>
      </div>
      ${description ? `<p style="font-size:15px;color:#555;max-width:680px;line-height:1.7">${escHtml(description)}</p>` : ''}

      <!-- Stats row -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-top:24px" class="main-grid">
        <div style="background:#fff;border:1px solid #E2E5EA;border-radius:10px;padding:14px 16px;text-align:center">
          <div style="font-size:24px;font-weight:700;font-family:'JetBrains Mono',monospace;color:#FF4A00">${steps.length}</div>
          <div style="font-size:12px;color:#8890A0;margin-top:2px">Zap Steps</div>
        </div>
        <div style="background:#fff;border:1px solid #E2E5EA;border-radius:10px;padding:14px 16px;text-align:center">
          <div style="font-size:16px;font-weight:700;font-family:'JetBrains Mono',monospace;color:#4A8FD6;word-break:break-all">${escHtml(plan)}</div>
          <div style="font-size:12px;color:#8890A0;margin-top:2px">Required Plan</div>
        </div>
        <div style="background:#fff;border:1px solid #E2E5EA;border-radius:10px;padding:14px 16px;text-align:center">
          <div style="font-size:16px;font-weight:700;color:#22A860">${escHtml(setupTime)}</div>
          <div style="font-size:12px;color:#8890A0;margin-top:2px">Setup Time</div>
        </div>
        <div style="background:#fff;border:1px solid #E2E5EA;border-radius:10px;padding:14px 16px;text-align:center">
          <div style="font-size:13px;font-weight:600;color:#E5A200">${escHtml(taskEstimate.split(',')[0])}</div>
          <div style="font-size:12px;color:#8890A0;margin-top:2px">Task Usage</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Main content -->
  <div style="max-width:840px;margin:0 auto;padding:40px">

    <!-- Step 0: Before You Begin -->
    <div style="margin-bottom:36px">
      <h2 style="font-size:20px;font-weight:700;color:#1A1A2E;margin-bottom:16px;display:flex;align-items:center;gap:10px">
        <span style="width:32px;height:32px;background:#FF4A00;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:800;flex-shrink:0">0</span>
        Before You Begin
      </h2>

      <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:16px 20px;margin-bottom:16px">
        <div style="font-weight:700;font-size:13px;color:#1E40AF;margin-bottom:6px">📋 Prerequisites Checklist</div>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px">
          <li style="display:flex;align-items:flex-start;gap:8px;font-size:13px;color:#1E40AF"><span>☐</span> Zapier account with <strong>${escHtml(plan)}</strong> plan (or higher)</li>
          ${requiredAccounts.map((acc) => `<li style="display:flex;align-items:flex-start;gap:8px;font-size:13px;color:#1E40AF"><span>☐</span> Active <strong>${escHtml(acc)}</strong> account</li>`).join('')}
          <li style="display:flex;align-items:flex-start;gap:8px;font-size:13px;color:#1E40AF"><span>☐</span> Access to zapier.com — log in before starting</li>
        </ul>
      </div>

      ${premiumWarningHtml}
      ${accountsHtml}

      <div style="background:#F0FFF4;border:1px solid #BBF7D0;border-radius:10px;padding:14px 18px">
        <div style="font-size:13px;color:#166534">
          <strong>💡 Pro tip:</strong> Connect all app accounts in Zapier first (My Apps → Add Connection) before building the Zap. This speeds up configuration significantly.
        </div>
      </div>
    </div>

    <!-- Steps -->
    <div style="margin-bottom:36px">
      <h2 style="font-size:20px;font-weight:700;color:#1A1A2E;margin-bottom:6px;display:flex;align-items:center;gap:10px">
        <span style="width:32px;height:32px;background:#4A8FD6;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:800;flex-shrink:0">1</span>
        Build the Zap — Step by Step
      </h2>
      <p style="font-size:13px;color:#8890A0;margin-bottom:20px">Follow these steps in order. Test each step using Zapier's built-in <strong>Test</strong> button before moving to the next.</p>
      ${stepCards || '<p style="color:#8890A0;font-style:italic">No steps defined in workflow JSON.</p>'}
    </div>

    <!-- Task usage -->
    <div style="margin-bottom:36px">
      <h2 style="font-size:20px;font-weight:700;color:#1A1A2E;margin-bottom:16px;display:flex;align-items:center;gap:10px">
        <span style="width:32px;height:32px;background:#F59E0B;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:800;flex-shrink:0">2</span>
        Task Usage &amp; Plan Sizing
      </h2>
      <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:20px">
        <div style="font-size:14px;color:#78350F;font-weight:600;margin-bottom:10px">Estimated Usage</div>
        <div style="font-size:15px;color:#92400E;font-family:'JetBrains Mono',monospace">${escHtml(taskEstimate)}</div>
        <div style="margin-top:14px;font-size:13px;color:#78350F;line-height:1.7">
          <strong>Plan limits for reference:</strong><br>
          • Starter: 750 tasks/month — suitable for low-volume automations<br>
          • Professional: 2,000 tasks/month — most business automations<br>
          • Team: 50,000 tasks/month — high-volume or multi-team usage<br>
          Filter steps that <em>stop</em> the Zap do not count toward task usage.
        </div>
      </div>
    </div>

    <!-- Zap management -->
    <div style="margin-bottom:36px">
      <h2 style="font-size:20px;font-weight:700;color:#1A1A2E;margin-bottom:16px;display:flex;align-items:center;gap:10px">
        <span style="width:32px;height:32px;background:#22A860;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:800;flex-shrink:0">3</span>
        Managing Your Zap After Go-Live
      </h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px" class="main-grid">
        <div style="background:#fff;border:1px solid #E2E5EA;border-radius:10px;padding:16px">
          <div style="font-weight:700;font-size:13px;color:#1A1A2E;margin-bottom:8px">📊 Monitoring</div>
          <ul style="list-style:disc;padding-left:18px;font-size:13px;color:#555;line-height:1.8">
            <li>Go to <strong>My Zaps</strong> to see all active Zaps</li>
            <li>Click a Zap → <strong>Task History</strong> to see all runs</li>
            <li>Failed runs show error details — click to debug</li>
            <li>Filter by date range, status, or step</li>
          </ul>
        </div>
        <div style="background:#fff;border:1px solid #E2E5EA;border-radius:10px;padding:16px">
          <div style="font-weight:700;font-size:13px;color:#1A1A2E;margin-bottom:8px">✏️ Editing</div>
          <ul style="list-style:disc;padding-left:18px;font-size:13px;color:#555;line-height:1.8">
            <li>Turn off the Zap before making changes</li>
            <li>Use the <strong>Draft</strong> state to test edits safely</li>
            <li>Re-publish when edits are tested and ready</li>
            <li>Duplicate the Zap before major changes</li>
          </ul>
        </div>
        <div style="background:#fff;border:1px solid #E2E5EA;border-radius:10px;padding:16px">
          <div style="font-weight:700;font-size:13px;color:#1A1A2E;margin-bottom:8px">🔔 Error Alerts</div>
          <ul style="list-style:disc;padding-left:18px;font-size:13px;color:#555;line-height:1.8">
            <li>Settings → Notifications → set email for Zap errors</li>
            <li>Set how many consecutive failures before alert</li>
            <li>Zapier pauses a Zap after too many failures</li>
          </ul>
        </div>
        <div style="background:#fff;border:1px solid #E2E5EA;border-radius:10px;padding:16px">
          <div style="font-weight:700;font-size:13px;color:#1A1A2E;margin-bottom:8px">🧪 Testing</div>
          <ul style="list-style:disc;padding-left:18px;font-size:13px;color:#555;line-height:1.8">
            <li>Use <strong>Test &amp; Review</strong> before publishing</li>
            <li>Each step has its own Test button in the editor</li>
            <li>Use Zapier's <strong>Replay</strong> to re-run a failed task</li>
          </ul>
        </div>
      </div>
    </div>

    ${transferHtml}

    <!-- Go-live checklist -->
    <div style="margin-top:36px;border-top:1px solid #E2E5EA;padding-top:28px">
      <h2 style="font-size:20px;font-weight:700;color:#1A1A2E;margin-bottom:16px">✅ Go-Live Checklist</h2>
      <div style="background:#fff;border:1px solid #E2E5EA;border-radius:12px;padding:20px">
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
          ${[
            'All required app accounts connected in Zapier (My Apps → Add Connection)',
            'Step 1 Trigger tested — sample data retrieved and verified',
            ...steps.slice(1).map((s) => `Step ${s.position} (${s.app_display_name ?? s.app ?? 'Action'}) tested with the Test button`),
            'Full Zap tested end-to-end in draft mode',
            'Filter conditions verified with both passing and failing sample data',
            'Task usage reviewed — within plan limit',
            'Error notification email configured in Zapier Settings',
            'Zap published (turned ON)',
            'First live Zap run verified in Task History',
          ].map((item) => `<li style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid #F0F2F5">
              <span style="width:20px;height:20px;border:2px solid #D1D5DB;border-radius:4px;flex-shrink:0;margin-top:1px"></span>
              <span style="font-size:13px;color:#374151">${escHtml(item)}</span>
            </li>`).join('')}
        </ul>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div style="border-top:1px solid #E2E5EA;padding:20px 40px;display:flex;justify-content:space-between;align-items:center;background:#F8F9FB;margin-top:20px">
    <div style="font-size:13px;font-weight:700">
      <span style="color:#1A1A2E">MANAGE</span><span style="color:#4A8FD6">AI</span>
    </div>
    <div style="font-size:11px;color:#8890A0;text-align:center">${escHtml(name)} — Zapier Setup Guide · Generated ${escHtml(now)}</div>
    <div style="font-size:11px;color:#8890A0">CONFIDENTIAL — ManageAI Delivery</div>
  </div>
</body>
</html>`;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Zapier does not have a public REST API for programmatic Zap creation.
 * This deployer generates a comprehensive HTML setup guide from the Zap JSON.
 */
export async function deployToZapier(
  zapJson: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _config: ZapierConfig
): Promise<ZapierDeployResult> {
  const zapName = String(zapJson.name ?? 'Your Automation');
  const steps: ZapStep[] = Array.isArray(zapJson.steps) ? zapJson.steps as ZapStep[] : [];

  // Build plain-text instructions for the deployments DB record
  const stepList = steps
    .map((s) => `  ${s.position ?? '?'}. [${String(s.type ?? 'action').toUpperCase()}] ${s.app_display_name ?? s.app ?? 'Unknown'} — ${s.event ?? ''}`)
    .join('\n');

  const instructions = `Zapier Manual Setup Guide generated for "${zapName}".

ZAP STEPS:
${stepList || '  (see workflow JSON for full step list)'}

Required Zapier Plan: ${String(zapJson.required_zapier_plan ?? 'Professional')}
Estimated Setup Time: ${String(zapJson.setup_time_estimate ?? '20-30 minutes')}
Task Usage: ${String(zapJson.estimated_task_usage ?? 'Varies')}

A detailed HTML setup guide has been generated. Download it from your deliverables.
Follow the step-by-step instructions in the guide to recreate this Zap in your Zapier account.`.trim();

  const setupGuideHtml = generateSetupGuide(zapJson);

  return {
    success: true,
    type: 'manual',
    instructions,
    setupGuideHtml,
    estimatedSetupTime: String(zapJson.setup_time_estimate ?? '20-30 minutes'),
  };
}
