# AUTONOMOUS_AGENTS.md — ManageAI Agentic Operations Build Plan
## Phase 3-4: From Reactive Assistants to Autonomous Teammates
### Execute After: Phase 2 workstreams complete and verified
### Last Updated: February 24, 2026

---

## WHAT THIS DOCUMENT IS

This is the executable build plan for transforming ManageAI's AI agents from reactive chat assistants into proactive, autonomous teammates that run the agency's operations without being asked.

**Read CLAUDE.md first for full system context before executing anything here.**

When you are ready to execute, this document is self-contained — it tells you exactly what to build, in what order, in what files.

---

## THE CORE SHIFT

**Before (what exists after Phase 2):**
- Human opens dashboard → asks agent a question → agent responds
- Agent reads data, suggests actions
- Human manually does the action

**After (what this builds):**
- Agents wake up on schedules, assess situations, take actions, report results
- Agents trigger each other through a shared event bus
- Humans only intervene at decision points
- The platform runs the agency overnight

---

## ARCHITECTURE OVERVIEW

### Three New Systems to Build

```
1. SCHEDULER ENGINE
   Cron-triggered agent runs on schedules
   File: apps/web/src/lib/scheduler/

2. EVENT BUS
   Agents communicate through activity_events table
   Triggers: deal closed → ticket created → build complete → monitor starts
   File: apps/web/src/lib/events/

3. WEBHOOK RECEIVERS  
   External systems trigger agents automatically
   Pipedrive webhook → Sales Agent wakes up
   Form submission → Lead enrichment starts
   File: apps/web/src/app/api/webhooks/
```

---

## PHASE 3A — SCHEDULED AGENTS (Build First)

### What It Does
Agents run automatically on time-based schedules. No human prompt needed. They assess, act, and report.

### New Files to Create

#### `apps/web/src/lib/scheduler/index.ts`
Master scheduler that registers all scheduled jobs.

```typescript
export interface ScheduledJob {
  name: string;
  schedule: string;        // cron expression
  department: string;
  agentName: string;
  task: string;            // what to tell the agent to do
  enabled: boolean;
}

export const SCHEDULED_JOBS: ScheduledJob[] = [
  {
    name: 'ceo-morning-brief',
    schedule: '0 7 * * 1-5',   // 7am weekdays
    department: 'ceo',
    agentName: 'Executive AI',
    task: `Generate the daily executive brief. Include:
      1. Pipeline summary: total open deals, total value, deals moved yesterday
      2. Build queue: tickets in BUILDING status, any overdue (>5 days)
      3. Deployment health: any failed deploys in last 24h
      4. Client alerts: any clients needing attention
      5. Team capacity: open tickets per person
      Format as a clean summary Dave can read in 2 minutes.
      Post to Slack #leadership channel.
      Save to activity_events with event_type='morning_brief'.`,
    enabled: true
  },
  {
    name: 'sales-pipeline-review',
    schedule: '0 8 * * 1-5',   // 8am weekdays
    department: 'sales',
    agentName: 'Sales AI',
    task: `Run daily pipeline review. 
      1. Find all deals with no activity in 7+ days — draft a follow-up note for each
      2. Find deals where expected close date has passed — flag for Tony
      3. Find deals with $0 value — list them for Tony to update
      4. Identify the top 3 deals most likely to close this week
      Post summary to Slack #sales.
      Save findings to activity_events.`,
    enabled: true
  },
  {
    name: 'build-queue-check',
    schedule: '0 9 * * 1-5',   // 9am weekdays
    department: 'engineering',
    agentName: 'Engineering AI',
    task: `Check the build queue.
      1. List all tickets in BUILDING status with age > 3 days — flag as at-risk
      2. List tickets in SUBMITTED status not yet analyzed — trigger analysis if stuck
      3. List tickets in REVIEW_PENDING for > 2 days — nudge reviewer
      4. Summarize: X builds in progress, Y at risk, Z waiting review
      Post to Slack #builds.
      Save to activity_events.`,
    enabled: true
  },
  {
    name: 'delivery-health-check',
    schedule: '0 9 * * 1-5',   // 9am weekdays
    department: 'delivery',
    agentName: 'Delivery AI',
    task: `Run client health check.
      1. Check all deployments from last 30 days — any errors or failures?
      2. List clients with no ticket activity in 30+ days — potential churn risk
      3. List clients with builds completing this week — schedule delivery review
      4. Flag any client with 2+ failed deployments
      Post health summary to Slack #delivery.
      Save to activity_events with event_type='health_check'.`,
    enabled: true
  },
  {
    name: 'weekly-ceo-report',
    schedule: '0 8 * * 1',     // 8am every Monday
    department: 'ceo',
    agentName: 'Executive AI',
    task: `Generate weekly company report for Dave.
      1. Deals: new deals added, deals closed, pipeline value change WoW
      2. Builds: tickets created, completed, deployed last week
      3. Revenue signals: total deployment value, retainer clients active
      4. Team: busiest team members, capacity for new work
      5. Wins: notable completions from last week
      6. Risks: stalled deals, overdue builds, unhappy clients
      Email report to dave@manageai.io.
      Post summary to #leadership.`,
    enabled: true
  },
  {
    name: 'monthly-client-reports',
    schedule: '0 9 1 * *',     // 9am on the 1st of every month
    department: 'delivery',
    agentName: 'Delivery AI',
    task: `Generate monthly performance reports for all active clients.
      For each client with at least one deployed automation:
      1. Pull deployment records and any available run data
      2. Generate a performance summary: automations active, estimated tasks saved
      3. Calculate estimated hours saved (assume 2min per automated task)
      4. Draft the client email with the report attached
      5. Save report to client_reports table with status='pending_review'
      Alert Dan in Slack #delivery: "X monthly reports ready for review"
      Dan will review and approve before sending.`,
    enabled: true
  },
  {
    name: 'marketing-content-pipeline',
    schedule: '0 10 * * 1',    // 10am every Monday
    department: 'marketing',
    agentName: 'Marketing AI',
    task: `Weekly content generation.
      1. Find all tickets that moved to CLOSED status last week
      2. For each completed build: draft a case study outline (company type, problem, solution, automation built, expected ROI)
      3. Draft 3 LinkedIn posts for the week based on completed builds
      4. Draft 1 longer-form blog post idea with outline
      5. Save all drafts to activity_events with event_type='content_draft'
      Post to Slack #marketing: "X content pieces ready for Robert to review"`,
    enabled: true
  }
];
```

#### `apps/web/src/lib/scheduler/runner.ts`
Executes a scheduled job by calling the agent chat API.

```typescript
import { SCHEDULED_JOBS, ScheduledJob } from './index';

