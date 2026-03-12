-- ============================================================
-- Migration: OAuth States + EagleView Orders
-- Date: 2026-03-12
-- Purpose: Support PKCE OAuth flow for EagleView user auth
--          and store EagleView measurement orders per job
-- ============================================================

-- ─── OAUTH STATES (temporary PKCE state storage) ─────────────────────────────
-- Stores code_verifier + state during the OAuth redirect flow (expires in 10 min)
CREATE TABLE IF NOT EXISTS oauth_states (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider     TEXT NOT NULL,           -- e.g. 'eagleview'
  state        TEXT NOT NULL,           -- random state param
  code_verifier TEXT NOT NULL,          -- PKCE verifier
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states (state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states (expires_at);

-- RLS: users can only see/manage their own oauth state
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY oauth_states_select ON oauth_states
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY oauth_states_insert ON oauth_states
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY oauth_states_delete ON oauth_states
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Service role gets full access (used by API handlers)
-- (Supabase service role bypasses RLS by default)

-- Auto-clean expired states (runs via pg_cron if enabled, else clean on insert)
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM oauth_states WHERE expires_at < NOW();
$$;


-- ─── EAGLEVIEW ORDERS ─────────────────────────────────────────────────────────
-- Tracks EagleView measurement orders placed per job
CREATE TABLE IF NOT EXISTS eagleview_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_id              UUID REFERENCES jobs(id) ON DELETE SET NULL,
  eagleview_order_id  TEXT UNIQUE,
  status              TEXT NOT NULL DEFAULT 'pending',
  report_type         TEXT,
  report_url          TEXT,
  address             TEXT,
  environment         TEXT NOT NULL DEFAULT 'sandbox',
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eagleview_orders_company ON eagleview_orders (company_id);
CREATE INDEX IF NOT EXISTS idx_eagleview_orders_job ON eagleview_orders (job_id);
CREATE INDEX IF NOT EXISTS idx_eagleview_orders_ev_id ON eagleview_orders (eagleview_order_id);

ALTER TABLE eagleview_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY eagleview_orders_tenant_select ON eagleview_orders
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());

CREATE POLICY eagleview_orders_tenant_insert ON eagleview_orders
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY eagleview_orders_tenant_update ON eagleview_orders
  FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY eagleview_orders_tenant_delete ON eagleview_orders
  FOR DELETE TO authenticated
  USING (company_id = get_my_company_id());

DO $$ BEGIN
  CREATE TRIGGER update_eagleview_orders_updated_at
    BEFORE UPDATE ON eagleview_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ─── PATCH company_integrations for EagleView PKCE tokens ─────────────────────
-- company_integrations already exists (20260307_company_integrations.sql)
-- Add user_id + connected + refresh_token + token_expires_at if not present
ALTER TABLE company_integrations
  ADD COLUMN IF NOT EXISTS user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS connected        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_token     TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token    TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

COMMENT ON TABLE company_integrations IS
  'Stores per-company OAuth tokens and integration settings. '
  'For EagleView PKCE: access_token, refresh_token, token_expires_at per company. '
  'For QuickBooks: credentials JSONB. integration_type is the unique key per company.';

SELECT '✅ oauth_states, eagleview_orders created; company_integrations patched' AS status;
