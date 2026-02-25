# CLAUDE.md — ManageAI Platform
## Master Build Instructions for Claude Code
### Last Updated: February 24, 2026 | Version 2.0

---

## WHAT THIS IS

ManageAI is an **AI automation agency** serving SMB clients. This platform (`manageai2026/apps/web`) is the **internal operating system** for the ManageAI team AND the delivery infrastructure for client services. It is not a client-facing SaaS — it is the factory floor, the command center, and the service delivery engine all in one.

**Live URL:** https://web-manage-ai1.vercel.app
**Repo:** github.com/Brian2169fdsa/manageai2026
**Stack:** Next.js 16 App Router + TypeScript + Supabase + Claude API + Tailwind + shadcn/ui
**Deploy:** Vercel — auto-deploys on `git push origin main`

---

## THE TEAM — WHO OWNS WHAT

| Person | Title | Owns in Platform | Their Agent Does |
|--------|-------|-----------------|-----------------|
| **Dave** | CEO | CEO Dashboard — company health, revenue, team capacity, client portfolio | Morning brief, revenue forecasts, board-ready summaries, escalation alerts |
| **Chad** | Product Lead | Product Dashboard — roadmap, Figma handoffs, feature tracking, client feedback | Aggregates client requests into features, tracks build quality, syncs with design system |
| **Brian** | AI & Automation Build Lead | Engineering Dashboard + Build Pipeline — the core engine | Auto-matches templates, validates workflow JSON, triggers rebuilds, manages build queue |
| **Dan** | Customer Delivery Lead | Delivery Dashboard — client health, active projects, deployments, reviews | Monitors all deployed automations, flags issues, schedules client reviews, generates performance reports |
| **Tony** | Sales | Sales Dashboard — Pipedrive pipeline, opportunity assessments, proposals | Creates/updates deals, drafts proposals, generates opportunity assessments, schedules demos |
| **Robert** | Marketing | Marketing Dashboard — content calendar, campaigns, social, leads | Drafts content, schedules posts, tracks campaign performance, generates case studies from completed builds |
| **Jacob** | Developer | Engineering Dashboard (shared with Brian) — deployments, infrastructure, code quality | Deploy monitoring, error tracking, CI/CD notifications |
| **Pat** | Consumer App | Product Dashboard (shared with Chad) — client portal, consumer UX | Client portal health, feature adoption, consumer feedback |

---

## WHAT MANAGEAI SELLS (Know This — It Drives Platform Design)

### Service Lines
1. **AI Strategy & Roadmap** — Free opportunity assessment → paid AI Blueprint → 90-day implementation plan. Tony leads, Chad shapes, Dave approves.
2. **Data + AI Infrastructure** — Connect client systems, build knowledge bases (RAG/vector), set up MCP servers, organize their "company brain"
3. **Custom AI Teammates** — Deploy named AI agents into client businesses:
   - **Rebecka** — Executive Assistant (scheduling, email, meeting summaries, agenda prep)
   - **Daniel** — Sales Assistant (lead lists, CRM management, outreach, pre-call briefs)
   - **Sarah** — Marketing Assistant (social, blogs, newsletters, ad copy, brand voice)
   - **Andrew** — Operations Assistant (ticket response, task routing, project coordination, reporting)
4. **Automation Builds** — n8n / Make.com / Zapier workflows built from tickets
5. **Ongoing AI Management** — Monthly reviews, performance optimization, expansion planning. **This is the recurring revenue.**

### The Client Journey
```
Lead comes in (website, referral, outbound)
  → Tony runs Opportunity Assessment (free)
    → Team generates AI Blueprint (strategy + roadmap)
      → Proposal sent → Deal closed in Pipedrive
        → Ticket created → Brian/Jacob build automations
          → Dan oversees delivery → Deployed to client systems
            → Ongoing management (Dan + AI agents)
              → Expansion opportunities surfaced → Tony re-engages
```

---

## PLATFORM VISION — WHAT WE'RE BUILDING

