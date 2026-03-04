-- opportunity_assessments migration
-- Run this once in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/kozfvbduvkpkvcastsah/sql/new
--
-- Or via psql:
--   psql $DATABASE_URL < scripts/migrate-opportunity-assessments.sql

CREATE TABLE IF NOT EXISTS opportunity_assessments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pipedrive_deal_id   INTEGER,
  company_name        TEXT        NOT NULL,
  contact_name        TEXT        NOT NULL,
  form_data           JSONB       NOT NULL DEFAULT '{}',
  transcript          TEXT,
  assessment          JSONB       NOT NULL DEFAULT '{}',
  html_content        TEXT,
  blueprint_content   TEXT,
  status              TEXT        NOT NULL DEFAULT 'draft'
                                  CHECK (status IN ('draft', 'sent', 'converted')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add blueprint_content if table already exists without it (idempotent)
ALTER TABLE opportunity_assessments
  ADD COLUMN IF NOT EXISTS blueprint_content TEXT;

-- RLS (service role bypasses automatically; anon users get no access)
ALTER TABLE opportunity_assessments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
DROP POLICY IF EXISTS "authenticated read" ON opportunity_assessments;
CREATE POLICY "authenticated read"
  ON opportunity_assessments
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert/update/delete (API routes use service role key)
