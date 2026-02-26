-- ──────────────────────────────────────────────────────────────────────────────
-- ManageAI Platform — New Tables Migration
-- Run this entire file in the Supabase SQL Editor (one shot)
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. client_accounts — one record per ManageAI client (links to Pipedrive deal)
CREATE TABLE IF NOT EXISTS client_accounts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID        REFERENCES organizations(id) ON DELETE SET NULL,
  company_name      TEXT        NOT NULL,
  pipedrive_deal_id INTEGER,
  status            TEXT        NOT NULL DEFAULT 'prospect'
                                CHECK (status IN ('prospect','active','at_risk','churned')),
  plan              TEXT        CHECK (plan IN ('strategy','build','management','enterprise')),
  health_score      INTEGER     DEFAULT 50 CHECK (health_score BETWEEN 0 AND 100),
  assigned_to       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. client_automations — each deployed automation per client
CREATE TABLE IF NOT EXISTS client_automations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID        REFERENCES client_accounts(id) ON DELETE CASCADE,
  ticket_id    UUID        REFERENCES tickets(id) ON DELETE SET NULL,
  platform     TEXT        NOT NULL CHECK (platform IN ('n8n','make','zapier')),
  external_id  TEXT,
  external_url TEXT,
  status       TEXT        NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','paused','error','unknown')),
  last_checked TIMESTAMPTZ,
  last_run     TIMESTAMPTZ,
  run_count    INTEGER     DEFAULT 0,
  error_count  INTEGER     DEFAULT 0,
  health       TEXT        DEFAULT 'healthy'
                           CHECK (health IN ('healthy','degraded','failing')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. client_reports — monthly/quarterly/incident reports
CREATE TABLE IF NOT EXISTS client_reports (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID        REFERENCES client_accounts(id) ON DELETE CASCADE,
  report_type  TEXT        NOT NULL CHECK (report_type IN ('monthly','quarterly','incident')),
  period_start DATE,
  period_end   DATE,
  content      TEXT,
  metrics      JSONB,
  sent_at      TIMESTAMPTZ,
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. teammate_deployments — AI teammate (Rebecka/Daniel/Sarah/Andrew) per client
CREATE TABLE IF NOT EXISTS teammate_deployments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID        REFERENCES client_accounts(id) ON DELETE CASCADE,
  teammate    TEXT        NOT NULL CHECK (teammate IN ('rebecka','daniel','sarah','andrew')),
  status      TEXT        NOT NULL DEFAULT 'configuring'
                          CHECK (status IN ('active','paused','configuring')),
  config      JSONB,
  deployed_at TIMESTAMPTZ,
  last_active TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. scheduled_job_runs — telemetry for Vercel Cron agent jobs
CREATE TABLE IF NOT EXISTS scheduled_job_runs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name     TEXT        NOT NULL,
  department   TEXT,
  status       TEXT        NOT NULL CHECK (status IN ('running','completed','failed')),
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  output       TEXT,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Add blueprint_content column to opportunity_assessments (idempotent)
ALTER TABLE opportunity_assessments
  ADD COLUMN IF NOT EXISTS blueprint_content TEXT;

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Default-deny, then open to authenticated team members.
-- Adjust org_id scoping when multi-tenant isolation is needed.

ALTER TABLE client_accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_automations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE teammate_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_job_runs   ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running (safe to ignore "does not exist" errors)
DROP POLICY IF EXISTS "auth_full_access" ON client_accounts;
DROP POLICY IF EXISTS "auth_full_access" ON client_automations;
DROP POLICY IF EXISTS "auth_full_access" ON client_reports;
DROP POLICY IF EXISTS "auth_full_access" ON teammate_deployments;
DROP POLICY IF EXISTS "auth_full_access" ON scheduled_job_runs;

CREATE POLICY "auth_full_access" ON client_accounts      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON client_automations   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON client_reports       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON teammate_deployments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON scheduled_job_runs   FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Service role bypass (for scheduled jobs / API routes using service key)
DROP POLICY IF EXISTS "service_full_access" ON scheduled_job_runs;
CREATE POLICY "service_full_access" ON scheduled_job_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_client_accounts_status       ON client_accounts(status);
CREATE INDEX IF NOT EXISTS idx_client_accounts_pipedrive    ON client_accounts(pipedrive_deal_id);
CREATE INDEX IF NOT EXISTS idx_client_automations_client    ON client_automations(client_id);
CREATE INDEX IF NOT EXISTS idx_client_automations_ticket    ON client_automations(ticket_id);
CREATE INDEX IF NOT EXISTS idx_client_reports_client        ON client_reports(client_id);
CREATE INDEX IF NOT EXISTS idx_teammate_deployments_client  ON teammate_deployments(client_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_job_runs_job       ON scheduled_job_runs(job_name);
CREATE INDEX IF NOT EXISTS idx_scheduled_job_runs_started   ON scheduled_job_runs(started_at DESC);
