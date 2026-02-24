/**
 * Zapier Prompt Builder
 * Generates system prompts, user messages, and context addenda
 * for Zapier workflow JSON, build plans, and solution demos.
 */
import { ZAPIER_APP_REFERENCE } from './app-reference';

// ── Workflow JSON system prompt ───────────────────────────────────────────────

export const ZAPIER_WORKFLOW_SYSTEM = `You are an expert Zapier automation engineer at ManageAI. Generate a complete, structured Zap definition JSON with detailed per-step setup instructions.

${ZAPIER_APP_REFERENCE}

The JSON must follow this EXACT schema:
{
  "name": "Descriptive Zap Name",
  "description": "Full end-to-end description of what this Zap does",
  "steps": [
    {
      "position": 1,
      "type": "trigger",
      "app": "app-slug",
      "app_display_name": "Human-Readable App Name",
      "event": "Event Name",
      "event_key": "event_key_slug",
      "event_description": "One sentence describing what triggers this Zap",
      "config": {
        "example_field": "example value"
      },
      "output_fields": ["field1", "field2", "field3"],
      "setup_instructions": "1. In Zapier, search for [App Name] as your trigger app.\\n2. Select '[Event Name]' as the trigger event.\\n3. Connect your [App] account via OAuth — click 'Sign in to [App]'.\\n4. Configure the trigger settings: [specific fields].\\n5. Click 'Test trigger' and verify you see sample data."
    },
    {
      "position": 2,
      "type": "filter",
      "app": "filter",
      "app_display_name": "Filter by Zapier",
      "event": "Only continue if...",
      "event_description": "Stops the Zap if the condition is not met — does not count as a task",
      "config": {
        "conditions": [
          {
            "field": "{{step1.status}}",
            "operator": "text_exactly_matches",
            "value": "active"
          }
        ]
      },
      "setup_instructions": "1. Add a Filter step after the trigger.\\n2. Set condition: [field] [operator] [value].\\n3. Click 'Continue' to confirm the filter logic.\\n4. Use 'Test' to verify the filter passes for your sample data."
    },
    {
      "position": 3,
      "type": "action",
      "app": "app-slug",
      "app_display_name": "Human-Readable App Name",
      "event": "Action Event Name",
      "event_key": "action_event_slug",
      "event_description": "What this action does",
      "config": {},
      "input_mapping": {
        "field_name": "Maps from Step 1: {{step1.email}} — the submitter's email address",
        "another_field": "Maps from Step 1: {{step1.name}} — full name"
      },
      "output_fields": ["id", "url", "status"],
      "setup_instructions": "1. Add [App Name] as an action step.\\n2. Select '[Event Name]' as the action event.\\n3. Connect your [App] account — click 'Sign in to [App]'.\\n4. Map the required fields:\\n   • [Field 1]: Select [Step 1 > field_name] from the dropdown\\n   • [Field 2]: Select [Step 1 > other_field] from the dropdown\\n5. Click 'Test action' and verify the record was created in [App]."
    }
  ],
  "estimated_task_usage": "3 tasks per run × 50 triggers/day ≈ 4,500 tasks/month",
  "required_zapier_plan": "Professional",
  "premium_apps_used": [],
  "required_accounts": ["Account 1", "Account 2"],
  "setup_time_estimate": "20-30 minutes",
  "transfer_instructions": "To set up this Zap in your Zapier account:\\n1. Log in at zapier.com\\n2. Click 'Create Zap'\\n3. Follow each step's setup_instructions in order\\n4. Test each step before proceeding to the next\\n5. Click 'Publish' when all steps test successfully"
}

RULES:
- Include 3-7 steps (trigger + optional filter/formatter + 1-4 actions)
- Always start with exactly ONE trigger step at position 1
- Add Filter steps wherever data gating is needed (they don't count as tasks when they stop the Zap)
- Add Formatter steps for data transformation (date formatting, text splitting, number math)
- Use Paths for conditional branching (flag required_zapier_plan as "Professional")
- Use accurate app slugs from the reference above (e.g., google_sheets, slack, gmail, hubspot)
- setup_instructions must be detailed step-by-step numbered instructions an n on-technical person can follow
- input_mapping must clearly describe which step and field each value comes from
- premium_apps_used must list any premium apps (OpenAI, Salesforce, HubSpot, Shopify, Stripe)
- estimated_task_usage must include per-run count and monthly estimate at realistic trigger volume
- required_zapier_plan must be "Free", "Starter", "Professional", or "Team" based on features used
- ALL content must be specific to the project described — no placeholder examples`;

// ── Workflow user message ─────────────────────────────────────────────────────