### The Three Layers

**Layer 1 — Build Engine** ✅ COMPLETE
The production line. Tickets → AI analysis → 3 deliverables → one-click deploy. Works for n8n, Make.com, Zapier. 8,076 templates. This generates the core revenue.

**Layer 2 — Agency Operations** 🔨 BUILDING NOW
Every team member has an AI agent that works alongside them — not just reading data but taking actions. Brian's agent manages the build queue. Dan's agent monitors client health. Tony's agent manages his pipeline. These agents are connected to every system and update the platform in real time.

**Layer 3 — Client Service Delivery** 📋 PLANNED
The platform becomes the delivery mechanism for what ManageAI sells. Client portals, deployed automation monitoring, AI Blueprint generator, AI teammate management, performance reports. The agency's service IS the platform.

---

## AGENTIC TEAMMATES — THE CORE PHILOSOPHY

Every agent in this platform is a **fully connected teammate** that:
- Has read AND write access to the systems it owns
- Takes real actions (not just suggestions)
- Updates the platform when it acts (creates tickets, moves deals, sends emails, posts Slack updates)
- Works autonomously on routine tasks and escalates decisions to humans
- Communicates with other agents through the `activity_events` table

### What "Fully Agentic" Means Per Role

**Dave's Executive Agent (CEO)**
- Every morning: generates pipeline summary, revenue forecast, team capacity report, client health overview
- Alerts: flags stalled deals, overdue builds, unhappy clients, budget overruns
- Can: approve deployments, reassign resources, send executive communications
- Escalates: anything requiring strategic decisions

**Brian's Engineering Agent**
- Monitors build queue continuously
- Auto-matches incoming tickets to templates
- Flags complex builds that need human review
- Can: trigger rebuilds, validate workflow JSON, update ticket status, assign builds to Jacob
- Notifies Dan when builds are ready for delivery review
- Escalates: novel requirements with no template match, client system access issues

**Dan's Delivery Agent**
- Owns post-deployment: monitors all live automations for errors/failures
- Generates weekly client performance reports automatically
- Schedules monthly review calls proactively
- Can: update delivery status, create follow-up tickets, flag expansion opportunities to Tony
- Escalates: client-reported issues, automation failures, churn signals

**Tony's Sales Agent**
- Manages Pipedrive as a co-pilot: updates stages, logs calls, drafts follow-ups
- Generates opportunity assessments from call transcripts
- Can: create deals, create persons, add notes, draft proposals, create tickets when deals close
- Escalates: pricing decisions, strategic partnership decisions

**Robert's Marketing Agent**
- Manages content calendar and social scheduling
- Generates case studies from completed builds automatically
- Can: draft blog posts, schedule social content, track campaign metrics, generate lead reports
- Escalates: brand decisions, campaign budget approvals

**Chad's Product Agent**
- Aggregates client feedback from all tickets and delivery notes
- Identifies patterns in feature requests
- Can: create product briefs, update roadmap items, link Figma files to features
- Escalates: prioritization decisions, design reviews

---

## CURRENT PLATFORM STATUS (Audited Feb 24, 2026)

### ✅ COMPLETE — DO NOT MODIFY UNLESS TASK REQUIRES IT

| Feature | Location | Notes |
|---------|----------|-------|
| Auth | `app/login/` + `contexts/AuthContext.tsx` | Supabase email/password |
| Ticket Wizard | `app/portal/new-ticket/` | 3-step wizard |
| AI Analysis | `app/api/analyze-ticket/` | Claude Sonnet, platform-agnostic |
| AI Build Generation | `app/api/generate-build/` | 3 artifacts per ticket |
| n8n Builder | `lib/platforms/` | Production-grade + MCP |
| Make.com Builder | `lib/platforms/make/` | module-reference (160L), prompt-builder (313L) |
| Zapier Builder | `lib/platforms/zapier/` | app-reference (150L), prompt-builder (207L) |
| Template Library | `app/dashboard/templates/` | 8,076 templates across 3 platforms |
| All 3 Deployers | `lib/deploy/` | n8n (93L), Make.com (92L), Zapier (470L) |
| Deploy Settings | `app/dashboard/settings/deploy/` | Full config UI |
| Agent Framework | `app/api/agent/chat/` | 8-iteration loop, tool_use |
| 5 Agent Configs | `lib/agents/configs/index.ts` | All 5 wired with Agent buttons |
| Pipedrive | `lib/integrations/pipedrive.ts` | LIVE — real API |
| Analytics | `app/dashboard/analytics/` | Real Recharts + Supabase |
| All Department Dashboards | `app/dashboard/[dept]/` | Exist, Agent buttons wired |

