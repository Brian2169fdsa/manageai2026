# ManageAI 2026 — Claude Code Instructions

## PRIORITY: Ship before 2pm. Login → Sidebar → Ticket Wizard → AI Builder → Dashboard.

## Repo Structure
```
manageai2026/
└── apps/
    └── web/                    # Next.js 16.1.6 (App Router)
        ├── src/app/            # Pages live here
        ├── package.json
        └── next.config.ts
```
All work happens in `apps/web/`. This is Next.js 16 with React 19, Tailwind v4, TypeScript 5, Geist fonts.

## Tech Stack
- Next.js 16 App Router (NO pages router, NO react-router-dom)
- React 19
- Tailwind CSS v4
- Supabase (Auth + Postgres + Storage + Edge Functions)
- shadcn/ui for components (install with: `npx shadcn@latest init` then `npx shadcn@latest add [component]`)
- Zod for validation
- Lucide React for icons
- Sonner for toasts

## Install These First
```bash
cd apps/web
npm install @supabase/supabase-js zod sonner lucide-react
npx shadcn@latest init
npx shadcn@latest add button input dialog card tabs badge textarea select progress
```

## Environment Variables (create apps/web/.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=<brian-will-provide>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<brian-will-provide>
SUPABASE_SERVICE_ROLE_KEY=<brian-will-provide>
ANTHROPIC_API_KEY=<brian-will-provide>
```

---

## APP STRUCTURE TO BUILD

```
apps/web/src/
├── app/
│   ├── layout.tsx              # Root layout with AuthProvider + sidebar
│   ├── page.tsx                # Redirect: if logged in → /dashboard, else → /login
│   ├── login/
│   │   └── page.tsx            # Login/signup page (split panel design)
│   ├── reset-password/
│   │   └── page.tsx            # Password reset
│   ├── portal/
│   │   ├── layout.tsx          # Portal layout (sidebar + topbar)
│   │   ├── new-ticket/
│   │   │   └── page.tsx        # 3-step ticket intake wizard
│   │   └── ticket/
│   │       └── [id]/
│   │           └── page.tsx    # AI review + outputs for a ticket
│   └── dashboard/
│       ├── layout.tsx          # Dashboard layout (same sidebar)
│       ├── page.tsx            # Overview / home
│       └── tickets/
│           ├── page.tsx        # Ticket list with customer cards
│           └── [id]/
│               └── page.tsx    # Ticket detail + artifacts view
├── components/
│   ├── ui/                     # shadcn/ui (auto-generated)
│   ├── layout/
│   │   ├── Sidebar.tsx         # Left sidebar navigation
│   │   └── TopBar.tsx          # Top bar with user menu
│   ├── auth/
│   │   ├── LoginCard.tsx       # Login form (OAuth + email/password)
│   │   ├── OAuthButton.tsx     # OAuth provider button
│   │   ├── ForgotPasswordModal.tsx
│   │   └── icons/              # Google, Apple, Microsoft SVGs
│   ├── portal/
│   │   ├── TicketWizardStep1.tsx  # Company + build type form
│   │   ├── TicketWizardStep2.tsx  # File upload + vault
│   │   └── TicketWizardStep3.tsx  # AI review + Q&A + outputs
│   └── dashboard/
│       ├── TicketList.tsx
│       └── CustomerCard.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Browser Supabase client
│   │   └── server.ts           # Server-side Supabase client
│   └── utils.ts                # cn() helper for tailwind merge
├── contexts/
│   └── AuthContext.tsx          # Auth state provider
└── types/
    └── index.ts                # Shared TypeScript types
