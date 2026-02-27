import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, buildCompleteHtml } from '@/lib/email/notifications';
import { buildMakeComPrompt, getMakeBuildPlanAddendum, getMakeDemoAddendum } from '@/lib/platforms/make/prompt-builder';
import {
  ZAPIER_WORKFLOW_SYSTEM,
  buildZapierWorkflowUserMessage,
  getZapierBuildPlanAddendum,
  getZapierDemoAddendum,
} from '@/lib/platforms/zapier/prompt-builder';

// Allow up to 5 minutes — parallel Claude calls + optional MCP lookup
export const maxDuration = 300;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** Upload a string as a file to Supabase Storage using Buffer (server-safe) */
async function uploadToStorage(path: string, content: string, contentType: string): Promise<void> {
  const supabase = getSupabase();
  console.log(`[generate-build] Uploading ${path} (${content.length} chars, ${contentType})...`);
  const buffer = Buffer.from(content, 'utf-8');
  const { error } = await supabase.storage
    .from('ticket-files')
    .upload(path, buffer, { contentType, upsert: true });
  if (error) {
    console.error(`[generate-build] Storage upload failed for ${path}:`, error);
    throw new Error(`Storage upload failed for ${path}: ${error.message}`);
  }
  console.log(`[generate-build] Uploaded ${path} successfully`);
}

// ── n8n-MCP Integration ───────────────────────────────────────────────────────
// Uses https://github.com/czlonkowski/n8n-mcp — a local MCP server with
// 1,084 n8n node definitions. Falls back gracefully if unavailable.