### 🔴 MUST FIX NOW

| Gap | Why Critical | Fix Location |
|-----|-------------|-------------|
| PDF text extraction | Clients upload PDF SOWs — Claude gets zero context | `app/api/analyze-ticket/route.ts` |
| Ticket Approve/Reject UI | API exists, no buttons — builds can't move to APPROVED | `app/dashboard/tickets/[id]/page.tsx` |

### 🟡 BUILD NEXT

| Feature | Why | Workstream |
|---------|-----|------------|
| Customer/Client pages | Tony + Dan's primary work surface | A |
| Slack real integration | Agents post to #builds, #sales, #alerts | C |
| Resend email live | Client notifications, agent emails | Add key |

---

## ENVIRONMENT VARIABLES

```bash
# Currently set (Production + Local after vercel env pull)
NEXT_PUBLIC_SUPABASE_URL=SET
NEXT_PUBLIC_SUPABASE_ANON_KEY=SET
SUPABASE_SERVICE_ROLE_KEY=SET
ANTHROPIC_API_KEY=SET
PIPEDRIVE_API_TOKEN=SET
NEXT_PUBLIC_PIPEDRIVE_COMPANY_DOMAIN=manageai
NEXT_PUBLIC_APP_URL=SET

# Need to add
RESEND_API_KEY          # Email goes live instantly
SLACK_BOT_TOKEN         # Slack agent actions go live
```

---

## REPOSITORY STRUCTURE

```
manageai2026/
  apps/web/                           # THE ONLY PROJECT — not connect-hub, not manageai (V1)
    src/
      app/
        api/
          agent/chat/                 # ⛔ DO NOT TOUCH — agentic loop
          analyze-ticket/             # ⛔ DO NOT TOUCH — AI analysis
          generate-build/             # ⚠️ Only touch platform branches
          pipedrive/                  # deals, pipeline (+ deals/[id] coming)
          templates/                  # route, counts, [id]
          deploy/                     # route, config
          tickets/[id]/               # approve, status
          opportunity/                # 🆕 PLANNED — assessment generator
          blueprint/                  # 🆕 PLANNED — AI Blueprint generator
        dashboard/
          ceo/                        # Dave's dashboard
          sales/                      # Tony's dashboard
          marketing/                  # Robert's dashboard
          product/                    # Chad's dashboard
          engineering/                # Brian + Jacob's dashboard
          delivery/                   # Dan's dashboard ← needs major enrichment
          customers/                  # 🆕 WORKSTREAM A — not built yet
          tickets/                    # Ticket list + detail
          templates/                  # Template browser
          build-team/                 # Build queue view
          deploy/                     # Deployment management
          analytics/                  # Platform analytics
          settings/deploy/            # Deploy config
          client-portal/              # 🆕 PLANNED — client-facing view
        portal/
          new-ticket/                 # Ticket wizard
        share/[ticketId]/             # Public share links
        login/
      components/
        layout/
          Sidebar.tsx                 # ⚠️ COORDINATE — only one instance edits at a time
          TopBar.tsx
        agents/
          AgentButton.tsx
          AgentChat.tsx
        ui/                           # shadcn/ui
      lib/
        agents/
          configs/index.ts            # All 5 agent definitions
          tools/                      # Tool implementations
        integrations/
          pipedrive.ts                # LIVE
          slack.ts                    # 🆕 WORKSTREAM C
          resend.ts                   # 🆕 PLANNED
          calendar.ts                 # 🆕 PLANNED
        platforms/
          make/                       # Make.com builder
          zapier/                     # Zapier builder
        deploy/
          n8n-deployer.ts
          make-deployer.ts
          zapier-deployer.ts
        monitoring/                   # 🆕 PLANNED — deployed automation health checks
        reporting/                    # 🆕 PLANNED — client performance reports
      contexts/
        AuthContext.tsx
        OrgContext.tsx
      types/
    scripts/
      seed-make-templates.ts
      seed-zapier-templates.ts
      ingest-templates.ts
    .env.local                        # ⛔ NEVER COMMIT
    CLAUDE.md                         # This file
```