```

---

## BUILD ORDER (Do these in sequence)

### PHASE 1: Foundation (30 min)
1. Install dependencies (shadcn, supabase, zod, sonner, lucide)
2. Create `lib/supabase/client.ts` (browser client)
3. Create `lib/supabase/server.ts` (server client using cookies)
4. Create `contexts/AuthContext.tsx` (adapted from spec below)
5. Create `types/index.ts` with all type definitions
6. Update root `layout.tsx` to wrap with AuthProvider + Sonner Toaster

### PHASE 2: Login Page (30 min)
7. Create `login/page.tsx` — split panel: left = brand + tagline, right = login card
8. Create `LoginCard.tsx` — OAuth buttons (Google/Apple/Microsoft) + email/password + signup toggle
9. Create `OAuthButton.tsx`, icon components, `ForgotPasswordModal.tsx`
10. Create `reset-password/page.tsx`
11. Root `page.tsx` — redirect logic (logged in → /dashboard, else → /login)

### PHASE 3: Sidebar Layout (20 min)
12. Create `Sidebar.tsx` — left nav with:
    - MANAGE AI logo at top
    - Nav items: Dashboard, New Ticket, Tickets, Settings
    - User avatar + sign out at bottom
    - Collapsed/expanded toggle
13. Create `TopBar.tsx` — breadcrumb + user menu
14. Create `portal/layout.tsx` and `dashboard/layout.tsx` using sidebar

### PHASE 4: Ticket Wizard (45 min)
15. Create `portal/new-ticket/page.tsx` — 3-step wizard container with progress bar
16. **Step 1 (TicketWizardStep1.tsx):**
    - Company Name, Contact Name, Contact Email
    - Project Name, Description
    - **Build Type** — big card selector: n8n | Make.com | Zapier
    - What needs to be built (textarea)
    - Expected outcome (textarea)
    - Priority selector
17. **Step 2 (TicketWizardStep2.tsx):**
    - Drag-and-drop file upload zone (PDF, DOCX, TXT, CSV, PNG, JPG)
    - File list with type badges (auto-categorize: sow, specs, screenshots, data)
    - Paste transcript textarea
    - Link URL input
    - "Knowledge Vault" section with "Coming Soon" badge
18. **Step 3 (TicketWizardStep3.tsx):**
    - Loading state: "AI is analyzing your project..."
    - AI Overview section (summary of understanding)
    - Questions section (AI asks clarifying questions, user answers inline)
    - "Submit Answers" button → AI re-analyzes
    - Deliverables section (appears after AI builds):
      - Build Plan card [View] [Download]
      - Solution Demo card [View] [Download]  
      - Workflow JSON card [Download]

### PHASE 5: AI Integration (30 min)
19. Create API route `app/api/analyze-ticket/route.ts`:
    - Accepts ticket_id
    - Fetches ticket + assets from Supabase
    - Calls Claude API with system prompt (see below)
    - Returns {summary, questions, ready_to_build}
    - Updates ticket in DB
20. Create API route `app/api/generate-build/route.ts`:
    - Accepts ticket_id (must be in BUILDING status)
    - Calls Claude to generate build plan, solution demo, workflow JSON
    - Saves artifacts to Supabase Storage
    - Creates artifact records in DB
    - Updates ticket status to REVIEW_PENDING

### PHASE 6: Dashboard (30 min)
21. Create `dashboard/page.tsx` — overview with ticket counts by status
22. Create `dashboard/tickets/page.tsx` — ticket list table
23. Create `dashboard/tickets/[id]/page.tsx` — customer card + artifact viewer
24. Customer card shows: company info, status badge, all artifacts with view/download

### PHASE 7: Deploy (10 min)
25. Push to Git, deploy on Vercel
26. Set environment variables in Vercel dashboard
27. Test full flow end-to-end

---

## DATABASE TABLES (Run in Supabase SQL Editor)

```sql
-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  company_domain TEXT,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  project_name TEXT,
  description TEXT,
  ticket_type TEXT NOT NULL DEFAULT 'n8n' CHECK (ticket_type IN ('n8n', 'make', 'zapier')),
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN (
    'SUBMITTED','CONTEXT_PENDING','ANALYZING','QUESTIONS_PENDING',
    'BUILDING','REVIEW_PENDING','APPROVED','DEPLOYED','CLOSED'
  )),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  what_to_build TEXT,
  expected_outcome TEXT,
  trigger_event TEXT,
  systems_involved TEXT[],
  constraints TEXT,
  ai_summary TEXT,
  ai_questions JSONB DEFAULT '[]'::jsonb,
  ai_understanding TEXT,
  ready_to_build BOOLEAN DEFAULT false,
  recommended_platform TEXT,
  complexity_estimate TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ticket assets (uploaded files)