export async function runScheduledJob(jobName: string): Promise<void> {
  const job = SCHEDULED_JOBS.find(j => j.name === jobName);
  if (!job || !job.enabled) return;

  // Call the agent chat API with the scheduled task
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      department: job.department,
      messages: [{ role: 'user', content: job.task }],
      isScheduled: true,        // flag so agent knows this is autonomous
      jobName: job.name
    })
  });

  // Log the run to activity_events
  await logScheduledRun(job, response);
}

export async function runAllJobsForSchedule(cronExpression: string): Promise<void> {
  const matchingJobs = SCHEDULED_JOBS.filter(
    j => j.enabled && j.schedule === cronExpression
  );
  await Promise.all(matchingJobs.map(j => runScheduledJob(j.name)));
}
```

#### `apps/web/src/app/api/scheduler/route.ts`
API endpoint that Vercel Cron calls.

```typescript
// Vercel Cron configuration — add to vercel.json:
// {
//   "crons": [
//     { "path": "/api/scheduler?schedule=0+7+*+*+1-5", "schedule": "0 7 * * 1-5" },
//     { "path": "/api/scheduler?schedule=0+8+*+*+1-5", "schedule": "0 8 * * 1-5" },
//     { "path": "/api/scheduler?schedule=0+9+*+*+1-5", "schedule": "0 9 * * 1-5" },
//     { "path": "/api/scheduler?schedule=0+10+*+*+1",  "schedule": "0 10 * * 1"  },
//     { "path": "/api/scheduler?schedule=0+8+*+*+1",   "schedule": "0 8 * * 1"   },
//     { "path": "/api/scheduler?schedule=0+9+1+*+*",   "schedule": "0 9 1 * *"   }
//   ]
// }