---

## DATABASE SCHEMA

### Existing Tables (All have RLS)
- **tickets** — id, org_id, company_name, contact_name, contact_email, project_name, ticket_type, status, priority, what_to_build, expected_outcome, ai_summary, ai_questions (JSONB), ai_understanding, notes, created_by, created_at
- **ticket_assets** — uploads, transcripts, links per ticket
- **ticket_artifacts** — build_plan, solution_demo, workflow_json, ai_analysis per ticket
- **templates** — 8,076 rows, platform (n8n|make|zapier), workflow_json (JSONB)
- **deployments** — deployment records with status + platform URLs
- **ticket_approvals** — approval workflow records
- **organizations** — multi-tenant orgs (settings JSONB has deploy configs)
- **org_members** — user-to-org with role + department
- **activity_events** — agent action log + inter-agent communication bus
- **agent_conversations** — conversation history per agent per user
- **agent_tool_logs** — every tool execution logged

### Planned New Tables
```sql
-- Client accounts (one per ManageAI client)
client_accounts (
  id UUID PK,
  org_id UUID FK,           -- Links to our org
  company_name TEXT,
  pipedrive_deal_id INTEGER, -- Links to Pipedrive
  status TEXT,              -- prospect|active|at_risk|churned
  plan TEXT,                -- strategy|build|management|enterprise
  health_score INTEGER,     -- 0-100, auto-calculated
  assigned_to UUID,         -- Dan's user_id (delivery owner)
  created_at TIMESTAMPTZ
)

-- Deployed automations per client
client_automations (
  id UUID PK,
  client_id UUID FK,
  ticket_id UUID FK,
  platform TEXT,            -- n8n|make|zapier
  external_id TEXT,         -- ID in their platform
  external_url TEXT,
  status TEXT,              -- active|paused|error|unknown
  last_checked TIMESTAMPTZ,
  last_run TIMESTAMPTZ,
  run_count INTEGER,
  error_count INTEGER,
  health TEXT               -- healthy|degraded|failing
)

-- Performance reports
client_reports (
  id UUID PK,
  client_id UUID FK,
  report_type TEXT,         -- monthly|quarterly|incident
  period_start DATE,
  period_end DATE,
  content TEXT,             -- HTML report content
  metrics JSONB,            -- automation stats, ROI estimates
  sent_at TIMESTAMPTZ,
  created_by TEXT           -- 'agent' or user_id
)

-- AI teammate deployments
teammate_deployments (
  id UUID PK,
  client_id UUID FK,
  teammate TEXT,            -- rebecka|daniel|sarah|andrew
  status TEXT,              -- active|paused|configuring
  config JSONB,             -- system prompt overrides, tool access
  deployed_at TIMESTAMPTZ,
  last_active TIMESTAMPTZ
)

-- Opportunity assessments
opportunity_assessments (
  id UUID PK,
  pipedrive_deal_id INTEGER,
  company_name TEXT,
  contact_name TEXT,
  transcript TEXT,          -- call transcript or notes
  assessment JSONB,         -- AI-generated assessment
  roi_estimate JSONB,       -- per automation ROI breakdown
  recommended_automations JSONB,
  status TEXT,              -- draft|sent|converted
  created_at TIMESTAMPTZ
)
```

