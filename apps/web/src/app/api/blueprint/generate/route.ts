import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// Blueprint generation can take up to 5 minutes
export const maxDuration = 300;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const BLUEPRINT_SYSTEM_PROMPT = `You are ManageAI's senior AI strategy architect.
Given the opportunity assessment data below, generate a comprehensive AI Blueprint document.
This is the deliverable that follows a signed engagement — it's the full implementation plan.

The Blueprint must include:

1. EXECUTIVE SUMMARY
   - Project scope and strategic objectives
   - Key outcomes ManageAI will deliver
   - Engagement overview (phases, timeline, team)

2. TECHNOLOGY ARCHITECTURE
   - System integration map: which tools connect to what
   - Data flow diagram (described in text/ASCII)
   - Platform selection rationale (why n8n vs Make.com vs Zapier for each automation)
   - Security & access considerations

3. 90-DAY IMPLEMENTATION ROADMAP
   Week-by-week breakdown across 3 phases:
   Phase 1 — Foundation (Weeks 1-4): Discovery deep-dive, system access, quick wins
   Phase 2 — Core Build (Weeks 5-8): Primary automations live, AI teammates deployed
   Phase 3 — Optimize & Scale (Weeks 9-12): Refinement, training, expansion planning
   Include: who owns each workstream, dependencies, success criteria per phase

4. AUTOMATION SPECIFICATIONS
   For each automation (derive from the opportunity assessment):
   - Automation name
   - Trigger: what kicks it off
   - Process: step-by-step what happens
   - Integrations required: list the specific APIs/tools
   - Platform: n8n / Make.com / Zapier
   - Estimated build time
   - Test criteria: how we know it works

5. AI TEAMMATE DEPLOYMENT PLAN
   For each recommended AI teammate:
   - Deployment scope: exactly what they handle
   - Tools they need access to
   - Training data / knowledge base requirements
   - Handoff protocol: when they escalate to humans
   - Week they go live

6. SUCCESS METRICS & KPIs
   - Baseline metrics to capture before implementation
   - Target metrics at 30 / 60 / 90 days
   - How metrics are tracked (which dashboard/tool)
   - Monthly review cadence

7. INVESTMENT SUMMARY
   - Phase 1 deliverables and cost
   - Phase 2 deliverables and cost
   - Phase 3 deliverables and cost
   - Ongoing management retainer
   - Expected ROI timeline
   - Total 12-month value delivered

You MUST respond with a valid JSON object (no markdown fences, no explanation) with exactly one field:

"html": A complete, standalone HTML document with:
  - @import for DM Sans from Google Fonts
  - Inline <style> tag only (no external CSS)
  - Colors: #4A8FD6 (ManageAI blue), #1A1A2E (dark), #F8F9FB (light bg), #27AE60 (green)
  - Cover page: "AI BLUEPRINT" title, ManageAI logo text, company name, date, "Confidential"
  - All 7 sections, formatted with clear headers, tables, bullet points
  - Each phase in the roadmap as a visual timeline or table
  - Each automation spec as a card/table
  - Professional enough to present to a C-level audience
  - Print-friendly with good page breaks
  - Footer: ManageAI branding + "Confidential — Prepared for [Company Name]"

Return ONLY the JSON object. Nothing before it, nothing after it.`;

function extractJson(raw: string): Record<string, unknown> {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : raw.trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return {};
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();

  try {
    const body = await req.json();
    const { assessment_id } = body as { assessment_id: string };

    if (!assessment_id) {
      return NextResponse.json({ error: 'assessment_id is required' }, { status: 400 });
    }

    // ── 1. Fetch the opportunity assessment ──────────────────────────────────
    const { data: assessment, error: fetchError } = await supabase
      .from('opportunity_assessments')
      .select('*')
      .eq('id', assessment_id)
      .single();

    if (fetchError || !assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // ── 2. Build context from assessment data ────────────────────────────────
    const formData = assessment.form_data ?? {};
    const metrics = assessment.assessment?.metrics ?? {};

    const contextParts: string[] = [
      `=== COMPANY PROFILE ===`,
      `Company: ${assessment.company_name}`,
      `Contact: ${assessment.contact_name}`,
      `Industry: ${formData.industry ?? 'Not specified'}`,
      `Company Size: ${formData.company_size ?? 'Not specified'}`,
      `Annual Revenue: ${formData.annual_revenue ?? 'Not specified'}`,
      `Primary Goal: ${formData.primary_goal ?? 'Not specified'}`,
      formData.website ? `Website: ${formData.website}` : '',
      ``,
      `=== PAIN POINTS ===`,
      formData.pain_points?.length
        ? (formData.pain_points as string[]).map((p: string) => `- ${p}`).join('\n')
        : 'Not specified',
      ``,
      `=== CURRENT TOOLS ===`,
      formData.current_tools?.length
        ? (formData.current_tools as string[]).map((t: string) => `- ${t}`).join('\n')
        : 'Not specified',
      ``,
      `=== ROI ESTIMATES FROM OPPORTUNITY ASSESSMENT ===`,
      `Hours saved per week: ${metrics.hours_saved_per_week ?? 'TBD'}`,
      `Annual cost savings: $${metrics.annual_cost_savings?.toLocaleString() ?? 'TBD'}`,
      `Implementation cost: $${metrics.implementation_cost_low?.toLocaleString() ?? 'TBD'} – $${metrics.implementation_cost_high?.toLocaleString() ?? 'TBD'}`,
      `Payback period: ${metrics.payback_months ?? 'TBD'} months`,
      `3-year ROI: ${metrics.three_year_roi ?? 'TBD'}%`,
      `Automation opportunities identified: ${metrics.opportunities_count ?? 'TBD'}`,
    ];

    if (assessment.transcript) {
      contextParts.push(
        `\n=== DISCOVERY CALL NOTES ===\n${String(assessment.transcript).slice(0, 10000)}`
      );
    }

    const userMessage = contextParts.filter(Boolean).join('\n');

    // ── 3. Call Claude ───────────────────────────────────────────────────────
    console.log('[blueprint/generate] Calling Claude for assessment:', assessment_id);
    const startTime = Date.now();

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8096,
      system: BLUEPRINT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const rawText = message.content[0].type === 'text' ? message.content[0].text : '{}';
    console.log('[blueprint/generate] Claude responded in', Date.now() - startTime, 'ms');

    // ── 4. Parse and save ────────────────────────────────────────────────────
    const result = extractJson(rawText);
    const html =
      (result.html as string) ||
      '<p>Blueprint generation failed. Please try again.</p>';

    const { error: updateError } = await supabase
      .from('opportunity_assessments')
      .update({ blueprint_content: html })
      .eq('id', assessment_id);

    if (updateError) {
      console.error('[blueprint/generate] DB update error:', updateError);
      // Still return the HTML so the user can see it
      return NextResponse.json(
        { error: 'Saved in memory but DB update failed: ' + updateError.message, html },
        { status: 207 }
      );
    }

    return NextResponse.json({ html });
  } catch (err) {
    console.error('[blueprint/generate] Error:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Internal server error' },
      { status: 500 }
    );
  }
}
