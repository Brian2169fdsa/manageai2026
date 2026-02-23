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
async function uploadToStorage(
  path: string,
  content: string,
  contentType: string
): Promise<void> {
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
//
// Uses https://github.com/czlonkowski/n8n-mcp — a local MCP server with
// 1,084 n8n node definitions. Spawned as a subprocess via stdio transport.
// Falls back to Claude-only generation if the server is unavailable.

async function getN8nNodeContext(description: string): Promise<string> {
  const CONNECT_TIMEOUT_MS = 15000;
  const TOOL_TIMEOUT_MS = 20000;

  try {
    console.log('[n8n-mcp] Attempting to connect to n8n-MCP server...');

    // Dynamic require — avoids static import failures if package structure changes
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

    // Connect with timeout
    await Promise.race([
      client.connect(transport),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('n8n-MCP connect timeout after 15s')), CONNECT_TIMEOUT_MS)
      ),
    ]);
    console.log('[n8n-mcp] Connected successfully');

    // Discover available tools
    const toolsResult = await client.listTools();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolNames: string[] = toolsResult.tools.map((t: any) => t.name);
    console.log('[n8n-mcp] Available tools:', toolNames);

    let nodeContext = '';

    // ── Search for relevant nodes ───────────────────────────────────────────
    const searchToolName = toolNames.find(
      (n) => n === 'search_nodes' || n === 'get_node_for_task' || n.includes('search')
    );

    if (searchToolName) {
      const query = description.slice(0, 500);
      console.log(`[n8n-mcp] Calling ${searchToolName}...`);

      const searchResult = await Promise.race([
        client.callTool({
          name: searchToolName,
          arguments: { query, limit: 12 },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('n8n-MCP search timeout')), TOOL_TIMEOUT_MS)
        ),
      ]);

      const resultStr = JSON.stringify(searchResult.content, null, 2);
      nodeContext += `\n\n=== RELEVANT N8N NODES (sourced from n8n-MCP — 1,084 node database) ===\n${resultStr.slice(0, 8000)}`;
      console.log('[n8n-mcp] Got', resultStr.length, 'chars of node context');
    }

    // ── Optionally get DB stats for additional grounding ───────────────────
    const statsTool = toolNames.find(
      (n) => n === 'get_database_statistics' || n === 'list_nodes'
    );
    if (statsTool && nodeContext.length < 3000) {
      try {
        const statsResult = await Promise.race([
          client.callTool({ name: statsTool, arguments: {} }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('stats timeout')), 10000)
          ),
        ]);
        nodeContext += `\n\n=== N8N NODE REGISTRY STATS ===\n${JSON.stringify(statsResult.content).slice(0, 1500)}`;
      } catch (statsErr) {
        console.log('[n8n-mcp] Stats call skipped:', (statsErr as Error).message);
      }
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
    return NextResponse.json(
      { error: 'Ticket not found: ' + ticketError?.message },
      { status: 404 }
    );
  }

  console.log('[generate-build] Ticket:', {
    company: ticket.company_name,
    project: ticket.project_name,
    platform: ticket.ticket_type,
    status: ticket.status,
    has_understanding: !!ticket.ai_understanding,
  });

  // Build rich context from all ticket fields
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
    answeredQuestions ? `\n=== CLARIFICATIONS ===\n${answeredQuestions}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  console.log('[generate-build] Context length:', context.length, 'chars');

  // ── 2. n8n-MCP: Look up accurate node configs (n8n only) ─────────────────
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

  // ── 3. Run all 3 AI generations in parallel ──────────────────────────────
  let buildPlanHtml: string;
  let demoHtml: string;
  let workflowJson: string;

  // The workflow JSON prompt is enhanced with MCP node data for n8n tickets
  const workflowSystemPrompt = ticket.ticket_type === 'n8n'
    ? `You are an expert n8n automation engineer with access to the complete n8n node library.

Generate a complete, importable n8n workflow JSON for the described automation.

Use valid n8n workflow format:
- "nodes" array: each node needs id (UUID), name, type (exact n8n node type like "n8n-nodes-base.httpRequest"), typeVersion, position [x,y], parameters
- "connections" object: maps source node outputs to destination node inputs
- Include a trigger node (Webhook, Schedule, Email Trigger, etc.)
- Include processing nodes matching the requirements
- Include output/action nodes
- Add an "n8n-nodes-base.errorTrigger" node for error handling
- Use real, importable n8n node types from the node database below${mcpNodeContext ? '\n\nUse the following node definitions from the n8n-MCP node database to ensure correct node types and parameters:' + mcpNodeContext : ''}

Return ONLY the raw JSON object, no markdown fences, no explanation, no comments.`
    : ticket.ticket_type === 'make'
    ? `You are an expert Make.com (Integromat) automation engineer.

Generate a complete, importable Make.com scenario JSON for the described automation.
Use valid Make.com scenario format with a "modules" array. Each module needs: id, module (like "gateway:CustomWebHook"), version, parameters, mapper, metadata.

Return ONLY the raw JSON, no markdown fences, no explanation, no comments.`
    : `You are an expert Zapier automation engineer.

Generate a structured JSON describing the complete Zap for this automation.
Include: trigger (app, event, filters), actions array (each with app, action, field_mappings), and a paths array if conditional logic is needed.

Return ONLY the raw JSON, no markdown fences, no explanation, no comments.`;

  try {
    const [buildPlanMsg, demoMsg, workflowMsg] = await Promise.all([
      // ── Build Plan HTML ──
      anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: `You are a senior automation engineer writing a comprehensive build manual for a client.

Generate a COMPLETE, DETAILED build plan as a standalone HTML file. The output must be valid HTML that opens correctly in a browser.