export async function GET(request: Request) {
  // Verify this is a legitimate Vercel Cron call
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const schedule = new URL(request.url).searchParams.get('schedule');
  await runAllJobsForSchedule(schedule);
  return Response.json({ status: 'ok', schedule, ran: new Date().toISOString() });
}
```

#### `apps/web/vercel.json` — Update to add cron config
```json
{
  "crons": [
    { "path": "/api/scheduler?job=ceo-morning-brief",     "schedule": "0 7 * * 1-5" },
    { "path": "/api/scheduler?job=sales-pipeline-review", "schedule": "0 8 * * 1-5" },
    { "path": "/api/scheduler?job=build-queue-check",     "schedule": "0 9 * * 1-5" },
    { "path": "/api/scheduler?job=delivery-health-check", "schedule": "0 9 * * 1-5" },
    { "path": "/api/scheduler?job=weekly-ceo-report",     "schedule": "0 8 * * 1"   },
    { "path": "/api/scheduler?job=monthly-client-reports","schedule": "0 9 1 * *"   },
    { "path": "/api/scheduler?job=marketing-content-pipeline", "schedule": "0 10 * * 1" }
  ]
}
```

#### `apps/web/src/app/dashboard/settings/agents/page.tsx`
New settings page where Dave/Brian can enable/disable scheduled jobs and see run history.

```
Layout:
┌─────────────────────────────────────────────────────────┐
│  Scheduled Agent Jobs                    [+ New Job]    │
├─────────────────────────────────────────────────────────┤
│  CEO Morning Brief        Daily 7am    [●ON]  [Run Now] │
│  Sales Pipeline Review    Daily 8am    [●ON]  [Run Now] │
│  Build Queue Check        Daily 9am    [●ON]  [Run Now] │
│  Delivery Health Check    Daily 9am    [●ON]  [Run Now] │
│  Weekly CEO Report        Mon 8am      [●ON]  [Run Now] │
│  Monthly Client Reports   1st 9am      [●ON]  [Run Now] │
│  Marketing Pipeline       Mon 10am     [●ON]  [Run Now] │
├─────────────────────────────────────────────────────────┤
│  Recent Runs                                            │
│  ✓ CEO Morning Brief      Today 7:00am    2m 14s       │
│  ✓ Sales Pipeline Review  Today 8:00am    1m 47s       │
│  ✗ Build Queue Check      Yesterday       FAILED       │
└─────────────────────────────────────────────────────────┘
```

Add to Sidebar under SYSTEM: "Agent Jobs" → `/dashboard/settings/agents`

---

## PHASE 3B — EVENT BUS (Agent-to-Agent Communication)

### What It Does
When one agent takes an action, other agents are notified and can respond. The `activity_events` table becomes a shared message bus.

### New Files to Create

#### `apps/web/src/lib/events/index.ts`
Event publisher and subscriber.

```typescript
export type EventType =
  | 'deal.closed'           // Tony closes deal → Brian notified
  | 'ticket.created'        // New ticket → Engineering notified
  | 'ticket.approved'       // Brian approves → Dan notified
  | 'ticket.deployed'       // Deploy complete → Marketing + Dan notified
  | 'ticket.failed'         // Build failed → Brian alerted
  | 'client.at_risk'        // Health score drops → Dan + Dave alerted
  | 'client.churned'        // Client gone → Dave + Tony alerted
  | 'automation.error'      // Live automation failing → Dan + Brian alerted
  | 'lead.qualified'        // New qualified lead → Tony alerted
  | 'report.ready'          // Monthly report generated → Dan notified
  | 'content.drafted'       // Content ready → Robert notified
  | 'assessment.completed'  // Opportunity assessment done → Tony notified

