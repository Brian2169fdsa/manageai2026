import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// Allow up to 5 minutes — parallel Claude calls + optional MCP lookup
export const maxDuration = 300;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** Upload a string as a file to Supabase Storage using Buffer (server-safe) */
async function uploadToStorage(path: string, content: string, contentType: string): Promise<void> {
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
  console.log('[generate-build] Fetching matching templates from library...');
  const { data: matchingTemplates } = await supabase
    .from('templates')
    .select('name, description, category, tags')
    .eq('platform', ticket.ticket_type)
    .limit(8);

  const templateMatchContext = matchingTemplates?.length
    ? `\n\nEXISTING TEMPLATE LIBRARY — Review these templates for the ${ticket.ticket_type} platform. If one closely matches the requirements, use it as a starting point and customize it. If none match well, generate from scratch:\n${matchingTemplates.map((t) => `- "${t.name}" [${t.category}]: ${t.description}`).join('\n')}`
    : '';

  const matchedTemplateName = matchingTemplates?.find((t) => {
    const what = (ticket.what_to_build || '').toLowerCase();
    const name = t.name.toLowerCase();
    const desc = (t.description || '').toLowerCase();
    // Very basic similarity check — Claude will do the real matching
    return what.includes(name.split(' ')[0]) || desc.split(' ').some((w: string) => w.length > 5 && what.includes(w));
  })?.name;

  console.log('[generate-build] Found', matchingTemplates?.length ?? 0, 'platform templates. Best match:', matchedTemplateName ?? 'none');

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
  const workflowSystemPrompt =
    ticket.ticket_type === 'n8n'
      ? `You are an expert n8n automation engineer with access to the complete n8n node library.

Generate a complete, importable n8n workflow JSON for the described automation.

Use valid n8n workflow format:
- "nodes" array: each node needs id (UUID string), name, type (exact n8n node type like "n8n-nodes-base.httpRequest"), typeVersion (integer), position ([x,y] array), parameters (object)
- "connections" object: maps source node name → {main: [[{node: "target", type: "main", index: 0}]]}
- Include a trigger node (Webhook, Schedule, Email Trigger, etc.)
- Include error handling with "n8n-nodes-base.errorTrigger"
- Add realistic parameter values, not just empty objects${templateMatchContext}${mcpNodeContext ? '\n\nUse these node definitions from n8n-MCP database to ensure correct types:\n' + mcpNodeContext : ''}

Return ONLY the raw JSON object, no markdown fences, no explanation.`
      : ticket.ticket_type === 'make'
      ? `You are an expert Make.com (formerly Integromat) automation engineer.

Generate a complete, importable Make.com scenario JSON.
Use valid Make.com format with a "modules" array. Each module: id (integer), module (like "gateway:CustomWebHook"), version, parameters, mapper, metadata.
Include proper connections between modules.${templateMatchContext}

Return ONLY the raw JSON, no markdown fences, no explanation.`
      : `You are an expert Zapier automation engineer.

Generate a structured JSON describing the complete Zap.
Include:
- trigger: {app, event, filters, sample_data}
- actions: array of {app, action, field_mappings, description}
- paths: conditional logic branches if needed
- error_handling: description of failure scenarios${templateMatchContext}

Return ONLY the raw JSON, no markdown fences, no explanation.`;

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
        system: `You are a senior automation engineer writing a comprehensive build manual for a client project.

Generate a COMPLETE, DETAILED build plan as a standalone HTML file that opens directly in a browser.

Required sections:
1. Executive Summary — what this automation does and the business value
2. System Architecture — ASCII diagram of the data flow + description
3. Prerequisites — all accounts, API keys, webhooks, and permissions needed before starting
4. Step-by-Step Build Instructions — numbered, detailed steps for each workflow node/module
5. Node/Module Configuration — exact settings, parameters, and credentials for each component
6. Data Mapping Reference — input fields → output fields table
7. Testing Plan — specific test cases with expected inputs/outputs
8. Deployment Checklist — pre-launch validation steps
9. Monitoring & Alerting — how to know when it breaks
10. Troubleshooting Guide — common failure modes and fixes

HTML design (all styles inline or in <style> tag in <head>):
- Font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
- Primary: #4A8FD6 (blue), text: #1A1A2E, page bg: #F8F9FB
- White cards with border-radius: 12px, box-shadow: 0 2px 12px rgba(0,0,0,0.08)
- h2 sections with left blue border (border-left: 4px solid #4A8FD6)
- Code/config blocks: background #1e1e1e, color #d4d4d4, font-family monospace
- Tables with alternate row shading
- Section numbers in blue circles
- Professional enough to send to the client directly

Output ONLY the complete HTML file starting with <!DOCTYPE html>.`,
        messages: [
          {
            role: 'user',
            content: `Generate the complete build plan for:\n\n${context}`,
          },
        ],
      }),

      // ── Solution Demo HTML ───────────────────────────────────────────────
      anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: `You are creating an interactive HTML demo for a client showing their automation solution.

Generate a SINGLE, complete, self-contained HTML file with vanilla JavaScript only.
Import Google Font DM Sans with @import in the CSS.

Tab navigation with these 6 sections:
1. Overview — headline, what this automation does, key benefits list
2. The Challenge — business problem, pain points, current state vs. future state
3. How It Works — numbered step-by-step visual flow of the automation with connecting arrows, each step has an icon and description
4. Live Demo — interactive simulation: a "Run Demo" button that animates data flowing through the system. Show realistic-looking data (emails, records, messages) transforming at each step. Make it actually click-interactive.
5. ROI — time saved per week/month, cost reduction estimate, efficiency gain — use animated counting number displays that count up when the tab is active
6. Next Steps — implementation timeline (days per phase), what ManageAI delivers, CTA to get started

Design:
- DM Sans font, primary: #4A8FD6, background: #fff, card bg: #F8F9FB
- Active tab: blue bottom border + blue text, inactive: gray
- Smooth fadeIn transition between tabs (CSS only, no jQuery)
- Step arrows in How It Works: use → emoji or CSS borders
- Mobile responsive (max-width 900px centered)
- Very polished, client-ready presentation

Output ONLY the complete HTML file starting with <!DOCTYPE html>.`,
        messages: [
          {
            role: 'user',
            content: `Generate the interactive solution demo for:\n\n${context}`,
          },
        ],
      }),

      // ── Workflow JSON ────────────────────────────────────────────────────
      anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: workflowSystemPrompt,
        messages: [
          {
            role: 'user',
            content: `Generate the complete ${ticket.ticket_type} workflow JSON for:\n\n${context}`,
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
  const fenceMatch = cleanWorkflowJson.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleanWorkflowJson = fenceMatch[1].trim();

  let workflowIsValid = false;
  try {
    JSON.parse(cleanWorkflowJson);
    workflowIsValid = true;
    console.log('[generate-build] Workflow JSON is valid');
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
        mcp_assisted: ticket.ticket_type === 'n8n' && mcpNodeContext.length > 0,
        valid_json: workflowIsValid,
        template_matched: matchedTemplateName ?? null,
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

  console.log('[generate-build] Done. Total time:', Date.now() - overallStart, 'ms');
  return NextResponse.json({
    artifacts: artifacts ?? [],
    success: true,
    template_matched: matchedTemplateName ?? null,
    mcp_assisted: mcpNodeContext.length > 0,
  });
}