async function getN8nNodeContext(description: string): Promise<string> {
  const CONNECT_TIMEOUT_MS = 15000;
  const TOOL_TIMEOUT_MS = 20000;

  try {
    console.log('[n8n-mcp] Attempting to connect to n8n-MCP server...');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Client } = require('@modelcontextprotocol/sdk/client') as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Client: new (info: object, opts: object) => any;
    };

    const clientIndexPath = require.resolve('@modelcontextprotocol/sdk/client') as string;
    const stdioPath = clientIndexPath.replace(/index\.js$/, 'stdio.js');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { StdioClientTransport } = require(stdioPath) as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      StdioClientTransport: new (opts: object) => any;
    };

    const serverPath = require.resolve('n8n-mcp');
    console.log('[n8n-mcp] Server path:', serverPath);

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverPath],
      env: { ...process.env },
    });

    const client = new Client(
      { name: 'manageai-generate-build', version: '1.0.0' },
      { capabilities: {} }
    );

    await Promise.race([
      client.connect(transport),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('n8n-MCP connect timeout after 15s')), CONNECT_TIMEOUT_MS)
      ),
    ]);
    console.log('[n8n-mcp] Connected successfully');

    const toolsResult = await client.listTools();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolNames: string[] = toolsResult.tools.map((t: any) => t.name);
    console.log('[n8n-mcp] Available tools:', toolNames);

    let nodeContext = '';

    const searchToolName = toolNames.find(
      (n) => n === 'search_nodes' || n === 'get_node_for_task' || n.includes('search')
    );

    if (searchToolName) {
      const query = description.slice(0, 500);
      console.log(`[n8n-mcp] Calling ${searchToolName}...`);

      const searchResult = await Promise.race([
        client.callTool({ name: searchToolName, arguments: { query, limit: 12 } }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('n8n-MCP search timeout')), TOOL_TIMEOUT_MS)
        ),
      ]);

      const resultStr = JSON.stringify(searchResult.content, null, 2);
      nodeContext += `\n\n=== RELEVANT N8N NODES (from n8n-MCP node database) ===\n${resultStr.slice(0, 8000)}`;
      console.log('[n8n-mcp] Got', resultStr.length, 'chars of node context');
    }

    await client.close();
    console.log('[n8n-mcp] Session closed. Node context chars:', nodeContext.length);
    return nodeContext;
  } catch (err) {
    console.log('[n8n-mcp] MCP unavailable — using Claude-only generation:', (err as Error).message);
    return '';
  }
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  console.log('\n========== [generate-build] POST called ==========');

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (e) {
    console.error('[generate-build] Failed to parse request body:', e);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { ticket_id } = body as { ticket_id: string };
  console.log('[generate-build] ticket_id:', ticket_id);

  if (!ticket_id) {
    return NextResponse.json({ error: 'ticket_id is required' }, { status: 400 });
  }

  // ── 1. Fetch ticket ──────────────────────────────────────────────────────
  console.log('[generate-build] Fetching ticket...');
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', ticket_id)
    .single();

  if (ticketError || !ticket) {
    console.error('[generate-build] Ticket fetch error:', ticketError);
    return NextResponse.json({ error: 'Ticket not found: ' + ticketError?.message }, { status: 404 });
  }

  console.log('[generate-build] Ticket:', {
    company: ticket.company_name,
    project: ticket.project_name,
    platform: ticket.ticket_type,
    status: ticket.status,
  });

  // ── 2. Fetch ticket assets ───────────────────────────────────────────────
  const { data: assets } = await supabase
    .from('ticket_assets')
    .select('*')
    .eq('ticket_id', ticket_id);

  const assetSummary = (assets ?? [])
    .map((a) => `- ${a.file_name || a.external_url} (${a.category}, ${a.asset_type})`)
    .join('\n');

  // ── 3. Build rich context ────────────────────────────────────────────────
  const answeredQuestions = Array.isArray(ticket.ai_questions)
    ? ticket.ai_questions
        .filter((q: { answer?: string }) => q.answer)
        .map((q: { question: string; answer: string }) => `Q: ${q.question}\nA: ${q.answer}`)
        .join('\n\n')
    : '';

  const context = [
    `=== PROJECT OVERVIEW ===`,
    `Company: ${ticket.company_name}`,
    `Project: ${ticket.project_name || 'Automation Project'}`,
    `Platform: ${ticket.ticket_type.toUpperCase()}`,
    `Priority: ${ticket.priority}`,
    `Complexity: ${ticket.complexity_estimate || 'moderate'}`,
    ``,
    `=== WHAT TO BUILD ===`,
    ticket.what_to_build || 'Not specified',
    ``,
    `=== EXPECTED OUTCOME ===`,
    ticket.expected_outcome || 'Not specified',
    ``,
    `=== AI ANALYSIS ===`,
    ticket.ai_understanding || ticket.ai_summary || 'See project description above',
    answeredQuestions ? `\n=== CLARIFICATIONS Q&A ===\n${answeredQuestions}` : '',
    assetSummary ? `\n=== UPLOADED DOCUMENTS ===\n${assetSummary}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  console.log('[generate-build] Context length:', context.length, 'chars');

  // ── 4. Template matching ─────────────────────────────────────────────────
  // Extract meaningful keywords from the ticket to find relevant templates.
  console.log('[generate-build] Fetching matching templates from library...');

  const STOP_WORDS = new Set(['with', 'from', 'that', 'this', 'when', 'then', 'will', 'have', 'send', 'into', 'each', 'form', 'data', 'user', 'your', 'they', 'them', 'their', 'make', 'need', 'want', 'should']);
  const keywords = (ticket.what_to_build ?? '')
    .toLowerCase()
    .split(/\W+/)
    .filter((w: string) => w.length >= 4 && !STOP_WORDS.has(w))
    .slice(0, 4);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let matchingTemplates: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let bestMatchTemplate: any | null = null;

  if (keywords.length > 0) {
    const orFilter = keywords
      .map((kw: string) => `description.ilike.%${kw}%,name.ilike.%${kw}%`)
      .join(',');
    const { data: keywordMatches } = await supabase
      .from('templates')
      .select('name, description, category, tags, workflow_json')
      .eq('platform', ticket.ticket_type)
      .or(orFilter)
      .limit(5);
    if (keywordMatches && keywordMatches.length > 0) {
      matchingTemplates = keywordMatches;
      bestMatchTemplate = keywordMatches[0];
    }
  }

  // Fall back to unfiltered first-8 if no keyword matches
  if (matchingTemplates.length === 0) {
    const { data: fallbackTemplates } = await supabase
      .from('templates')
      .select('name, description, category, tags')
      .eq('platform', ticket.ticket_type)
      .limit(8);
    matchingTemplates = fallbackTemplates ?? [];
  }

  // Build the template context string for Claude.
  // If we found a keyword-matched template with workflow_json, include its
  // structure (capped to ~3000 chars) so Claude can adapt it.
  let templateMatchContext = '';
  if (matchingTemplates.length > 0) {
    const templateList = matchingTemplates
      .map((t) => `- "${t.name}" [${t.category}]: ${t.description}`)
      .join('\n');
    templateMatchContext = `\n\nEXISTING TEMPLATE LIBRARY — Review these templates for the ${ticket.ticket_type} platform. If one closely matches the requirements, use it as a starting point and customize it. If none match well, generate from scratch:\n${templateList}`;

    if (bestMatchTemplate?.workflow_json) {
      const wfJsonStr = JSON.stringify(bestMatchTemplate.workflow_json);
      templateMatchContext += `\n\nBEST-MATCH TEMPLATE JSON (adapt this structure — do not copy verbatim):\n${wfJsonStr.slice(0, 3000)}${wfJsonStr.length > 3000 ? '\n...(truncated)' : ''}`;
    }
  }

  const matchedTemplateName = bestMatchTemplate?.name ?? matchingTemplates.find((t) => {
    const what = (ticket.what_to_build || '').toLowerCase();
    const name = t.name.toLowerCase();
    const desc = (t.description || '').toLowerCase();
    return what.includes(name.split(' ')[0]) || desc.split(' ').some((w: string) => w.length > 5 && what.includes(w));
  })?.name ?? null;

  console.log('[generate-build] Found', matchingTemplates.length, 'platform templates. Best match:', matchedTemplateName ?? 'none');

  // ── 5. n8n-MCP: Look up node configs (n8n only) ──────────────────────────
  let mcpNodeContext = '';
  if (ticket.ticket_type === 'n8n') {
    console.log('[generate-build] Querying n8n-MCP for node context...');
    const descriptionForMCP = [ticket.what_to_build, ticket.ai_understanding, ticket.project_name]
      .filter(Boolean)
      .join(' ')
      .slice(0, 800);
    mcpNodeContext = await getN8nNodeContext(descriptionForMCP);
    console.log('[generate-build] MCP node context length:', mcpNodeContext.length, 'chars');
  }

  console.log('[generate-build] Launching 3 parallel Claude API calls...');
  const overallStart = Date.now();

  // ── 6. Build platform-specific workflow prompt ───────────────────────────
  // Cap MCP context to prevent token overflow
  const mcpContextCapped = mcpNodeContext.slice(0, 4000);
  // Cap template context
  const templateContextCapped = templateMatchContext.slice(0, 2000);

  const n8nWorkflowSystem = `You are an expert n8n automation engineer. Generate a complete, importable n8n workflow definition JSON.

A workflow definition is a JSON FILE that describes the structure of the automation: which nodes exist and how they connect. This is NOT runtime data and does NOT use n8n expressions ({{ }} syntax). Parameter values should be literal strings, numbers, or booleans.

The JSON must have this exact shape:
{
  "name": "Descriptive Workflow Name",
  "nodes": [
    {
      "id": "1a2b3c4d-0000-0000-0000-000000000001",
      "name": "Webhook Trigger",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300],
      "parameters": {
        "httpMethod": "POST",
        "path": "my-webhook",
        "responseMode": "onReceived"
      }
    },
    {
      "id": "1a2b3c4d-0000-0000-0000-000000000002",
      "name": "Process Data",
      "type": "n8n-nodes-base.set",
      "typeVersion": 3,
      "position": [470, 300],
      "parameters": {
        "fields": { "values": [{ "name": "processedAt", "stringValue": "={{ $now }}" }] }
      }
    }
  ],
  "connections": {
    "Webhook Trigger": {
      "main": [[{ "node": "Process Data", "type": "main", "index": 0 }]]
    }
  },
  "settings": { "executionOrder": "v1" },
  "active": false,
  "tags": []
}

Use real n8n node types: n8n-nodes-base.webhook, n8n-nodes-base.httpRequest, n8n-nodes-base.set, n8n-nodes-base.if, n8n-nodes-base.merge, n8n-nodes-base.splitInBatches, n8n-nodes-base.slack, n8n-nodes-base.gmail, n8n-nodes-base.hubspot, n8n-nodes-base.salesforce, n8n-nodes-base.airtable, n8n-nodes-base.notion, n8n-nodes-base.googleSheets, n8n-nodes-base.sendGrid, n8n-nodes-base.bambooHr, n8n-nodes-base.zoom.

Include 6-10 nodes with realistic parameters for the specific use case.${templateContextCapped}${mcpContextCapped ? '\n\nAvailable n8n nodes:\n' + mcpContextCapped : ''}`;

  const workflowSystemPrompt =
    ticket.ticket_type === 'n8n'
      ? n8nWorkflowSystem
      : ticket.ticket_type === 'make'
      ? buildMakeComPrompt({ templateContext: templateContextCapped })
      : `${ZAPIER_WORKFLOW_SYSTEM}\n${templateContextCapped}`;

  // ── 7. Run all 3 AI generations in parallel ──────────────────────────────
  let buildPlanHtml: string;
  let demoHtml: string;
  let workflowJson: string;

  try {
    const [buildPlanMsg, demoMsg, workflowMsg] = await Promise.all([
      // ── Build Plan HTML ──────────────────────────────────────────────────
      anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: `You are a senior automation engineer at ManageAI creating a premium, interactive client-facing build manual.

Generate a COMPLETE, self-contained HTML file that is a tabbed React application. Use React 18 via CDN with React.createElement (NO JSX). This must match ManageAI's Cornerstone design standard — polished enough to send directly to an enterprise client.

=== MANDATORY STRUCTURE ===
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>[Project Name] — Build Plan | ManageAI</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', 'Helvetica Neue', sans-serif; background: #FFFFFF; color: #1A1A2E; line-height: 1.6; }
    @keyframes slideIn { from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)} }
    @keyframes floatUp { 0%{opacity:0;transform:translateY(0) scale(1)}10%{opacity:.15}90%{opacity:0}100%{opacity:0;transform:translateY(-800px) scale(0)} }
    @keyframes pulseGlow { 0%,100%{box-shadow:0 0 15px rgba(74,143,214,.06)}50%{box-shadow:0 0 30px rgba(74,143,214,.18)} }
    @keyframes pulseDot { 0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.4);opacity:1} }
    :root { --accent:#4A8FD6; --accent-dim:rgba(74,143,214,0.07); --bg:#FFFFFF; --surface:#F8F9FB; --surface2:#F0F2F5; --border:#E2E5EA; --text:#1A1A2E; --text-dim:#8890A0; --text-mid:#5A6070; --success:#22A860; --warning:#E5A200; --danger:#E04848; --logo:#2A2A3E; --purple:#7C5CFC; --orange:#E8723A; --teal:#1AA8A8; --mono:'JetBrains Mono',monospace; }
    .particle { position:fixed; border-radius:50%; pointer-events:none; animation:floatUp linear infinite; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    const e = React.createElement;
    const { useState, useEffect, useRef } = React;
    const C = { accent:'#4A8FD6', accentDim:'rgba(74,143,214,0.07)', bg:'#FFFFFF', surface:'#F8F9FB', surface2:'#F0F2F5', border:'#E2E5EA', text:'#1A1A2E', textDim:'#8890A0', textMid:'#5A6070', success:'#22A860', warning:'#E5A200', danger:'#E04848', logo:'#2A2A3E', purple:'#7C5CFC', orange:'#E8723A', teal:'#1AA8A8' };
    // ... full React app using React.createElement ...
    ReactDOM.createRoot(document.getElementById('root')).render(e(App, null));
  </script>
</body>
</html>

=== TABS (6 required) ===
1. Overview — KPI impact cards (time saved, steps automated, systems connected, complexity) + architecture flow diagram (flex row of labeled step boxes with → connectors) + key principles list
2. Setup & Accounts — account cards for every required service (icon circle with colored bg, name, purpose, connection string in JetBrains Mono, setup notes)
3. Build Steps — expandable accordion cards, one per workflow node/module. Each card: step number, node name, node type badge, expanded view shows: purpose, configuration parameters in monospace, data inputs/outputs, common issues
4. Requirements — functional requirements table with columns: ID | Requirement | Maps To | Priority. Use FRxx IDs. Alternating row shading.
5. Timeline — phased delivery bars with week ranges. Phase 1 (Setup), Phase 2 (Core Build), Phase 3 (Testing), Phase 4 (Go-Live). Each phase: color-coded bar, deliverables list, duration
6. Go-Live — interactive checklist (clicking checks off items with green fill + strikethrough). Two sections: Pre-Launch Checklist + Open Questions. Track completion percentage with a progress bar.

=== HEADER (required on every tab) ===
Fixed header, background: linear-gradient(135deg,#F8F9FB,#FFFFFF), border-bottom: 1px solid #E2E5EA, padding 16px 32px, flex row:
- Left: "MANAGE" (#2A2A3E, 700 weight) + "AI" (#4A8FD6, 700 weight) in 22px, vertical divider, client name + document type in 13px #8890A0
- Center: tab buttons (active = #4A8FD6 bg white text rounded pill, inactive = transparent #8890A0)
- Right: version badge + date

=== BACKGROUND ===
Behind content (not on header): subtle grid pattern — background-image: linear-gradient(#E2E5EA33 1px,transparent 1px),linear-gradient(90deg,#E2E5EA33 1px,transparent 1px); background-size:60px 60px
12 floating particle divs: random sizes 4-10px, colors from palette at low opacity, random positions, floatUp animation with staggered delays 0-25s, duration 18-35s

=== CARD PATTERNS ===
KPI cards: padding 20px, borderRadius 12px, background #F8F9FB, border 1px solid #E2E5EA, textAlign center. Icon (28px emoji or SVG) on top, large number (28px, fontFamily JetBrains Mono, color #4A8FD6) middle, label (12px #8890A0) bottom. Hover: transform translateY(-2px), box-shadow 0 8px 24px rgba(0,0,0,.08)
Expandable accordion: header row (step number circle in #4A8FD6, name, type badge, expand chevron). On click toggle expanded section with slideIn animation. Expanded: configuration block in JetBrains Mono on #1A1A2E bg, data mapping table
Account cards: 40px icon circle with colored background, 13px font-weight 600 name, 11px #8890A0 description, monospace connection string in a pill
Callout boxes (info/warning/success): 8% opacity background of the color, 22% opacity left border 3px, icon + title bold + description

=== FOOTER ===
Padding 24px 32px, border-top #E2E5EA, flex justify-between:
- Left: "MANAGE" + "AI" branding (same as header, smaller)
- Center: document name + version + generated date
- Right: "CONFIDENTIAL — Prepared for [Client Name]"
All text: 11px #8890A0

=== CRITICAL RULES ===
- Output ONLY the complete HTML. First character must be <!DOCTYPE html>
- ALL content is specific to the ticket's client, project, and automation — no generic filler
- Use React.createElement throughout, never JSX
- Every section animates in with slideIn + staggered delay (style={{animation:'slideIn .4s ease both', animationDelay:'Xs'}})
- JetBrains Mono for: IDs, parameters, connection strings, node types, code values
- DM Sans for all other text
- The Go-Live checklist must have real, specific checklist items derived from the project (not generic ones)
- Build Steps must have one card per actual integration/node in the workflow (minimum 5)
- Inline all styles — no external CSS files
- Make it premium enough to impress an enterprise client`,
        messages: [
          {
            role: 'user',
            content: `Generate the complete build plan for:\n\n${context}${ticket.ticket_type === 'zapier' ? getZapierBuildPlanAddendum() : ticket.ticket_type === 'make' ? getMakeBuildPlanAddendum() : ''}`,
          },
        ],
      }),

      // ── Solution Demo HTML ───────────────────────────────────────────────
      anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: `You are creating a premium interactive client demo at ManageAI showing an automation solution.

Generate a COMPLETE, self-contained HTML file — a tabbed React application using React 18 via CDN with React.createElement (NO JSX). This matches ManageAI's Cornerstone design standard.

=== MANDATORY STRUCTURE ===
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>[Project Name] — Solution Demo | ManageAI</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', 'Helvetica Neue', sans-serif; background: #FFFFFF; color: #1A1A2E; }
    @keyframes slideIn { from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)} }
    @keyframes floatUp { 0%{opacity:0;transform:translateY(0) scale(1)}10%{opacity:.15}90%{opacity:0}100%{opacity:0;transform:translateY(-800px) scale(0)} }
    @keyframes countUp { from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)} }
    @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.5} }
    @keyframes dataFlow { 0%{transform:translateX(-100%);opacity:0}50%{opacity:1}100%{transform:translateX(100%);opacity:0} }
    :root { --accent:#4A8FD6; --surface:#F8F9FB; --border:#E2E5EA; --text:#1A1A2E; --text-dim:#8890A0; --success:#22A860; --purple:#7C5CFC; --orange:#E8723A; --teal:#1AA8A8; }
    .particle { position:fixed; border-radius:50%; pointer-events:none; animation:floatUp linear infinite; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    const e = React.createElement;
    const { useState, useEffect, useRef, useCallback } = React;
    // ... full app ...
    ReactDOM.createRoot(document.getElementById('root')).render(e(App, null));
  </script>
</body>
</html>

=== TABS (6 required) ===
1. Overview — Hero section: large headline ("Automating [X] for [Company]"), 1-sentence impact statement, 3 benefit pills. Below: 4 KPI impact cards (time saved per week, steps automated, error reduction %, ROI multiplier) in JetBrains Mono numbers. Then: "What This Does" paragraph.
2. How It Works — Visual flow diagram: flex row of step cards connected by animated → arrows. Each step: colored numbered circle, emoji icon, step name (bold), 1-line description. Below: written explanation of the full flow in plain language. Steps must be specific to this automation.
3. Live Demo — Interactive walkthrough. Shows a realistic simulation of the automation running:
   • A "Run Demo" button that when clicked, animates through each step with status indicators (⏳→✅)
   • Shows realistic sample data specific to the use case: if it's an email workflow, show a simulated email. If CRM, show a contact record. If Slack, show a message preview. Each step reveals its output.
   • A "Reset" button to run again
   • Progress bar showing automation completion
4. Architecture — Tech stack section: cards for each integration (platform logo placeholder, name, purpose, connection type). Integration diagram showing data flow between systems. "What ManageAI Configures" vs "What You Provide" two-column table.
5. ROI Calculator — Editable input fields: hours/week currently spent manually, team size, hourly rate, error rate. Calculated outputs animate as numbers change: time saved/week, cost saved/month, annual ROI, payback period. Show formula explanation. All numbers in JetBrains Mono with countUp animation when tab activates.
6. Next Steps — Implementation timeline: horizontal phase bars (Week 1: Setup, Week 2-3: Build, Week 4: Testing, Week 5: Go-Live). What ManageAI delivers (checklist). What client provides (checklist). CTA button: "Schedule Kickoff Call" (blue, prominent).

=== HEADER (same as build plan) ===
Fixed header, gradient background, ManageAI branding, tab navigation, version + date.

=== BACKGROUND ===
Subtle grid + 10 floating particles.

=== LIVE DEMO REQUIREMENTS ===
The Live Demo tab must be genuinely interactive:
- Show realistic data specific to THIS automation (not generic "Lorem ipsum")
- If the workflow involves emails → show a styled email preview
- If it involves CRM data → show a contact/deal card
- If it involves Slack → show a Slack-style message bubble
- Each automation step should light up sequentially with a 800ms delay between steps
- Final state shows all steps green with a success message

=== ROI CALCULATOR REQUIREMENTS ===
- Input fields must be editable (React controlled state)
- Default values must be realistic for the use case
- Calculations update in real-time as user types
- Animate the output numbers with a brief scale animation on change
- Show the math: display formula text below each result

=== CRITICAL RULES ===
- Output ONLY the complete HTML. First character must be <!DOCTYPE html>
- ALL content, data, steps, and examples are SPECIFIC to the client's automation — no generic examples
- Use React.createElement throughout, never JSX
- JetBrains Mono for: numbers, metrics, code values, IDs
- DM Sans for all prose text
- The demo simulation must use realistic data from the ticket context (company name, use case, systems)
- Inline all styles
- Mobile responsive (max-width 960px centered, single column on mobile)
- Footer: ManageAI branding + "CONFIDENTIAL — Prepared for [Client Name]" + version`,
        messages: [
          {
            role: 'user',
            content: `Generate the interactive solution demo for:\n\n${context}${ticket.ticket_type === 'zapier' ? getZapierDemoAddendum() : ticket.ticket_type === 'make' ? getMakeDemoAddendum() : ''}`,
          },
        ],
      }),

      // ── Workflow JSON ────────────────────────────────────────────────────
      anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 12000,
        system: workflowSystemPrompt,
        messages: [
          {
            role: 'user',
            content: ticket.ticket_type === 'n8n'
              ? `Generate the complete n8n workflow definition JSON for this project:\n\n${context}\n\nIMPORTANT: Output only the JSON object that would be saved as a .json file and imported into n8n. Do NOT output n8n runtime expressions like {{ $json }}.`
              : ticket.ticket_type === 'make'
              ? `Generate the complete Make.com scenario blueprint JSON for this project:\n\n${context}\n\nIMPORTANT: Output only the JSON object. Use the "flow" array (not "modules"). Follow Make.com module naming: "app:moduleName".`
              : buildZapierWorkflowUserMessage(context),
          },
        ],
      }),
    ]);

    buildPlanHtml =
      buildPlanMsg.content[0].type === 'text'
        ? buildPlanMsg.content[0].text
        : '<html><body><p>Error generating build plan</p></body></html>';

    demoHtml =
      demoMsg.content[0].type === 'text'
        ? demoMsg.content[0].text
        : '<html><body><p>Error generating demo</p></body></html>';

    workflowJson = workflowMsg.content[0].type === 'text' ? workflowMsg.content[0].text : '{}';

    // If workflow response is suspiciously short (<500 chars), retry once
    if (workflowJson.trim().length < 500) {
      console.warn('[generate-build] Workflow JSON too short (' + workflowJson.length + ' chars) — retrying...');
      const retryUserContent =
        ticket.ticket_type === 'make'
          ? `Generate the complete Make.com scenario blueprint JSON for this project. This is a .json file that would be imported into Make.com.\n\n${context}\n\nThe JSON must have "name" (string), "flow" (array of 6-10 module objects each with id/module/version/parameters/mapper/metadata), and "metadata" (object with version and scenario settings). Module format: "app:actionName". Data mapping: {{moduleId.fieldName}}. Output only raw JSON, first character must be {.`
          : ticket.ticket_type === 'zapier'
          ? buildZapierWorkflowUserMessage(context)
          : `Generate the complete n8n workflow definition JSON for this project. This is the content of a .json file you would import into n8n via Settings → Import Workflow.\n\n${context}\n\nThe JSON must have a "name" field (string), a "nodes" array (with 6-10 node objects), and a "connections" object. Node objects have id, name, type, typeVersion, position, and parameters fields. Do not use {{ }} runtime expressions as property values — use literal strings or numbers only.`;

      const retryMsg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 12000,
        system: workflowSystemPrompt,
        messages: [
          {
            role: 'user',
            content: retryUserContent,
          },
        ],
      });
      const retryText = retryMsg.content[0].type === 'text' ? retryMsg.content[0].text : '{}';
      if (retryText.trim().length > workflowJson.trim().length) {
        workflowJson = retryText;
        console.log('[generate-build] Retry returned', retryText.length, 'chars');
      }
    }

    console.log('[generate-build] All 3 Claude calls completed in', Date.now() - overallStart, 'ms');
    console.log('[generate-build] Build plan:', buildPlanHtml.length, 'chars');
    console.log('[generate-build] Demo:', demoHtml.length, 'chars');
    console.log('[generate-build] Workflow JSON:', workflowJson.length, 'chars');
  } catch (claudeErr) {
    console.error('[generate-build] Claude API error:', claudeErr);
    return NextResponse.json(
      { error: 'AI generation failed: ' + (claudeErr as Error).message },
      { status: 502 }
    );
  }

  // ── 8. Ensure HTML files have proper DOCTYPE wrapper ─────────────────────
  if (!buildPlanHtml.trim().toLowerCase().startsWith('<!doctype') && !buildPlanHtml.trim().startsWith('<html')) {
    buildPlanHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Build Plan — ${ticket.project_name || ticket.company_name}</title></head><body>${buildPlanHtml}</body></html>`;
  }
  if (!demoHtml.trim().toLowerCase().startsWith('<!doctype') && !demoHtml.trim().startsWith('<html')) {
    demoHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Solution Demo — ${ticket.project_name || ticket.company_name}</title></head><body>${demoHtml}</body></html>`;
  }

  // Validate and clean workflow JSON
  let cleanWorkflowJson = workflowJson.trim();

  // Strip markdown fences if present
  const fenceMatch = cleanWorkflowJson.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleanWorkflowJson = fenceMatch[1].trim();

  // Extract outermost {...} in case Claude added preamble or explanation text
  const firstBrace = cleanWorkflowJson.indexOf('{');
  const lastBrace = cleanWorkflowJson.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleanWorkflowJson = cleanWorkflowJson.slice(firstBrace, lastBrace + 1);
  }

  let workflowIsValid = false;
  let n8nNodeWarnings: string[] = [];

  try {
    const parsed = JSON.parse(cleanWorkflowJson);
    workflowIsValid = true;
    console.log('[generate-build] Workflow JSON is valid');

    // n8n-specific validation: check all node types are valid n8n-nodes-base types
    if (ticket.ticket_type === 'n8n' && Array.isArray(parsed.nodes)) {
      const knownN8nBases = new Set([
        'n8n-nodes-base.webhook', 'n8n-nodes-base.httpRequest', 'n8n-nodes-base.set',
        'n8n-nodes-base.if', 'n8n-nodes-base.merge', 'n8n-nodes-base.splitInBatches',
        'n8n-nodes-base.slack', 'n8n-nodes-base.gmail', 'n8n-nodes-base.hubspot',
        'n8n-nodes-base.salesforce', 'n8n-nodes-base.airtable', 'n8n-nodes-base.notion',
        'n8n-nodes-base.googleSheets', 'n8n-nodes-base.sendGrid', 'n8n-nodes-base.bambooHr',
        'n8n-nodes-base.zoom', 'n8n-nodes-base.cron', 'n8n-nodes-base.interval',
        'n8n-nodes-base.emailSend', 'n8n-nodes-base.code', 'n8n-nodes-base.function',
        'n8n-nodes-base.functionItem', 'n8n-nodes-base.switch', 'n8n-nodes-base.filter',
        'n8n-nodes-base.removeDuplicates', 'n8n-nodes-base.sort', 'n8n-nodes-base.limit',
        'n8n-nodes-base.aggregate', 'n8n-nodes-base.itemLists', 'n8n-nodes-base.noOp',
        'n8n-nodes-base.stickyNote', 'n8n-nodes-base.start', 'n8n-nodes-base.manualTrigger',
        'n8n-nodes-base.stripe', 'n8n-nodes-base.twilio', 'n8n-nodes-base.telegram',
        'n8n-nodes-base.discord', 'n8n-nodes-base.github', 'n8n-nodes-base.gitlab',
        'n8n-nodes-base.jira', 'n8n-nodes-base.asana', 'n8n-nodes-base.trello',
        '@n8n/n8n-nodes-langchain.lmChatAnthropic', '@n8n/n8n-nodes-langchain.openAi',
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      n8nNodeWarnings = (parsed.nodes as any[])
        .filter((n) => n.type && !knownN8nBases.has(n.type) && !n.type.startsWith('n8n-nodes-base.'))
        .map((n) => `Unknown node type: ${n.type} (node: ${n.name})`);

      if (n8nNodeWarnings.length > 0) {
        console.warn('[generate-build] n8n node type warnings:', n8nNodeWarnings);
      }
    }
  } catch {
    console.warn('[generate-build] Workflow JSON is not valid JSON, wrapping as raw...');
    cleanWorkflowJson = JSON.stringify({
      _warning: 'Raw output from AI — may need manual cleanup',
      _mcp_assisted: mcpNodeContext.length > 0,
      _template_matched: matchedTemplateName ?? null,
      raw: cleanWorkflowJson,
    });
  }

  // ── 9. Upload to Supabase Storage ─────────────────────────────────────────
  const timestamp = Date.now();
  const buildPlanPath = `${ticket_id}/artifacts/build-plan-${timestamp}.html`;
  const demoPath = `${ticket_id}/artifacts/solution-demo-${timestamp}.html`;
  const workflowPath = `${ticket_id}/artifacts/workflow-${timestamp}.json`;

  console.log('[generate-build] Uploading 3 files to Supabase Storage...');
  try {
    await Promise.all([
      uploadToStorage(buildPlanPath, buildPlanHtml, 'text/html; charset=utf-8'),
      uploadToStorage(demoPath, demoHtml, 'text/html; charset=utf-8'),
      uploadToStorage(workflowPath, cleanWorkflowJson, 'application/json'),
    ]);
    console.log('[generate-build] All 3 files uploaded successfully');
  } catch (uploadErr) {
    console.error('[generate-build] Storage upload failed:', uploadErr);
    return NextResponse.json(
      { error: 'File upload failed: ' + (uploadErr as Error).message },
      { status: 500 }
    );
  }

  // ── 10. Create ticket_artifacts rows ──────────────────────────────────────
  const artifactRows = [
    {
      ticket_id,
      artifact_type: 'build_plan',
      file_name: `build-plan-${timestamp}.html`,
      file_path: buildPlanPath,
      version: 1,
      metadata: {
        generated_at: new Date().toISOString(),
        chars: buildPlanHtml.length,
        template_matched: matchedTemplateName ?? null,
      },
    },
    {
      ticket_id,
      artifact_type: 'solution_demo',
      file_name: `solution-demo-${timestamp}.html`,
      file_path: demoPath,
      version: 1,
      metadata: {
        generated_at: new Date().toISOString(),
        chars: demoHtml.length,
      },
    },
    {
      ticket_id,
      artifact_type: 'workflow_json',
      file_name: `workflow-${timestamp}.json`,
      file_path: workflowPath,
      version: 1,
      metadata: {
        generated_at: new Date().toISOString(),
        chars: cleanWorkflowJson.length,
        platform: ticket.ticket_type,
        mcp_assisted: ticket.ticket_type === 'n8n' && mcpNodeContext.length > 0,
        valid_json: workflowIsValid,
        template_matched: matchedTemplateName ?? null,
        n8n_node_warnings: n8nNodeWarnings.length > 0 ? n8nNodeWarnings : undefined,
      },
    },
  ];

  console.log('[generate-build] Inserting artifact records...');
  const { data: artifacts, error: artifactError } = await supabase
    .from('ticket_artifacts')
    .insert(artifactRows)
    .select();

  if (artifactError) {
    console.error('[generate-build] Artifact insert error:', artifactError);
    return NextResponse.json({ error: 'DB insert failed: ' + artifactError.message }, { status: 500 });
  }

  console.log('[generate-build] Artifacts inserted:', artifacts?.length, 'rows');

  // ── 11. Update ticket status to REVIEW_PENDING ───────────────────────────
  const { error: statusErr } = await supabase
    .from('tickets')
    .update({ status: 'REVIEW_PENDING', updated_at: new Date().toISOString() })
    .eq('id', ticket_id);

  if (statusErr) {
    console.error('[generate-build] Status update error:', statusErr);
  } else {
    console.log('[generate-build] Ticket status → REVIEW_PENDING');
  }

  // Send build-complete email (best-effort)
  if (ticket.contact_email) {
    const html = buildCompleteHtml(ticket);
    sendEmail({
      to: ticket.contact_email,
      subject: `[Manage AI] Your deliverables are ready — ${ticket.project_name ?? ticket.company_name}`,
      html,
      ticket_id,
    }).catch((e) => console.error('[generate-build] Email send failed:', e));
  }

  console.log('[generate-build] Done. Total time:', Date.now() - overallStart, 'ms');
  return NextResponse.json({
    artifacts: artifacts ?? [],
    success: true,
    template_matched: matchedTemplateName ?? null,
    mcp_assisted: mcpNodeContext.length > 0,
  });
}