---

## TICKET STATUS STATE MACHINE
```
SUBMITTED → ANALYZING → QUESTIONS_PENDING → BUILDING → REVIEW_PENDING → APPROVED → DEPLOYED → CLOSED
```

---

## SIDEBAR NAVIGATION (Current + Planned)

```
MAIN
  Dashboard         → /dashboard
  New Ticket        → /portal/new-ticket

OPERATIONS
  Tickets           → /dashboard/tickets
  Templates         → /dashboard/templates
  Delivery          → /dashboard/delivery       ← Dan owns this
  Build Team        → /dashboard/build-team     ← Brian owns this
  Deploy            → /dashboard/deploy
  Analytics         → /dashboard/analytics

CLIENTS                                          ← 🆕 NEW SECTION
  Customers         → /dashboard/customers      ← WORKSTREAM A
  Opportunities     → /dashboard/opportunities  ← PLANNED (Tony)

DEPARTMENTS
  CEO               → /dashboard/ceo            ← Dave
  Sales             → /dashboard/sales          ← Tony
  Marketing         → /dashboard/marketing      ← Robert
  Product           → /dashboard/product        ← Chad
  Engineering       → /dashboard/engineering    ← Brian + Jacob

SYSTEM
  Settings          → /settings
```

---

## PARALLEL WORKSTREAMS — 6 CLAUDE CODE INSTANCES

### How to Launch
```bash
# Each terminal — run separately:
cd ~/manageai2026 && claude --dangerously-skip-permissions
# Tell each: "Read CLAUDE.md, execute Workstream [X] only"
```

### File Ownership

| Instance | Workstream | Owns | Coordinate On |
|----------|-----------|------|---------------|
| 1 | **A — Customers** | `dashboard/customers/`, `api/pipedrive/deals/[id]/`, `api/pipedrive/persons/[id]/`, `api/pipedrive/organizations/[id]/`, `lib/integrations/pipedrive.ts` | Sidebar.tsx (it owns this edit) |
| 2 | **B — PDF + Approvals** | `api/analyze-ticket/route.ts`, `dashboard/tickets/[id]/page.tsx` | Nothing shared |
| 3 | **C — Slack** | `lib/integrations/slack.ts` (new), `lib/agents/tools/communication.ts` | Nothing shared |
| 4 | **D — Delivery Dashboard** | `dashboard/delivery/` only | Nothing shared |
| 5 | **E — Engineering Dashboard** | `dashboard/engineering/` only | Nothing shared |
| 6 | **F — Agent Write Actions** | `lib/agents/tools/platform-tickets.ts`, `lib/agents/tools/pipedrive-tools.ts`, `lib/agents/configs/index.ts` | Nothing shared |

### Sidebar Rule
**Only Workstream A touches Sidebar.tsx this session.** All others wait.

### Commit Order
Each workstream: `git add -A && git commit -m "workstream-X: description" && git push origin main` before the next session on overlapping files.

---

## WORKSTREAM A — CUSTOMERS & CLIENT MANAGEMENT

**Owner:** Tony (daily user), Dan (delivery view)
**Goal:** Complete client relationship hub. Every Pipedrive deal becomes a full client profile. Tony manages deals, Dan manages delivery, both see the full picture.

### Part 1: Expand Pipedrive Client
File: `lib/integrations/pipedrive.ts` — ADD these functions (do not remove existing):
```
getPerson(personId)              → GET /persons/{id}
getPersonsByDeal(dealId)         → GET /deals/{id}/participants
getOrganization(orgId)           → GET /organizations/{id}
getOrgPersons(orgId)             → GET /organizations/{id}/persons
getDealActivities(dealId)        → GET /activities?deal_id={id}
getDealNotes(dealId)             → GET /notes?deal_id={id}
getDealFiles(dealId)             → GET /files?deal_id={id}
getDealFlow(dealId)              → GET /deals/{id}/flow
getDealProducts(dealId)          → GET /deals/{id}/products
getDealMailMessages(dealId)      → GET /deals/{id}/mailMessages
```
All must: use `https://api.pipedrive.com/v1`, include `?api_token=`, have try/catch, fall back to demo data if token missing.