CREATE TABLE IF NOT EXISTS ticket_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL DEFAULT 'file' CHECK (asset_type IN ('file','transcript','vault_ref','link')),
  file_name TEXT,
  file_path TEXT,
  external_url TEXT,
  mime_type TEXT,
  file_size INTEGER,
  category TEXT DEFAULT 'other' CHECK (category IN ('sow','specs','screenshots','data','transcript','other')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ticket artifacts (AI-generated outputs)
CREATE TABLE IF NOT EXISTS ticket_artifacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('build_plan','solution_demo','workflow_json','ai_analysis')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create storage bucket for ticket files
INSERT INTO storage.buckets (id, name, public) VALUES ('ticket-files', 'ticket-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies (permissive for MVP — tighten later)
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON tickets FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all for authenticated users" ON ticket_assets FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all for authenticated users" ON ticket_artifacts FOR ALL USING (auth.uid() IS NOT NULL);

-- Storage policy
CREATE POLICY "Allow authenticated uploads" ON storage.objects FOR ALL USING (auth.uid() IS NOT NULL AND bucket_id = 'ticket-files');
```

---

## LOGIN PAGE DESIGN SPEC

Split-panel layout:
- **Left panel** (desktop only): Dark/light background, large "MANAGE AI" logo, tagline: "AI Isn't the Future. It's How Your Team Wins Right Now."
- **Right panel**: Centered login card with:
  - Title: "Sign in to Manage AI"  
  - OAuth buttons: Google, Apple, Microsoft (stacked, full-width, outlined)
  - Divider: "or"
  - Email input + Password input
  - "Forgot your password?" link → modal
  - "Sign in" button (blue, full-width)
  - Toggle: "Don't have an account? Sign up"
  - Footer: Terms + Privacy links

Font: Inter (or keep Geist since it's already configured — either is fine)
Colors: Use the CSS variables from the existing globals.css. Primary blue = hsl(214 84% 56%)

### Auth Context Pattern (adapt for Next.js)
```typescript
// contexts/AuthContext.tsx
'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

// ... standard Supabase auth pattern with onAuthStateChange listener
```

### Supabase Client (browser)
```typescript
// lib/supabase/client.ts
'use client';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

---

## TICKET WIZARD — EXACT FLOW

### Step 1: Company & Project Info
```
┌──────────────────────────────────────────┐
│  New Build Request              Step 1/3 │
│  ─────────────────────────────────────── │
│  Company Name: [___________________]     │
│  Contact Name: [___________________]     │
│  Contact Email: [__________________]     │
│  Project Name: [___________________]     │
│                                          │
│  Build Platform:                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  ⚙️ n8n  │ │ 🔧 Make │ │ ⚡ Zap  │   │
│  │ (selected)│ │         │ │         │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│                                          │
│  What needs to be built:                 │
│  [________________________________]      │
│  [________________________________]      │
│                                          │
│  Expected outcome:                       │
│  [________________________________]      │
│                                          │
│  Priority: [Medium ▾]                    │
│                                 [Next →] │
└──────────────────────────────────────────┘
```

### Step 2: Upload Context
```
┌──────────────────────────────────────────┐
│  Upload Documents               Step 2/3 │
│  ─────────────────────────────────────── │
│  ┌──────────────────────────────────┐   │
│  │  📁 Drag & drop files here       │   │
│  │  PDF, DOCX, TXT, CSV, images     │   │
│  │  ─────────────────────────────── │   │
│  │  📄 opportunity_assessment.pdf    │   │
│  │  📄 call_transcript.txt      ✕   │   │
│  └──────────────────────────────────┘   │
│                                          │
│  📝 Paste transcript:                    │
│  [________________________________]      │
│                                          │
│  🔗 Add link: [________________] [Add]   │
│                                          │
│  🗄️ Knowledge Vault  [Coming Soon]       │
│                                          │
│                        [← Back] [Next →] │
└──────────────────────────────────────────┘
```

### Step 3: AI Review + Outputs
```
┌──────────────────────────────────────────┐
│  AI Analysis                    Step 3/3 │
│  ─────────────────────────────────────── │
│                                          │
│  ✅ "Thank you for the information."     │
│  ┌──────────────────────────────────┐   │
│  │ I understand you need a workflow  │   │
│  │ that triggers when [X] and...     │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ❓ Questions:                            │
│  1. What format does the data...?        │
│     [________________________] ✓         │
│  2. Is there an approval step...?        │
│     [________________________]           │
│                     [Submit Answers]      │
│                                          │
│  📦 Deliverables:                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │Build Plan│ │Solution  │ │Workflow  ││
│  │  📄 View │ │Demo 🎬   │ │JSON ⚙️   ││
│  └──────────┘ └──────────┘ └──────────┘│
│                                          │
│              [← Back] [Go to Dashboard]  │
└──────────────────────────────────────────┘
```

---

## AI SYSTEM PROMPTS

### Analysis Prompt (for /api/analyze-ticket)
```
You are an expert AI automation architect at ManageAI. You specialize in building 
n8n, Make.com, and Zapier workflows for businesses.

A client has submitted a build request. Analyze all provided information and:

1. Provide a clear summary of what they need automated
2. Show your understanding of the trigger, data flow, and systems involved
3. Ask specific clarifying questions if anything is unclear (max 5-8 questions)
4. Assess complexity and recommend the best platform

Respond ONLY with valid JSON:
{
  "summary": "2-3 sentence overview",
  "understanding": "Detailed paragraph of what you believe they need",
  "questions": [
    {"id": "q1", "question": "...", "category": "technical"},
    {"id": "q2", "question": "...", "category": "business"}
  ],
  "ready_to_build": false,
  "recommended_platform": "n8n",
  "complexity_estimate": "moderate",
  "risk_flags": ["needs OAuth setup for Gmail", "rate limiting on API"]
}
```

### Build Plan Prompt (for /api/generate-build)
```
You are a senior automation engineer writing a comprehensive build manual.
Generate a COMPLETE, DETAILED build plan that anyone could follow to build 
this system end-to-end. Include:

- Executive Summary
- System Architecture (describe the data flow)
- Every scenario/workflow with step-by-step instructions
- Required accounts, connections, and credentials
- Module-by-module configuration
- Testing plan with test cases
- Deployment and monitoring instructions
- Troubleshooting guide

Output as clean HTML with inline styles. Use a professional design:
- Font: DM Sans or system sans-serif
- Color scheme: blue (#4A8FD6) accent, dark text (#1A1A2E), light backgrounds (#F8F9FB)
- Sections with clear headers
- Code blocks for any JSON/config
- Tables for structured data
Make it look polished enough to send directly to a client.
```

### Solution Demo Prompt
```
Generate an interactive HTML solution demo as a SINGLE FILE React app.
Use React 18 via CDN (react.production.min.js + react-dom.production.min.js).
Include:
- Tab navigation: Overview | The Challenge | How It Works | Live Demo | ROI | Technology | Next Steps
- Overview: what the solution does
- The Challenge: the business problem
- How It Works: visual flow of the automation with animated steps
- Live Demo: simulated data showing inputs → processing → outputs
  - If the output is an email, show a simulated email
  - If the output is a Slack message, show a simulated Slack interface
  - If the output is a database update, show before/after
- ROI: time saved, cost reduction, efficiency gains with animated counters
- Technology: stack overview with account requirements
- Next Steps: implementation timeline

Design: DM Sans font, #4A8FD6 blue accent, clean white backgrounds, 
subtle animations (slideIn, fadeIn), professional and polished.
All CSS must be inline or in a <style> tag. Single HTML file, no external dependencies except React CDN.
```

---

## SIDEBAR DESIGN

```
┌──────────────┐
│ MANAGE AI    │  ← Logo
│──────────────│
│ 📊 Dashboard │  ← /dashboard
│ ➕ New Ticket │  ← /portal/new-ticket
│ 📋 Tickets   │  ← /dashboard/tickets
│ ⚙️ Settings  │  ← /settings (placeholder)
│              │
│              │
│              │
│──────────────│
│ 👤 Brian R.  │  ← User + sign out
│ Sign out     │
└──────────────┘
```

Width: 240px expanded, 64px collapsed. Dark sidebar (#1A1A2E) with white text.
Active item: blue highlight background.

---

## CRITICAL RULES
1. Every page that needs auth must check — redirect to /login if not authenticated
2. Use 'use client' directive on components that use hooks, state, or browser APIs
3. Server components for layouts and data fetching where possible
4. File uploads go to Supabase Storage bucket 'ticket-files'
5. AI API calls MUST happen server-side (API routes) — never expose ANTHROPIC_API_KEY to client
6. Show loading spinners during AI operations (they take 10-30 seconds)
7. Use shadcn/ui components — do NOT install Material UI, Chakra, or other UI libraries
8. All forms use controlled components with Zod validation
9. Toast notifications via Sonner for success/error states
10. Mobile responsive — sidebar collapses to hamburger on small screens

## SKIP FOR TODAY (do NOT build these)
- Multi-tenant / organization isolation
- Knowledge vault integration
- Make.com or Zapier output (n8n only for now)
- Agent-to-agent handoffs
- Realtime subscriptions
- Email notifications
- Support ticket path (only the intake wizard path)
- n8n-MCP integration (generate reasonable JSON, wire MCP later)