export interface AgentEvent {
  type: EventType;
  payload: Record<string, any>;
  fromAgent: string;
  toAgents: string[];        // which agents should react
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export async function publishEvent(event: AgentEvent): Promise<void> {
  // Write to activity_events table
  // Trigger any listening agents via /api/agent/react endpoint
}

export async function subscribeToEvents(
  agentName: string,
  eventTypes: EventType[],
  handler: (event: AgentEvent) => Promise<void>
): Promise<void>
```

#### `apps/web/src/app/api/agent/react/route.ts`
New endpoint — agents react to events published by other agents.

```typescript
// POST /api/agent/react
// Body: { event: AgentEvent }
// 
// Each agent has a reaction map:
// Engineering AI: reacts to 'deal.closed' → checks build capacity, acknowledges new ticket
// Delivery AI: reacts to 'ticket.deployed' → begins monitoring, schedules review
// Marketing AI: reacts to 'ticket.deployed' → drafts case study
// Sales AI: reacts to 'client.at_risk' → drafts re-engagement, alerts Tony
// Executive AI: reacts to 'automation.error' urgent → immediate brief to Dave
```

### Event Trigger Points (Add to Existing Code)

**When deal closes in Pipedrive** (`lib/integrations/pipedrive.ts`):
```typescript
await publishEvent({
  type: 'deal.closed',
  payload: { dealId, dealTitle, value, contactEmail, orgName },
  fromAgent: 'Sales AI',
  toAgents: ['Engineering AI', 'Delivery AI'],
  priority: 'high'
});
```

**When ticket deployed** (`lib/deploy/*.ts`):
```typescript
await publishEvent({
  type: 'ticket.deployed',
  payload: { ticketId, platform, clientName, deployUrl },
  fromAgent: 'Engineering AI',
  toAgents: ['Delivery AI', 'Marketing AI', 'Executive AI'],
  priority: 'normal'
});
```

**When ticket approved** (`app/api/tickets/[id]/approve/route.ts`):
```typescript
await publishEvent({
  type: 'ticket.approved',
  payload: { ticketId, clientName, platform },
  fromAgent: 'system',
  toAgents: ['Engineering AI', 'Delivery AI'],
  priority: 'normal'
});
```

---

## PHASE 3C — WEBHOOK RECEIVERS

### What It Does
External systems trigger agents automatically. Pipedrive deal stage changes → agent reacts. Website form submission → lead enrichment starts. No human needed to initiate.

### New Files to Create

#### `apps/web/src/app/api/webhooks/pipedrive/route.ts`
```typescript
// Pipedrive sends webhooks on deal events
// Configure in Pipedrive: Settings → Webhooks → Add webhook
// URL: https://web-manage-ai1.vercel.app/api/webhooks/pipedrive

export async function POST(request: Request) {
  const body = await request.json();
  const { event, current, previous } = body;

  // Deal moved to Won stage
  if (event === 'updated.deal' && current.status === 'won') {
    await publishEvent({
      type: 'deal.closed',
      payload: { dealId: current.id, dealTitle: current.title, value: current.value },
      fromAgent: 'pipedrive-webhook',
      toAgents: ['Sales AI', 'Engineering AI'],
      priority: 'high'
    });
  }

  // Deal moved to specific stage (e.g., "Proposal Sent")
  if (event === 'updated.deal' && current.stage_id !== previous?.stage_id) {
    await handleDealStageChange(current, previous);
  }

  // New person added
  if (event === 'added.person') {
    await handleNewContact(current);
  }

  return Response.json({ received: true });
}
```

#### `apps/web/src/app/api/webhooks/form/route.ts`
```typescript
// Receives form submissions from manageai.io website
// New lead → enrich → score → create Pipedrive deal → notify Tony

export async function POST(request: Request) {
  const lead = await request.json();

  // Enrich with available data
  // Score based on company size, industry, form responses
  // Create Pipedrive deal via Sales AI
  // Notify Tony via Slack
  // Start nurture sequence via Resend

  await publishEvent({
    type: 'lead.qualified',
    payload: lead,
    fromAgent: 'website-webhook',
    toAgents: ['Sales AI', 'Marketing AI'],
    priority: 'high'
  });

  return Response.json({ received: true });
}
```

#### `apps/web/src/app/api/webhooks/n8n/route.ts`
```typescript
// n8n sends execution reports back to ManageAI
// Track automation health per client

export async function POST(request: Request) {
  const { workflowId, status, executionId, errorMessage } = await request.json();

  // Update client_automations table with run data
  // If status === 'error': publish automation.error event
  // Delivery Agent reacts and diagnoses

  if (status === 'error') {
    await publishEvent({
      type: 'automation.error',
      payload: { workflowId, errorMessage, executionId },
      fromAgent: 'n8n-webhook',
      toAgents: ['Delivery AI', 'Engineering AI'],
      priority: 'urgent'
    });
  }

  return Response.json({ received: true });
}
```

---

## PHASE 4A — OPPORTUNITY ASSESSMENT GENERATOR

### What It Does
Tony pastes a call transcript or fills a quick form → Claude generates a full, professional Opportunity Assessment document → Tony sends to prospect as ManageAI's free offer.

### New Files to Create

#### `apps/web/src/app/dashboard/opportunities/page.tsx`
List of all opportunity assessments with status (draft/sent/converted).

#### `apps/web/src/app/dashboard/opportunities/new/page.tsx`
Form for Tony to create a new assessment:
- Company name, industry, company size, website
- Pain points (checkboxes: manual data entry, disconnected systems, slow reporting, etc.)
- Current tools (CRM, email, project management, etc.)
- Call transcript (large textarea, optional)
- Annual revenue estimate
- Primary goal

#### `apps/web/src/app/api/opportunity/assess/route.ts`
```typescript
// POST /api/opportunity/assess
// Generates full opportunity assessment using Claude

const ASSESSMENT_PROMPT = `You are a senior AI strategy consultant at ManageAI.
Given the company information and call transcript below, generate a comprehensive
Opportunity Assessment document.

The assessment must include:

1. EXECUTIVE SUMMARY (2-3 sentences)
   - Company overview
   - Primary challenge
   - ManageAI's recommended approach

2. CURRENT STATE ANALYSIS
   - Manual processes identified
   - Tools/systems they're using
   - Estimated time wasted per week on manual tasks
   - Key pain points ranked by impact

3. AUTOMATION OPPORTUNITIES (5-7 specific opportunities)
   For each opportunity:
   - Name and description
   - Current manual process
   - Proposed automation
   - Platform recommendation (n8n/Make.com/Zapier)
   - Complexity (simple/moderate/complex)
   - Estimated build time
   - Estimated hours saved per week
   - Estimated annual ROI

4. RECOMMENDED AI TEAMMATES
   - Which of Rebecka/Daniel/Sarah/Andrew would benefit this company
   - Specific use cases per teammate
   - Expected impact

5. IMPLEMENTATION ROADMAP
   - Phase 1 (Month 1-2): Quick wins
   - Phase 2 (Month 3-4): Core automations
   - Phase 3 (Month 5-6): Advanced AI integration
   - Estimated total investment
   - Expected ROI timeline

6. TOTAL ROI SUMMARY
   - Total hours saved per week across all automations
   - Annual cost savings (assume $50/hr loaded cost)
   - Implementation investment estimate
   - Payback period
   - 3-year ROI

Return as a JSON object with a 'html' field containing a professionally styled
HTML document ready to send to the client, and a 'metrics' field with the
key numbers for tracking.`;
```

#### Output: Professional HTML Assessment Document
Same styling as build plans — DM Sans font, #4A8FD6 accent, ManageAI branding.
Downloadable as PDF via browser print.
Saved to `opportunity_assessments` table.
Shareable via `/share/assessment/[id]` public route.

---

## PHASE 4B — AI BLUEPRINT GENERATOR

### What It Does
Opportunity assessment → full AI Blueprint strategy document → client-ready presentation that becomes the paid deliverable.

#### `apps/web/src/app/api/blueprint/generate/route.ts`
Takes an opportunity assessment as input, generates:
- Full strategy document (30-50 pages equivalent)
- Executive presentation version (10 slides equivalent as HTML)
- Implementation specifications per automation
- Architecture diagram descriptions
- Vendor/tool recommendations with pricing
- Risk assessment and mitigation strategies

Saves to `ticket_artifacts` table as `artifact_type: 'ai_blueprint'`.
Shareable via `/share/blueprint/[id]`.

---

## PHASE 4C — DEPLOYED AUTOMATION MONITOR

### What It Does
After a workflow is deployed to a client's n8n or Make.com, ManageAI monitors it continuously. Dan sees all client automations on one screen. Issues are caught before clients notice.

### New Files to Create

#### `apps/web/src/lib/monitoring/n8n-monitor.ts`
```typescript
export async function checkWorkflowHealth(
  instanceUrl: string,
  apiKey: string,
  workflowId: string
): Promise<AutomationHealth> {
  // GET /api/v1/workflows/{id} — is it active?
  // GET /api/v1/executions?workflowId={id}&limit=10 — recent runs
  // Calculate: success rate, last run time, error patterns
  return {
    status: 'healthy' | 'degraded' | 'failing' | 'inactive',
    lastRun: Date,
    successRate: number,    // last 10 runs
    errorCount: number,
    lastError: string | null
  };
}
```

#### `apps/web/src/lib/monitoring/make-monitor.ts`
```typescript
export async function checkScenarioHealth(
  region: string,
  apiToken: string,
  scenarioId: number
): Promise<AutomationHealth>
// GET https://{region}.make.com/api/v2/scenarios/{id}
// GET https://{region}.make.com/api/v2/scenarios/{id}/logs
```

#### `apps/web/src/app/api/monitoring/check/route.ts`
Called by Vercel Cron every hour:
```typescript
// GET /api/monitoring/check (cron: every hour)
// For all rows in client_automations table:
//   1. Call appropriate monitor (n8n or Make.com)
//   2. Update client_automations with health status
//   3. Calculate client health score (aggregate of all automations)
//   4. Update client_accounts.health_score
//   5. Publish automation.error event if any automation is failing
```

Add to vercel.json:
```json
{ "path": "/api/monitoring/check", "schedule": "0 * * * *" }
```

#### Monitoring Dashboard on `/dashboard/delivery`
Add "Automation Health" section showing:
- All deployed automations across all clients
- Health status per automation (green/yellow/red)
- Last run time, success rate, error count
- Click → automation detail with run logs
- "Alert Brian" button for engineering issues

---

## PHASE 4D — CLIENT PORTAL

### What It Does
ManageAI clients get their own login. They see their deployed automations, request new builds, view performance reports, and communicate with Dan's team. This is the delivery mechanism for the ongoing management service.

### Architecture

```
/client-portal/                         # Separate from /dashboard/
  login/                                # Separate auth flow
  [clientSlug]/
    page.tsx                            # Client home: health overview
    automations/                        # Their deployed workflows
    builds/                             # Their tickets/builds
    reports/                            # Monthly performance reports
    request/                            # New build request form
    teammates/                          # Their AI teammates (Rebecka etc.)
```

### Auth Flow
- Client receives invitation email (from Dan via platform)
- Sets password, gets access to their slug only
- Supabase RLS: `org_id = auth.jwt().org_id` — they see ONLY their data
- Read-only on most tables, write on `tickets` (new build requests)

### Client Home Page (`/client-portal/[slug]/page.tsx`)
```
┌─────────────────────────────────────────────────────────┐
│  [ManageAI Logo]  Welcome, Cornerstone              👤  │
├─────────────────────────────────────────────────────────┤
│  Your AI Stack                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │ 3 Automations│ │ 847 Tasks    │ │ 42 hrs saved │    │
│  │ ● All Active │ │ this month   │ │ this month   │    │
│  └──────────────┘ └──────────────┘ └──────────────┘    │
│                                                         │
│  Active Automations                  [+ Request Build]  │
│  ● Contract Drafting      Make.com   ✓ Running          │
│  ● Lead Routing           n8n        ✓ Running          │
│  ● Invoice Processing     Make.com   ⚠ 2 errors today  │
│                                                         │
│  Latest Report            [View All Reports]            │
│  February 2026 — Delivered March 1                     │
│  847 contracts processed, 42 hours saved                │
└─────────────────────────────────────────────────────────┘
```

---

## PHASE 4E — SELF-IMPROVING BUILD ENGINE

### What It Does
Every time a build is revised, rejected, or flagged for quality issues, the system learns. Over time, the prompts get better automatically and template matching improves.

### New Files to Create

#### `apps/web/src/lib/learning/feedback-collector.ts`
```typescript
// Triggered when:
// - Ticket moves from REVIEW_PENDING back to BUILDING (revision requested)
// - Deployment fails after approval
// - Client reports issue with delivered automation

export async function recordBuildFeedback(params: {
  ticketId: string;
  platform: string;
  revisionReason: string;
  originalArtifacts: any;
  feedbackType: 'revision_requested' | 'deploy_failed' | 'client_reported';
}): Promise<void>

// Stores in a new build_feedback table
// Aggregates patterns over time
// Engineering agent reads patterns in its daily check
```

#### `apps/web/src/lib/learning/prompt-optimizer.ts`
```typescript
// Weekly: Engineering agent reviews recent feedback
// Identifies patterns: "Make.com builds missing error handlers 40% of the time"
// Suggests prompt improvements
// Brian reviews and approves
// Approved improvements update the platform reference files

export async function analyzeBuildFeedback(daysBack: number): Promise<{
  patterns: string[];
  suggestedImprovements: string[];
  ticketsAnalyzed: number;
}>
```

---

## EXECUTION ORDER

Run these workstreams in this sequence. Each builds on the previous.

| Phase | Workstream | Est. Time | Depends On |
|-------|-----------|-----------|------------|
| 3A | Scheduler Engine | 1 session | Phase 2 complete |
| 3A | vercel.json cron config | 30 min | Scheduler Engine |
| 3A | Agent Jobs settings page | 1 session | Scheduler Engine |
| 3B | Event Bus (`lib/events/`) | 1 session | Phase 2 complete |
| 3B | Agent React endpoint | 1 session | Event Bus |
| 3B | Event triggers in existing code | 1 session | Event Bus |
| 3C | Pipedrive webhook receiver | 30 min | Event Bus |
| 3C | Form webhook receiver | 30 min | Event Bus |
| 3C | n8n webhook receiver | 30 min | Event Bus |
| 4A | Opportunity Assessment Generator | 1 session | Phase 3 complete |
| 4B | AI Blueprint Generator | 1 session | Opportunity Assessment |
| 4C | Deployed Automation Monitor | 1 session | Phase 3 complete |
| 4C | Monitoring cron + dashboard | 1 session | Monitor |
| 4D | Client Portal | 2 sessions | Phase 3 + Monitor |
| 4E | Self-Improving Build Engine | 1 session | 20+ builds of data |

---

## NEW ENVIRONMENT VARIABLES NEEDED

```bash
CRON_SECRET=                    # Random secret for Vercel Cron auth
PIPEDRIVE_WEBHOOK_SECRET=       # Pipedrive webhook verification token
SLACK_BOT_TOKEN=                # Required for scheduled agent notifications
RESEND_API_KEY=                 # Required for client reports + portal invites
N8N_MONITOR_ENABLED=true        # Enable n8n health checking
MAKE_MONITOR_ENABLED=true       # Enable Make.com health checking
```

---

## NEW DATABASE TABLES NEEDED

Run these migrations in Supabase SQL editor before executing Phase 3-4:

```sql
-- Scheduled job run history
CREATE TABLE scheduled_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  department TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT,              -- running|completed|failed
  output TEXT,              -- agent response summary
  error TEXT
);

-- Client accounts (one per ManageAI client)
CREATE TABLE client_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  company_name TEXT NOT NULL,
  pipedrive_deal_id INTEGER,
  status TEXT DEFAULT 'active',
  plan TEXT,
  health_score INTEGER DEFAULT 100,
  assigned_delivery_owner UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Deployed automations per client
CREATE TABLE client_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client_accounts(id),
  ticket_id UUID REFERENCES tickets(id),
  platform TEXT,
  external_id TEXT,
  external_url TEXT,
  status TEXT DEFAULT 'active',
  last_checked TIMESTAMPTZ,
  last_run TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  health TEXT DEFAULT 'unknown'
);

-- Client performance reports
CREATE TABLE client_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client_accounts(id),
  report_type TEXT DEFAULT 'monthly',
  period_start DATE,
  period_end DATE,
  content TEXT,
  metrics JSONB,
  status TEXT DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  created_by TEXT DEFAULT 'agent'
);

-- Opportunity assessments
CREATE TABLE opportunity_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipedrive_deal_id INTEGER,
  company_name TEXT,
  contact_name TEXT,
  form_data JSONB,
  transcript TEXT,
  assessment JSONB,
  html_content TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Build feedback for self-improvement
CREATE TABLE build_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id),
  platform TEXT,
  feedback_type TEXT,
  revision_reason TEXT,
  original_artifacts JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- AI Teammate deployments per client
CREATE TABLE teammate_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client_accounts(id),
  teammate TEXT,
  status TEXT DEFAULT 'active',
  config JSONB,
  deployed_at TIMESTAMPTZ DEFAULT now(),
  last_active TIMESTAMPTZ
);

-- Enable RLS on all new tables
ALTER TABLE scheduled_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE teammate_deployments ENABLE ROW LEVEL SECURITY;
```

---

## ABSOLUTE RULES FOR THIS PHASE

1. **Read CLAUDE.md first** — understand Phase 2 completion before building Phase 3
2. **Phase 3A before everything else** — schedulers need to exist before events make sense
3. **Event bus before webhooks** — webhooks publish events, events need to exist first
4. **Never break Phase 2** — all existing routes, agents, and dashboards must keep working
5. **Every scheduled job needs a "Run Now" button** — for testing without waiting for cron
6. **All external calls need timeouts** — scheduled jobs can't hang indefinitely
7. **Log everything to activity_events** — every autonomous action must be traceable
8. **Demo mode always** — if a key is missing, log intent and continue gracefully
9. **Run npm run build** before every commit — zero TypeScript errors
10. **Test cron locally** by hitting `/api/scheduler?job=job-name` directly before deploying