### Part 2: New API Routes
- `api/pipedrive/deals/[id]/route.ts` — parallel fetch: deal + persons + activities + notes + files + flow + org + person
- `api/pipedrive/persons/[id]/route.ts` — person + activities + deals
- `api/pipedrive/organizations/[id]/route.ts` — org + persons + deals

### Part 3: Customer List Page
File: `dashboard/customers/page.tsx`
- Table: Company | Contact | Value | Stage | Owner | Age | Last Activity
- Search bar (filter by company/contact)
- Stage filter dropdown
- Click row → `/dashboard/customers/[dealId]`
- Sort by value, age, last activity
- Data from `/api/pipedrive/deals`

### Part 4: Customer Detail Page
File: `dashboard/customers/[id]/page.tsx`

Layout:
```
Header: ← Back | Company Name | Agent Chat button
Row 1: Deal Card (stage, value, owner, age) | Contact Card (name, email, phone)
Row 2: Organization (industry, revenue, employees, custom fields)
Tabs: Activity | Notes | Emails | Files | History | ManageAI Builds
```

Custom fields to display: Vertical, Lead List, Lead Stage, Seniority, State, AI Readiness Score, Software Tools, LLM Usage, Apollo/Clay Organization

ManageAI Builds tab:
- Query: `SELECT * FROM tickets WHERE company_name ILIKE '%{orgName}%' OR contact_email = '{email}'`
- Show ticket status, platform, deliverables, deploy status
- "Create New Ticket" button pre-filled with customer data from Pipedrive
- Link each ticket to `/dashboard/tickets/[id]`

Agent chat: include deal context in system message — "You are viewing the deal for [Company] (Deal #[id]) with contact [Person]. You have access to their full Pipedrive profile."

### Part 5: Navigation
- Add "Customers" to Sidebar under new CLIENTS section (Users icon, `/dashboard/customers`)
- Add "View Profile →" link on each deal card in Sales dashboard

### Verification
```bash
npm run build
curl "http://localhost:3001/api/pipedrive/deals/[real-deal-id]"
# All existing routes still 200
```

---

## WORKSTREAM B — PDF EXTRACTION + TICKET APPROVALS

**Owner:** Brian (build quality), Dan (delivery review)
**Goal:** Fix the two highest-priority gaps from the audit.

### Part 1: PDF Text Extraction
File: `app/api/analyze-ticket/route.ts`

```bash
npm install pdf-parse @types/pdf-parse
```

In `extractFileText()`, add PDF branch:
```typescript
if (mimeType === 'application/pdf') {
  const pdfParse = (await import('pdf-parse')).default;
  const result = await pdfParse(buffer);
  return result.text;
}
```

Test: upload a real PDF SOW to a ticket, confirm text appears in AI analysis output.

### Part 2: Ticket Approve/Reject UI
File: `app/dashboard/tickets/[id]/page.tsx`

When `ticket.status === 'REVIEW_PENDING'`, render:
```
[✓ Approve Build]  [↩ Request Revision]
```
- Approve → `POST /api/tickets/[id]/approve` with `{ action: 'approve' }`
- Request Revision → show comment textarea → `POST` with `{ action: 'revision', comment }`
- Optimistic UI update after response
- Only visible when status is REVIEW_PENDING
- Style: Approve = green, Revision = yellow, consistent with existing card styling

---

## WORKSTREAM C — SLACK INTEGRATION

**Owner:** All agents (post to channels), Robert (marketing alerts)
**Goal:** Replace mock with real Slack API so agents can actually post.

### New File: `lib/integrations/slack.ts`
```typescript
const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;
const BASE = 'https://slack.com/api';

export async function sendMessage(channel: string, text: string, blocks?: any[])
export async function createChannel(name: string)
export async function listChannels()
export async function uploadFile(channel: string, content: string, filename: string)
export function isConfigured(): boolean
```