export function buildZapierWorkflowUserMessage(context: string): string {
  return `Generate the complete Zapier Zap definition JSON for this project:

${context}

IMPORTANT:
- Output ONLY the JSON object — no markdown fences, no explanation text before or after
- Each step MUST have detailed setup_instructions as numbered steps
- input_mapping MUST reference the exact step number and field (e.g., "Maps from Step 1: {{step1.email}}")
- required_zapier_plan must reflect the actual features used (Paths = Professional, multi-step = Starter)
- estimated_task_usage must be realistic for the described automation volume
- Make every step specific to this exact use case — no generic placeholder steps`;
}

// ── Build plan addendum ───────────────────────────────────────────────────────

export function getZapierBuildPlanAddendum(): string {
  return `

=== ZAPIER-SPECIFIC BUILD PLAN REQUIREMENTS ===

This is a Zapier automation — Zapier does NOT have a public API for programmatic Zap creation, so the build plan MUST serve as a complete manual setup guide. Include ALL of the following:

**1. Required Zapier Plan Recommendation**
Based on the automation complexity, recommend the appropriate plan (Free/Starter/Professional/Team) and explain why (multi-step = Starter minimum; Paths/Webhooks = Professional).

**2. Account Prerequisites**
List every app account the client must have connected in Zapier BEFORE setup begins. Include:
- Whether a free or paid plan is needed for each app
- Which apps are Premium in Zapier (OpenAI, Salesforce, HubSpot Marketing, Shopify, Stripe)
- Estimated premium task cost warnings where applicable

**3. Step-by-Step Zap Creation Guide**
For EACH step in the Zap, provide:
- Exact app name to search for in Zapier
- Exact event/trigger name to select
- Account connection instructions (OAuth flow or API key location)
- Every field to configure, with the exact value or mapping
- How to use Zapier's built-in "Test" button for that step
- Expected test output for that step

**4. Zapier-Specific Features Used**
If the Zap uses Filters, explain the exact condition and why it's needed.
If it uses Paths, explain each branch's purpose and condition.
If it uses Formatter, show the exact transformation configuration.
If it uses Delay, explain the timing configuration.

**5. Task Usage & Cost Estimate**
- Tasks per Zap run (count each action step)
- Estimated monthly trigger volume for this use case
- Total estimated monthly tasks
- Whether that fits within the recommended plan's task limit
- Cost per task overage if applicable

**6. Zap Management Instructions**
- How to turn the Zap on/off
- How to view Zap history (Task History in Zapier)
- How to debug failed runs (using Zapier's error details)
- How to edit a live Zap (pause, edit, re-enable)
- Setting up Zap error notifications (email alerts)

**7. Go-Live Checklist (Zapier-specific)**
Include these as interactive checklist items:
- [ ] All required app accounts connected in Zapier
- [ ] Trigger step tested with real sample data
- [ ] Each action step tested individually
- [ ] Filter conditions verified with both passing and failing test data
- [ ] End-to-end Zap run tested in draft mode
- [ ] Task usage reviewed against plan limit
- [ ] Error notification email configured
- [ ] Zap published (turned on)
- [ ] First live run verified in Task History

In the Build Steps tab, replace generic node labels with Zapier step labels: "Step 1: Trigger", "Step 2: Filter", "Step 3: Action — [App Name]". Each step card must include the exact Zapier UI field names and values.`;
}

// ── Demo addendum ─────────────────────────────────────────────────────────────

export function getZapierDemoAddendum(): string {
  return `

=== ZAPIER-SPECIFIC DEMO REQUIREMENTS ===

This is a Zapier automation. The demo must reflect Zapier's visual identity and workflow:

**How It Works Tab:**
Show the Zap flow as Zapier displays it — a vertical or horizontal chain of numbered steps:
- Step 1 is always the trigger (use a lightning bolt ⚡ icon and orange color #FF4A00)
- Each subsequent step is an action or filter (use blue #4A8FD6 for actions, gray for filters)
- Show connecting lines/arrows between steps
- Each step card shows: step number, app name, event name, one-line description
- Filters show as a gate/diamond shape with the condition text

**Live Demo Tab:**
The simulation must show:
- A trigger event occurring (e.g., "New form submission received from John Smith")
- Each step processing in sequence with 800ms delay:
  - Trigger: shows the input data
  - Filter steps: shows "Condition checked ✓ — continuing" or "Condition failed — Zap stopped"
  - Action steps: shows what was created/updated (realistic record preview)
- The final "success" state shows all steps green with a task count ("3 tasks used")
- Add a note: "In Zapier, this Zap would consume X tasks per run"

**Architecture Tab:**
Include a "Zapier Plan Required" callout showing the recommended plan and why.
Show any Premium apps with a ⭐ badge and note the additional task cost.
Include the "What You Set Up Manually" section since Zapier requires manual configuration.

**Next Steps Tab:**
Instead of a generic "Schedule Kickoff Call", show:
1. "Receive Workflow JSON Reference" (already generated)
2. "Connect App Accounts in Zapier"
3. "Follow Step-by-Step Setup Guide" (from Build Plan)
4. "Test & Publish Your Zap"
The CTA button should say "Download Setup Guide" not "Schedule Kickoff Call".`;
}
