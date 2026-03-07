-- Company Integrations table
-- Stores per-company integration credentials and settings.
-- Credentials stored as JSONB; access controlled by RLS (company members only).

CREATE TABLE IF NOT EXISTS company_integrations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,          -- e.g. 'hailtrace', 'stripe', 'twilio'
  is_active        BOOLEAN NOT NULL DEFAULT true,
  credentials      JSONB NOT NULL DEFAULT '{}',
  settings         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, integration_type)
);

-- Index for fast per-company lookups
CREATE INDEX IF NOT EXISTS idx_company_integrations_company_id
  ON company_integrations (company_id);

-- RLS
ALTER TABLE company_integrations ENABLE ROW LEVEL SECURITY;

-- Members of the company can read their own integrations
CREATE POLICY "company_members_read_integrations"
  ON company_integrations FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Only owners/admins can write integration settings
CREATE POLICY "company_admins_write_integrations"
  ON company_integrations FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_company_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_company_integrations_updated_at ON company_integrations;
CREATE TRIGGER trg_company_integrations_updated_at
  BEFORE UPDATE ON company_integrations
  FOR EACH ROW EXECUTE FUNCTION update_company_integrations_updated_at();