All use `Authorization: Bearer ${SLACK_TOKEN}`. Fall back gracefully if token missing (match Pipedrive pattern — log `[DEMO MODE]`, return mock success).

### Update `lib/agents/tools/communication.ts`
Replace mock `sendSlackMessage` body to call `sendMessage()` from the new Slack client.

### Channels to Support (hardcode as constants)
```typescript
export const CHANNELS = {
  BUILDS: '#builds',        // Brian + Jacob
  SALES: '#sales',          // Tony
  ALERTS: '#alerts',        // Everyone
  GENERAL: '#general',
  LEADERSHIP: '#leadership' // Dave + Chad
}
```

---

## WORKSTREAM D — DELIVERY DASHBOARD ENRICHMENT

**Owner:** Dan
**Goal:** Make `/dashboard/delivery` Dan's primary work surface for managing all active client projects.

File: `app/dashboard/delivery/page.tsx` (read first — understand what's there)

Add or enrich:
- **Client Health Overview** — cards showing each active client: name, active builds, last activity, health indicator (green/yellow/red)
- **Build Status by Client** — group tickets by company_name, show stage progress
- **Deployment Health** — query `deployments` table, show success/failed/pending counts
- **Upcoming Reviews** — placeholder cards for scheduled client reviews (manual entry for now)
- **Overdue Builds** — tickets in BUILDING status > 5 days, flagged red
- **Recently Deployed** — last 10 deployments with client name, platform, deploy date
- Dan's Delivery Agent button must be present and wired to `agentConfigs.delivery` (check if it exists — if not, it's in scope to add to configs)

---

## WORKSTREAM E — ENGINEERING DASHBOARD ENRICHMENT

**Owner:** Brian + Jacob
**Goal:** Make `/dashboard/engineering` the build team's command center.

File: `app/dashboard/engineering/page.tsx` (read first)

Add or enrich:
- **Build Queue** — tickets in SUBMITTED/ANALYZING/BUILDING status, sorted by priority, with age and platform badges
- **Template Match Rate** — what % of recent tickets matched a template (query ticket_artifacts metadata)
- **Artifact Quality** — recent build plan + solution demo previews with direct links
- **Deploy Success Rate** — from deployments table: success vs failed last 30 days
- **Platform Breakdown** — pie or bar chart: n8n vs Make.com vs Zapier ticket distribution
- **Quick Actions** — "View Build Queue", "Trigger Rebuild", "Open Templates" buttons
- Brian's Engineering Agent button must be present and wired

---

## WORKSTREAM F — AGENT WRITE ACTIONS

**Owner:** Brian (agent framework)
**Goal:** Give agents the ability to take real write actions, not just read.

### `lib/agents/tools/platform-tickets.ts` — ADD:
```typescript
updateTicketStatus(ticketId, newStatus, comment?)
// POST /api/tickets/[id]/status
// Agents can move tickets: BUILDING→REVIEW_PENDING, APPROVED→DEPLOYED etc.

assignTicket(ticketId, assigneeName)
// Updates tickets.notes with assignment note + fires activity_event
// Engineering/CEO agents can reassign work

createTicketFromDeal(dealData)
// Creates a new ticket pre-filled with Pipedrive deal data
// Sales agent can trigger this when a deal closes
```

### `lib/agents/tools/pipedrive-tools.ts` — ADD:
```typescript
createDeal(title, value, personId?, stageId?)
// POST /api/v1/deals — Sales agent creates deals

createPerson(name, email, phone?, orgId?)
// POST /api/v1/persons — Sales agent adds contacts

updateDealStage(dealId, stageId)
// PATCH /api/v1/deals/{id} — move deal through pipeline
```

