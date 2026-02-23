import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function uploadToStorage(path: string, content: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const { error } = await supabase.storage
    .from('ticket-files')
    .upload(path, blob, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

export async function POST(req: NextRequest) {
  try {
    const { ticket_id } = await req.json();

    if (!ticket_id) {
      return NextResponse.json({ error: 'ticket_id is required' }, { status: 400 });
    }

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticket_id)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const context = `
Company: ${ticket.company_name}
Project: ${ticket.project_name || 'N/A'}
Platform: ${ticket.ticket_type}
What to Build: ${ticket.what_to_build}
Expected Outcome: ${ticket.expected_outcome}
AI Understanding: ${ticket.ai_understanding}
Complexity: ${ticket.complexity_estimate}
    `.trim();

    // ---- 1. Build Plan (HTML) ----
    const buildPlanMsg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8096,
      system: `You are a senior automation engineer writing a comprehensive build manual.
Generate a COMPLETE, DETAILED build plan that anyone could follow to build this system end-to-end. Include:
- Executive Summary
- System Architecture (describe the data flow)
- Every scenario/workflow with step-by-step instructions
- Required accounts, connections, and credentials
- Module-by-module configuration
- Testing plan with test cases
- Deployment and monitoring instructions
- Troubleshooting guide

Output as clean HTML with inline styles. Use a professional design:
- Font: system sans-serif
- Color scheme: blue (#4A8FD6) accent, dark text (#1A1A2E), light backgrounds (#F8F9FB)
- Sections with clear headers
- Code blocks for any JSON/config
- Tables for structured data
Make it look polished enough to send directly to a client.`,
      messages: [{ role: 'user', content: `Generate the build plan for this project:\n\n${context}` }],
    });

    const buildPlanHtml = buildPlanMsg.content[0].type === 'text' ? buildPlanMsg.content[0].text : '<p>Error generating build plan</p>';

    // ---- 2. Solution Demo (interactive HTML) ----
    const demoPlanMsg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8096,
      system: `Generate an interactive HTML solution demo as a SINGLE FILE.
Use vanilla JavaScript only (no React CDN needed for this version).
Include:
- Tab navigation: Overview | The Challenge | How It Works | Live Demo | ROI | Next Steps
- Overview: what the solution does
- The Challenge: the business problem
- How It Works: visual flow of the automation with animated steps
- Live Demo: simulated data showing inputs → processing → outputs
- ROI: time saved, cost reduction, efficiency gains with animated counters
- Next Steps: implementation timeline

Design: system sans-serif font, #4A8FD6 blue accent, clean white backgrounds,
subtle animations, professional and polished.
All CSS must be inline or in a <style> tag. Single HTML file, no external dependencies.`,
      messages: [{ role: 'user', content: `Generate the solution demo for this project:\n\n${context}` }],
    });

    const demoHtml = demoPlanMsg.content[0].type === 'text' ? demoPlanMsg.content[0].text : '<p>Error generating demo</p>';

    // ---- 3. Workflow JSON ----
    const workflowMsg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: `You are an n8n workflow expert. Generate a complete, importable n8n workflow JSON for the described automation.
The JSON must:
- Be valid n8n workflow format with nodes array and connections object
- Include all required node types (webhooks, HTTP requests, data transforms, etc.)
- Have realistic node configurations
- Include error handling nodes
- Be directly importable into n8n

Return ONLY the JSON, no markdown, no explanation.`,
      messages: [{ role: 'user', content: `Generate the n8n workflow JSON for:\n\n${context}` }],
    });

    const workflowJson = workflowMsg.content[0].type === 'text' ? workflowMsg.content[0].text : '{}';

    // Upload all three to storage
    const timestamp = Date.now();
    const buildPlanPath = `${ticket_id}/artifacts/build-plan-${timestamp}.html`;
    const demoPath = `${ticket_id}/artifacts/solution-demo-${timestamp}.html`;
    const workflowPath = `${ticket_id}/artifacts/workflow-${timestamp}.json`;

    await Promise.all([
      uploadToStorage(buildPlanPath, buildPlanHtml, 'text/html'),
      uploadToStorage(demoPath, demoHtml, 'text/html'),
      uploadToStorage(workflowPath, workflowJson, 'application/json'),
    ]);

    // Create artifact records
    const artifactData = [
      { ticket_id, artifact_type: 'build_plan', file_name: `build-plan-${timestamp}.html`, file_path: buildPlanPath },
      { ticket_id, artifact_type: 'solution_demo', file_name: `solution-demo-${timestamp}.html`, file_path: demoPath },
      { ticket_id, artifact_type: 'workflow_json', file_name: `workflow-${timestamp}.json`, file_path: workflowPath },
    ];

    const { data: artifacts, error: artifactError } = await supabase
      .from('ticket_artifacts')
      .insert(artifactData)
      .select();

    if (artifactError) {
      console.error('Artifact insert error:', artifactError);
    }

    // Update ticket status
    await supabase
      .from('tickets')
      .update({ status: 'REVIEW_PENDING', updated_at: new Date().toISOString() })
      .eq('id', ticket_id);

    return NextResponse.json({ artifacts: artifacts ?? [], success: true });
  } catch (error) {
    console.error('generate-build error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
