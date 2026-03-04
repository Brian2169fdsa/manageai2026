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
import { assembleBuildPlan, assembleSolutionDemo } from '@/lib/templates/assemble';
import type { BuildPlanData, SolutionDemoData } from '@/lib/templates/data-schemas';

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
  let buildPlanHtml: string = '';
  let demoHtml: string = '';
  let buildPlanRaw: string = '{}';
  let demoRaw: string = '{}';
  let workflowJson: string;

  try {
    const [buildPlanMsg, demoMsg, workflowMsg] = await Promise.all([
      // ── Build Plan Data JSON ────────────────────────────────────────────
      anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: `You are a senior automation engineer at ManageAI. Generate a structured JSON data object for a client build manual (Skillset Manual format).

Output ONLY a valid JSON object. First character must be {. Last character must be }. No markdown fences, no explanation text.

The JSON must match this exact schema:
{
  "clientName": "string — client company name",
  "solutionName": "string — project/solution name",
  "version": "string — e.g. '1.0'",
  "stack": "string — e.g. 'Claude + Make.com' or 'GPT-4 + n8n'",
  "confidentialLine": "string — e.g. 'Prepared for [Client Name]'",
  "calloutTitle": "string — title for the key callout box on the overview tab",
  "calloutBody": "string — 2-3 sentence explanation of the most important architectural decision",
  "scopeIn": ["string array — 4-6 items that ARE in scope for this build"],
  "scopeOut": ["string array — 3-5 items explicitly OUT of scope"],
  "accounts": [{"name":"string","setup":"string — 1-2 sentence setup instructions","connection":"string — how it connects in the platform","icon":"emoji","color":"one of: C.purple, C.accent, C.teal, C.success, C.orange, C.warning, C.danger"}],
  "spFolders": [{"content":"string — folder purpose","find":"string — where to find it","variable":"string — variable name","color":"one of: C.accent, C.purple, C.success, C.warning"}],
  "trainingRows": [{"num":1,"name":"string — training/workflow name","type":"Workflow|Instructions|Knowledge","tools":"string — tools used","trigger":"string — what triggers it","inputs":"string — what goes in","outputs":"string — what comes out","typeColor":"one of: C.accent, C.teal, C.purple"}],
  "scenarios": [{"id":"string — e.g. 'SC-01'","name":"string","trigger":"string","purpose":"string — 1-2 sentences","icon":"emoji","modules":6,"type":"auto|hitl","claude":true,"details":"string — 3-5 sentence detailed description","frMap":["FR references"],"moduleList":["string — each module in sequence"],"template":null}],
  "systemPromptRules": [{"num":1,"title":"RULE TITLE","desc":"string — 2-3 sentence rule description","color":"one of: C.danger, C.warning, C.accent, C.success, C.purple, C.teal, C.textMid"}],
  "jsonSchemas": [{"name":"string — schema name","fields":15,"used":"string — which scenario uses it","desc":"string — what it contains","arrays":["array field names"]}],
  "makeVars": [{"name":"string — VARIABLE_NAME","purpose":"string","example":"string"}],
  "conditionalLogic": [{"scenario":"string — scenario ID","condition":"string — if condition","action":"string — then action","elseAction":"string — else action","color":"one of: C.warning, C.orange, C.accent, C.purple, C.success, C.teal, C.danger"}],
  "errorHandling": [{"trigger":"string — what goes wrong","response":"string — how to handle it","severity":"warning|danger"}],
  "guardrails": ["string array — 4-6 non-negotiable safety rules"],
  "operationalBP": [{"category":"string","icon":"emoji","color":"C.accent|C.purple|C.danger|C.warning","items":[{"label":"string — best practice title","detail":"string — 2-3 sentence explanation","type":"do|dont"}]}],
  "buildBP": [{"category":"string","icon":"emoji","color":"C.purple|C.accent|C.teal|C.orange","items":[{"label":"string — best practice title","detail":"string — 2-3 sentence explanation","type":"do|dont"}]}]
}

REQUIREMENTS:
- ALL content must be specific to this client's project. No generic filler.
- Include 3-6 accounts, 3-5 spFolders, 3-5 trainingRows, 2-4 scenarios with 5-10 moduleList items each
- Include 4-8 systemPromptRules, 1-3 jsonSchemas, 4-8 makeVars, 4-7 conditionalLogic items
- Include 3-6 errorHandling items, 4-6 guardrails
- Include 2-4 operationalBP categories with 3-4 items each, 2-4 buildBP categories with 3-5 items each
- Color values must be exactly as shown (C.accent, C.purple, etc.) — they reference the template's color constants
- The platform is ${ticket.ticket_type.toUpperCase()}`,
        messages: [
          {
            role: 'user',
            content: `Generate the build plan data JSON for:\n\n${context}${ticket.ticket_type === 'zapier' ? getZapierBuildPlanAddendum() : ticket.ticket_type === 'make' ? getMakeBuildPlanAddendum() : ''}`,
          },
        ],
      }),

      // ── Solution Demo Data JSON ─────────────────────────────────────────
      anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: `You are creating structured data for a client solution demo at ManageAI. Generate a JSON data object that will populate an interactive demo template.

Output ONLY a valid JSON object. First character must be {. Last character must be }. No markdown fences, no explanation text.

The JSON must match this exact schema:
{
  "clientName": "string — client company name",
  "solutionName": "string — project/solution name",
  "version": "string — e.g. '1.0'",
  "stack": "string — e.g. 'Retell AI + Make.com + GPT-4.1'",
  "confidentialLine": "string — e.g. 'Prepared for [Client Name]'",
  "overviewTitle": "string — solution title for overview tab",
  "overviewDesc": "string — 2-3 sentence description of what the solution does",
  "calloutTitle": "string — title for the key feature callout box",
  "calloutBody": "string — 2-3 sentence explanation of the most impressive capability",
  "statsScenarios": "string — number of scenarios/workflows, e.g. '6'",
  "statsTools": "string — number of tools/integrations, e.g. '4'",
  "statsGptStages": "string — number of AI processing stages, e.g. '2'",
  "retellAgentId": "string — placeholder agent ID or 'N/A'",
  "retellFromNumber": "string — placeholder phone number or 'N/A'",
  "retellVoiceEngine": "string — voice engine or 'N/A'",
  "retellDashUrl": "string — dashboard URL or 'N/A'",
  "sheetId": "string — placeholder Google Sheet ID or 'N/A'",
  "sheetRange": "string — data range or 'N/A'",
  "manifestTitle": "string — title for the data manifest/dashboard",
  "manifestDate": "string — demo date, e.g. 'March 4, 2026'",
  "tripData": [
    {
      "date": "string — date like '03/04/2026'",
      "time": "string — time like '08:30 AM'",
      "patient": "string — person/record name (use realistic names for the industry)",
      "patPhone": "string — phone number",
      "patEmail": "string — email",
      "facility": "string — facility/company name",
      "facPhone": "string — facility phone",
      "pickup": "string — pickup address or source",
      "dest": "string — destination",
      "type": "string — record type/category",
      "caStatus": "string — one of: confirmed, rescheduled, cancelled, voicemail, retry, pending",
      "notes": "string — important notes",
      "callResult": "string — result text or empty",
      "callNotes": "string — detailed notes or empty",
      "callTs": "string — timestamp or empty"
    }
  ],
  "transcriptLines": [
    {"speaker": "agent|facility|customer|system", "text": "string — realistic conversation line", "delay": 600}
  ],
  "scenarios": [
    {
      "id": "string — e.g. 'SC-01'",
      "name": "string — scenario name",
      "color": "string — one of: C.accent, C.purple, C.teal, C.danger, C.warning, C.textDim",
      "trust": "string — trust score like '8/10'",
      "build": "string — build complexity like '2/5'",
      "trigger": "string — what triggers this scenario",
      "scId": "string — scenario/workflow ID placeholder",
      "desc": "string — 2-3 sentence description",
      "modules": ["string — each module/step in sequence, e.g. 'Schedule → Run scenario (every 15 min)'"]
    }
  ],
  "techStack": [
    {"icon": "emoji", "name": "string — tool name", "role": "string — what it does", "color": "string — C.purple|C.accent|C.teal|C.success|C.orange"}
  ]
}

REQUIREMENTS:
- ALL mock data, scenarios, and transcript lines must be realistic for THIS specific project
- Generate 8-14 tripData records with realistic names, addresses, and details for the client's industry
- Generate 8-10 transcriptLines showing a realistic conversation relevant to the use case
- Generate 3-6 scenarios with 4-7 modules each
- Generate 4-6 techStack entries
- For non-voice projects: still use the tripData structure but adapt field names contextually (patient→record, facility→destination, etc.)
- Color values must be exactly as shown (C.accent, C.purple, etc.)
- The platform is ${ticket.ticket_type.toUpperCase()}`,
        messages: [
          {
            role: 'user',
            content: `Generate the solution demo data JSON for:\n\n${context}${ticket.ticket_type === 'zapier' ? getZapierDemoAddendum() : ticket.ticket_type === 'make' ? getMakeDemoAddendum() : ''}`,
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

    buildPlanRaw =
      buildPlanMsg.content[0].type === 'text'
        ? buildPlanMsg.content[0].text
        : '{}';

    demoRaw =
      demoMsg.content[0].type === 'text'
        ? demoMsg.content[0].text
        : '{}';

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

  // ── 8. Parse AI data JSON and assemble HTML from templates ───────────────
  let buildPlanData: BuildPlanData | null = null;
  let demoData: SolutionDemoData | null = null;

  // Helper to clean raw JSON from Claude (strip fences, extract braces)
  function cleanJson(raw: string): string {
    let cleaned = raw.trim();
    const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) cleaned = fence[1].trim();
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);
    return cleaned;
  }

  // Parse build plan data
  try {
    buildPlanData = JSON.parse(cleanJson(buildPlanRaw)) as BuildPlanData;
    console.log('[generate-build] Build plan data parsed successfully');
  } catch (parseErr) {
    console.warn('[generate-build] Build plan JSON parse failed, using fallback:', (parseErr as Error).message);
    // Create minimal fallback data
    buildPlanData = {
      clientName: ticket.company_name || 'Client',
      solutionName: ticket.project_name || 'Automation Project',
      version: '1.0',
      stack: ticket.ticket_type === 'make' ? 'Make.com' : ticket.ticket_type === 'zapier' ? 'Zapier' : 'n8n',
      confidentialLine: `Prepared for ${ticket.company_name || 'Client'}`,
      calloutTitle: 'Build Overview',
      calloutBody: ticket.ai_understanding || ticket.what_to_build || 'Automation build specification.',
      scopeIn: ['Process automation as described in the ticket'],
      scopeOut: ['Items not specified in the original request'],
      accounts: [],
      spFolders: [],
      trainingRows: [],
      scenarios: [],
      systemPromptRules: [],
      jsonSchemas: [],
      makeVars: [],
      conditionalLogic: [],
      errorHandling: [],
      guardrails: [],
      operationalBP: [],
      buildBP: [],
    };
  }

  // Parse solution demo data
  try {
    demoData = JSON.parse(cleanJson(demoRaw)) as SolutionDemoData;
    console.log('[generate-build] Solution demo data parsed successfully');
  } catch (parseErr) {
    console.warn('[generate-build] Solution demo JSON parse failed, using fallback:', (parseErr as Error).message);
    demoData = {
      clientName: ticket.company_name || 'Client',
      solutionName: ticket.project_name || 'Automation Project',
      version: '1.0',
      stack: ticket.ticket_type === 'make' ? 'Make.com' : ticket.ticket_type === 'zapier' ? 'Zapier' : 'n8n',
      confidentialLine: `Prepared for ${ticket.company_name || 'Client'}`,
      overviewTitle: ticket.project_name || 'Automation Solution',
      overviewDesc: ticket.ai_understanding || ticket.what_to_build || 'Automation solution demo.',
      calloutTitle: 'Key Capability',
      calloutBody: 'This solution automates key processes for improved efficiency.',
      statsScenarios: '3',
      statsTools: '3',
      statsGptStages: '1',
      retellAgentId: 'N/A',
      retellFromNumber: 'N/A',
      retellVoiceEngine: 'N/A',
      retellDashUrl: 'N/A',
      sheetId: 'N/A',
      sheetRange: 'N/A',
      manifestTitle: 'Dashboard',
      manifestDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      tripData: [],
      transcriptLines: [],
      scenarios: [],
      techStack: [],
    };
  }

  // Assemble final HTML from templates + data
  buildPlanHtml = assembleBuildPlan(buildPlanData);
  demoHtml = assembleSolutionDemo(demoData);

  console.log('[generate-build] Assembled build plan HTML:', buildPlanHtml.length, 'chars');
  console.log('[generate-build] Assembled solution demo HTML:', demoHtml.length, 'chars');

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
  const buildPlanDataPath = `${ticket_id}/artifacts/build-plan-data-${timestamp}.json`;
  const demoDataPath = `${ticket_id}/artifacts/solution-demo-data-${timestamp}.json`;

  console.log('[generate-build] Uploading 5 files to Supabase Storage...');
  try {
    await Promise.all([
      uploadToStorage(buildPlanPath, buildPlanHtml, 'text/html; charset=utf-8'),
      uploadToStorage(demoPath, demoHtml, 'text/html; charset=utf-8'),
      uploadToStorage(workflowPath, cleanWorkflowJson, 'application/json'),
      uploadToStorage(buildPlanDataPath, JSON.stringify(buildPlanData, null, 2), 'application/json'),
      uploadToStorage(demoDataPath, JSON.stringify(demoData, null, 2), 'application/json'),
    ]);
    console.log('[generate-build] All 5 files uploaded successfully');
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
        template_based: true,
      },
    },
    {
      ticket_id,
      artifact_type: 'build_plan_data',
      file_name: `build-plan-data-${timestamp}.json`,
      file_path: buildPlanDataPath,
      version: 1,
      metadata: {
        generated_at: new Date().toISOString(),
        chars: JSON.stringify(buildPlanData).length,
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
        template_based: true,
      },
    },
    {
      ticket_id,
      artifact_type: 'solution_demo_data',
      file_name: `solution-demo-data-${timestamp}.json`,
      file_path: demoDataPath,
      version: 1,
      metadata: {
        generated_at: new Date().toISOString(),
        chars: JSON.stringify(demoData).length,
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

  // ── 12. Fire webhook if configured (best-effort, non-blocking) ───────────
  try {
    const { data: orgData } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', ticket.org_id)
      .single();

    const webhookUrl = orgData?.settings?.webhook_url;
    if (webhookUrl) {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'build.complete',
          ticket_id,
          company_name: ticket.company_name,
          project_name: ticket.project_name,
          platform: ticket.ticket_type,
          artifacts_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/artifacts/${ticket_id}`,
        }),
      }).catch((err) => console.error('[webhook] Failed:', err));
      console.log('[generate-build] Webhook fired to:', webhookUrl);
    }
  } catch {
    // Non-critical — don't fail the build
  }

  console.log('[generate-build] Done. Total time:', Date.now() - overallStart, 'ms');
  return NextResponse.json({
    artifacts: artifacts ?? [],
    success: true,
    template_matched: matchedTemplateName ?? null,
    mcp_assisted: mcpNodeContext.length > 0,
  });
}
