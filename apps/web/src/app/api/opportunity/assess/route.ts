import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// Allow up to 5 minutes — Claude generates a full HTML document
export const maxDuration = 300;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Lazy-initialised so the module can be imported at build time without env vars
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const ASSESSMENT_SYSTEM_PROMPT = `You are a senior AI strategy consultant at ManageAI.
Given the company profile and discovery call notes below, generate a comprehensive
Opportunity Assessment document.

The assessment must include:

1. EXECUTIVE SUMMARY
   - Company overview (1-2 sentences)
   - Primary challenge identified from their pain points
   - ManageAI's recommended approach

2. CURRENT STATE ANALYSIS
   - Manual processes identified based on their pain points and tools
   - Tools/systems they're currently using
   - Estimated time wasted per week on manual tasks (be specific with numbers)
   - Key pain points ranked by business impact

3. AUTOMATION OPPORTUNITIES (5-7 specific opportunities tailored to their industry)
   For each opportunity provide:
   - Name (concise, action-oriented)
   - Description of what gets automated
   - Current manual process being replaced
   - Proposed automation solution
   - Platform recommendation: n8n, Make.com, or Zapier (choose the best fit)
   - Complexity: simple / moderate / complex
   - Estimated build time (e.g., "1-2 weeks")
   - Hours saved per week (specific number)
   - Estimated annual ROI in dollars (hours × $50/hr × 52 weeks)

4. RECOMMENDED AI TEAMMATES
   Choose from these ManageAI AI teammates:
   - Rebecka: AI Sales Assistant — handles follow-ups, lead scoring, proposal tracking
   - Daniel: AI Delivery Ops — client onboarding, project tracking, status updates
   - Sarah: AI Content Engine — blog posts, social media, email sequences
   - Andrew: AI Data Analyst — reporting, dashboards, KPI tracking, data pipelines
   For each recommended teammate:
   - Specific use cases for this company
   - Expected time saved per week
   - Expected business impact

5. IMPLEMENTATION ROADMAP
   - Phase 1 (Month 1-2): Quick wins — 2-3 automations deployable in under 2 weeks each
   - Phase 2 (Month 3-4): Core automations — the highest-value items
   - Phase 3 (Month 5-6): Advanced AI integration — AI teammates + sophisticated workflows
   - Estimated total investment range (low/high in dollars)
   - Expected time to positive ROI

6. TOTAL ROI SUMMARY
   - Total hours saved per week (sum across all automation opportunities)
   - Annual cost savings (hours saved × $50/hr × 52 weeks)
   - Estimated implementation investment range
   - Payback period in months
   - 3-year ROI percentage

You MUST respond with a valid JSON object (no markdown code fences, no explanation) with exactly two fields:

1. "html": A complete, standalone HTML document with:
   - @import for DM Sans from Google Fonts
   - Inline <style> tag only (no external CSS files)
   - Colors: #4A8FD6 (ManageAI blue), #1A1A2E (dark), #F8F9FB (light bg), #27AE60 (green for ROI/savings), #E74C3C (red for pain points)
   - Cover section: ManageAI logo text + "Opportunity Assessment" + company name + date
   - All 6 sections above, well-formatted with headers, bullet points, tables where appropriate
   - ROI summary as a visual metrics grid (4 boxes with big numbers)
   - Print-friendly (good page breaks, no sticky elements)
   - Footer with ManageAI branding
   - Professional enough to send directly to a C-level executive

2. "metrics": {
     "hours_saved_per_week": <total number>,
     "annual_cost_savings": <total dollars>,
     "implementation_cost_low": <low estimate dollars>,
     "implementation_cost_high": <high estimate dollars>,
     "payback_months": <number>,
     "three_year_roi": <percentage as integer, e.g. 340>,
     "opportunities_count": <number of automation opportunities>
   }

Return ONLY the JSON object. Nothing before it, nothing after it.`;

/** Robustly extract JSON from Claude response */
function extractJson(raw: string): Record<string, unknown> {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : raw.trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    console.error('[opportunity/assess] Could not find JSON in response');
    return {};
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch (e) {
    console.error('[opportunity/assess] JSON.parse failed:', e);
    return {};
  }
}