### `lib/agents/configs/index.ts` — Update tool lists:
- Add `updateTicketStatus` and `assignTicket` to Engineering AI + CEO tools
- Add `createDeal`, `createPerson`, `updateDealStage` to Sales AI tools
- Add `createTicketFromDeal` to Sales AI tools

---

## PLANNED FEATURES — FUTURE WORKSTREAMS

### Opportunity Assessment Generator
**Who:** Tony uses in sales calls
**What:** Tony pastes a call transcript or fills a form → Claude generates a full opportunity assessment doc with recommended automations, ROI estimates, implementation timeline → professional PDF → Tony sends to prospect
```
Route: /dashboard/opportunities/new
API: /api/opportunity/assess
Output: HTML doc + PDF download, saves to opportunity_assessments table
```

### AI Blueprint Generator
**Who:** Tony closes deal → hands to Brian + Dan
**What:** Opportunity assessment → full AI Blueprint document (strategy, architecture, 90-day roadmap, automation specs) → client-ready presentation
```
Route: /dashboard/opportunities/[id]/blueprint
API: /api/blueprint/generate
```

### Deployed Automation Monitor
**Who:** Dan (daily monitoring)
**What:** Query deployed n8n/Make.com instances for automation health, run counts, error counts. Dan's agent alerts when something fails.
```
New table: client_automations
API: /api/monitoring/check-all (cron job)
Dashboard: /dashboard/delivery shows health per client
```

### Client Performance Reports
**Who:** Dan generates, client receives
**What:** Monthly auto-generated report per client: automations running, tasks processed, time saved, ROI estimate, recommendations
```
New table: client_reports
API: /api/reports/generate
Agent: Dan's Delivery Agent can trigger "generate monthly report for [client]"
```

### AI Teammate Management
**Who:** Brian deploys, Dan manages
**What:** Track which clients have Rebecka/Daniel/Sarah/Andrew deployed, their config, their usage
```
New table: teammate_deployments
Dashboard: client detail page shows active teammates
```

### Client Portal
**Who:** ManageAI clients (separate login)
**What:** Clients see their deployed automations, request new builds, view performance reports, communicate with Dan
```
Route: /client-portal/[clientSlug]/
Separate auth flow, read-only Supabase access
```

### Marketing Content Pipeline
**Who:** Robert
**What:** When a build is completed and deployed, Marketing Agent auto-drafts a case study, social posts, and adds to content calendar
```
Trigger: ticket status → CLOSED
Agent: Marketing AI auto-drafts content
Dashboard: /dashboard/marketing shows content calendar
```

---

## STYLING CONVENTIONS
- Font: DM Sans (Google Fonts)
- Primary accent: `#4A8FD6` blue
- Component library: shadcn/ui + Tailwind CSS v4
- Icons: lucide-react
- Toasts: sonner
- Charts: recharts
- Sidebar: white, blue active state, collapsible to 64px icon-only

---

## GIT WORKFLOW
```bash
cd ~/manageai2026
git add -A
git commit -m "workstream-X: description"
git push origin main
# Vercel auto-deploys → https://web-manage-ai1.vercel.app
```

---

## ABSOLUTE RULES FOR ALL INSTANCES

1. `cd ~/manageai2026/apps/web` first — you are NEVER in `~/manageai` (V1) or `connect-hub`
2. **Read before writing** — cat every file you plan to touch
3. **`npm run build` before stopping** — zero TypeScript errors
4. **Never touch** `app/api/agent/chat/route.ts` unless your workstream says so
5. **Never touch** `app/api/analyze-ticket/route.ts` unless Workstream B
6. **Never touch** n8n paths in `generate-build`
7. **Sidebar.tsx = Workstream A only** this session
8. **Never commit .env.local**
9. **Demo/fallback mode** on all external integrations — check `isConfigured()` pattern in pipedrive.ts
10. **Push when done** — don't leave uncommitted work
11. **Match existing patterns** — read how existing features work before building new ones
12. **The platform serves the ManageAI team** — every feature should make Dave, Chad, Brian, Dan, Tony, Robert, or Jacob's job faster and more powerful
