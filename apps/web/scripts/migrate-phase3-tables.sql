-- ManageAI Phase 3-4 Database Migration
-- Run in Supabase SQL Editor
-- All tables use CREATE IF NOT EXISTS for idempotency
-- Last updated: 2026-03-04

-- ── Scheduled Job Runs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduled_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  department TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',      -- running | completed | failed
  output TEXT,
  error TEXT
);

-- ── Client Accounts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,
  company_name TEXT NOT NULL,
  pipedrive_deal_id INTEGER,
  status TEXT DEFAULT 'active',       -- prospect | active | at_risk | churned
  plan TEXT,                          -- strategy | build | management | enterprise
  health_score INTEGER DEFAULT 100,   -- 0-100, auto-calculated
  assigned_delivery_owner UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Client Automations ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client_accounts(id) ON DELETE CASCADE,
  ticket_id UUID,
  platform TEXT,                      -- n8n | make | zapier
  external_id TEXT,                   -- ID in their platform
  external_url TEXT,
  status TEXT DEFAULT 'active',       -- active | paused | error | unknown
  last_checked TIMESTAMPTZ,
  last_run TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  health TEXT DEFAULT 'unknown'       -- healthy | degraded | failing
);

-- ── Client Reports ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client_accounts(id) ON DELETE CASCADE,
  report_type TEXT DEFAULT 'monthly', -- monthly | quarterly | incident
  period_start DATE,
  period_end DATE,
  content TEXT,                       -- HTML report content
  metrics JSONB,                      -- automation stats, ROI estimates
  status TEXT DEFAULT 'draft',        -- draft | pending_review | sent
  sent_at TIMESTAMPTZ,
  created_by TEXT DEFAULT 'agent',    -- 'agent' or user_id
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Teammate Deployments ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teammate_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client_accounts(id) ON DELETE CASCADE,
  teammate TEXT NOT NULL,             -- rebecka | daniel | sarah | andrew
  status TEXT DEFAULT 'active',       -- active | paused | configuring
  config JSONB,                       -- system prompt overrides, tool access
  deployed_at TIMESTAMPTZ DEFAULT now(),
  last_active TIMESTAMPTZ
);

-- ── Build Feedback ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS build_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID,
  platform TEXT,
  feedback_type TEXT,                 -- revision_requested | deploy_failed | client_reported
  revision_reason TEXT,
  original_artifacts JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Enable RLS ──────────────────────────────────────────────────────────────
ALTER TABLE scheduled_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE teammate_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_feedback ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies (permissive for authenticated users) ───────────────────────
DO $$ BEGIN
  -- scheduled_job_runs: authenticated users can read/write
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sjr_auth_all') THEN
    CREATE POLICY sjr_auth_all ON scheduled_job_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sjr_service_all') THEN
    CREATE POLICY sjr_service_all ON scheduled_job_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ca_auth_all') THEN
    CREATE POLICY ca_auth_all ON client_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ca_service_all') THEN
    CREATE POLICY ca_service_all ON client_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'caut_auth_all') THEN
    CREATE POLICY caut_auth_all ON client_automations FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'caut_service_all') THEN
    CREATE POLICY caut_service_all ON client_automations FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cr_auth_all') THEN
    CREATE POLICY cr_auth_all ON client_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cr_service_all') THEN
    CREATE POLICY cr_service_all ON client_reports FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'td_auth_all') THEN
    CREATE POLICY td_auth_all ON teammate_deployments FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'td_service_all') THEN
    CREATE POLICY td_service_all ON teammate_deployments FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bf_auth_all') THEN
    CREATE POLICY bf_auth_all ON build_feedback FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bf_service_all') THEN
    CREATE POLICY bf_service_all ON build_feedback FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sjr_job_name ON scheduled_job_runs(job_name);
CREATE INDEX IF NOT EXISTS idx_ca_company ON client_accounts(company_name);
CREATE INDEX IF NOT EXISTS idx_ca_pipedrive ON client_accounts(pipedrive_deal_id);
CREATE INDEX IF NOT EXISTS idx_caut_client ON client_automations(client_id);
CREATE INDEX IF NOT EXISTS idx_caut_external ON client_automations(external_id);
CREATE INDEX IF NOT EXISTS idx_cr_client ON client_reports(client_id);
CREATE INDEX IF NOT EXISTS idx_td_client ON teammate_deployments(client_id);
CREATE INDEX IF NOT EXISTS idx_bf_ticket ON build_feedback(ticket_id);