export async function POST(req: NextRequest) {
  console.log('\n========== [opportunity/assess] POST called ==========');
  const supabase = getSupabase();

  try {
    const body = await req.json();
    const {
      company_name,
      contact_name,
      industry,
      company_size,
      website,
      pain_points,
      current_tools,
      transcript,
      annual_revenue,
      primary_goal,
      pipedrive_deal_id,
    } = body as {
      company_name: string;
      contact_name: string;
      industry: string;
      company_size: string;
      website?: string;
      pain_points: string[];
      current_tools: string[];
      transcript?: string;
      annual_revenue: string;
      primary_goal: string;
      pipedrive_deal_id?: number;
    };

    if (!company_name || !contact_name || !industry) {
      return NextResponse.json(
        { error: 'company_name, contact_name, and industry are required' },
        { status: 400 }
      );
    }

    // ── Build context ────────────────────────────────────────────────────────
    const contextParts: string[] = [
      `=== COMPANY PROFILE ===`,
      `Company Name: ${company_name}`,
      `Primary Contact: ${contact_name}`,
      `Industry: ${industry}`,
      `Company Size: ${company_size || 'Not specified'}`,
      website ? `Website: ${website}` : '',
      `Annual Revenue: ${annual_revenue || 'Not specified'}`,
      `Primary Goal: ${primary_goal || 'Not specified'}`,
      ``,
      `=== PAIN POINTS / CHALLENGES ===`,
      pain_points?.length
        ? pain_points.map((p) => `- ${p}`).join('\n')
        : 'Not specified',
      ``,
      `=== CURRENT TOOLS & TECH STACK ===`,
      current_tools?.length
        ? current_tools.map((t) => `- ${t}`).join('\n')
        : 'Not specified',
    ];

    if (transcript && transcript.trim()) {
      contextParts.push(
        `\n=== DISCOVERY CALL TRANSCRIPT / NOTES ===\n${transcript.trim().slice(0, 15000)}`
      );
    }

    const userMessage = contextParts.filter(Boolean).join('\n');
    console.log('[opportunity/assess] Context length:', userMessage.length, 'chars');

    // ── Call Claude ──────────────────────────────────────────────────────────
    console.log('[opportunity/assess] Calling Claude claude-sonnet-4-6...');
    const startTime = Date.now();

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8096,
      system: ASSESSMENT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const rawText = message.content[0].type === 'text' ? message.content[0].text : '{}';
    console.log('[opportunity/assess] Claude responded in', Date.now() - startTime, 'ms');
    console.log('[opportunity/assess] Response length:', rawText.length, 'chars');
    console.log('[opportunity/assess] Stop reason:', message.stop_reason);

    // ── Parse response ───────────────────────────────────────────────────────
    const result = extractJson(rawText);
    const html = (result.html as string) || '<p>Assessment generation failed. Please try again.</p>';
    const metrics = (result.metrics as Record<string, number>) || {};

    console.log('[opportunity/assess] Parsed metrics:', metrics);

    // ── Save to Supabase ─────────────────────────────────────────────────────
    const formData = {
      company_name,
      contact_name,
      industry,
      company_size,
      website,
      pain_points,
      current_tools,
      annual_revenue,
      primary_goal,
    };

    const { data: saved, error: dbError } = await getSupabase()
      .from('opportunity_assessments')
      .insert({
        company_name,
        contact_name,
        form_data: formData,
        transcript: transcript || null,
        assessment: { metrics },
        html_content: html,
        status: 'draft',
        pipedrive_deal_id: pipedrive_deal_id || null,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('[opportunity/assess] DB insert error:', dbError);
      // Still return the generated content even if DB save fails
      return NextResponse.json(
        { error: 'Failed to save assessment: ' + dbError.message, html, metrics },
        { status: 500 }
      );
    }

    console.log('[opportunity/assess] Saved assessment id:', saved?.id);
    return NextResponse.json({ id: saved?.id, html, metrics });
  } catch (err) {
    console.error('[opportunity/assess] Error:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Internal server error' },
      { status: 500 }
    );
  }
}