Requirements:
- Include a proper <!DOCTYPE html> declaration and full HTML structure
- Executive Summary section
- System Architecture with data flow description
- Step-by-step workflow configuration instructions
- Required accounts, API connections, and credentials needed
- Node/module-by-module setup instructions for ${ticket.ticket_type}
- Testing plan with specific test cases
- Deployment and monitoring guide
- Troubleshooting section

Design requirements (all styles must be inline or in a <style> tag in <head>):
- Font: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
- Primary color: #4A8FD6 (blue)
- Text: #1A1A2E
- Background: #F8F9FB for page, white for content cards
- Sections in white cards with subtle box-shadow
- Code blocks in dark background (#1e1e1e) with monospace font
- Professional enough to send directly to the client

Output ONLY the complete HTML file, no explanation.`,
        messages: [
          {
            role: 'user',
            content: `Generate the complete build plan HTML for this project:\n\n${context}`,
          },
        ],
      }),

      // ── Solution Demo HTML ──
      anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: `You are creating an interactive HTML demo presentation for a client automation solution.

Generate a SINGLE, complete, self-contained HTML file with vanilla JavaScript only (no external dependencies except Google Fonts via @import in CSS).

The page must have tab navigation with these sections:
1. Overview — What the solution does
2. The Challenge — Business problem being solved
3. How It Works — Visual step-by-step flow of the automation (show numbered steps with arrows)
4. Live Demo — Simulated interactive demo showing real-looking data flowing through the system. Make it interactive — clicking a "Run Demo" button should animate data flowing through
5. ROI — Time saved, cost reduction, efficiency gains with animated number counters
6. Next Steps — Implementation timeline

Design requirements (all CSS inline or in <style> tag):
- Google Font: DM Sans (import from fonts.googleapis.com)
- Primary: #4A8FD6, background: #ffffff, cards: #F8F9FB
- Active tab: blue underline, inactive: gray
- Smooth CSS transitions on tab switches
- Professional, polished look
- Mobile responsive

Output ONLY the complete HTML file, no explanation.`,
        messages: [
          {
            role: 'user',
            content: `Generate the interactive solution demo HTML for this project:\n\n${context}`,
          },
        ],
      }),

      // ── Workflow JSON ──
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

    workflowJson =
      workflowMsg.content[0].type === 'text' ? workflowMsg.content[0].text : '{}';

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

  // ── 4. Ensure HTML files have a proper wrapper if Claude omitted it ──────
  if (!buildPlanHtml.trim().startsWith('<!DOCTYPE') && !buildPlanHtml.trim().startsWith('<html')) {
    buildPlanHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Build Plan — ${ticket.project_name || ticket.company_name}</title></head><body>${buildPlanHtml}</body></html>`;
  }
  if (!demoHtml.trim().startsWith('<!DOCTYPE') && !demoHtml.trim().startsWith('<html')) {
    demoHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Solution Demo — ${ticket.project_name || ticket.company_name}</title></head><body>${demoHtml}</body></html>`;
  }

  // Validate workflow JSON is parseable; if not, wrap it
  let cleanWorkflowJson = workflowJson.trim();
  const fenceMatch = cleanWorkflowJson.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleanWorkflowJson = fenceMatch[1].trim();
  try {
    JSON.parse(cleanWorkflowJson);
    console.log('[generate-build] Workflow JSON is valid');
  } catch {
    console.warn('[generate-build] Workflow JSON is not valid JSON, wrapping...');
    cleanWorkflowJson = JSON.stringify({
      warning: 'Raw output from AI — may need manual cleanup',
      mcp_used: mcpNodeContext.length > 0,
      raw: cleanWorkflowJson,
    });
  }

  // ── 5. Upload to Supabase Storage ────────────────────────────────────────
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

  // ── 6. Create ticket_artifacts rows ─────────────────────────────────────
  const artifactRows = [
    {
      ticket_id,
      artifact_type: 'build_plan',
      file_name: `build-plan-${timestamp}.html`,
      file_path: buildPlanPath,
      version: 1,
      metadata: { generated_at: new Date().toISOString(), chars: buildPlanHtml.length },
    },
    {
      ticket_id,
      artifact_type: 'solution_demo',
      file_name: `solution-demo-${timestamp}.html`,
      file_path: demoPath,
      version: 1,
      metadata: { generated_at: new Date().toISOString(), chars: demoHtml.length },
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
      },
    },
  ];

  console.log('[generate-build] Inserting artifact records into ticket_artifacts...');
  const { data: artifacts, error: artifactError } = await supabase
    .from('ticket_artifacts')
    .insert(artifactRows)
    .select();

  if (artifactError) {
    console.error('[generate-build] Artifact insert error:', artifactError);
    return NextResponse.json(
      { error: 'DB insert failed: ' + artifactError.message },
      { status: 500 }
    );
  }

  console.log('[generate-build] Artifacts inserted:', artifacts?.length, 'rows');
  artifacts?.forEach((a) => console.log('  -', a.artifact_type, ':', a.id));

  // ── 7. Update ticket status ──────────────────────────────────────────────
  const { error: statusErr } = await supabase
    .from('tickets')
    .update({ status: 'REVIEW_PENDING', updated_at: new Date().toISOString() })
    .eq('id', ticket_id);

  if (statusErr) {
    console.error('[generate-build] Status update error:', statusErr);
  } else {
    console.log('[generate-build] Ticket status updated to REVIEW_PENDING');
  }

  console.log('[generate-build] Done. Total time:', Date.now() - overallStart, 'ms');
  return NextResponse.json({ artifacts: artifacts ?? [], success: true });
}
