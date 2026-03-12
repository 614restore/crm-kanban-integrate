-- ============================================================
-- Migration: Fix oauth_states policies (idempotent) + patch company_integrations
-- Date: 2026-03-12
-- Reason: Previous run partially applied — table/policies may already exist.
--         This migration safely drops & recreates policies and adds missing columns.
-- ============================================================

-- ─── oauth_states: drop policies if they exist, then recreate ────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS oauth_states_select ON oauth_states;
  DROP POLICY IF EXISTS oauth_states_insert ON oauth_states;
  DROP POLICY IF EXISTS oauth_states_delete ON oauth_states;
END $$;

CREATE TABLE IF NOT EXISTS oauth_states (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  state         TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_state   ON oauth_states (state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states (expires_at);

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

CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM oauth_states WHERE expires_at < NOW();
$$;


-- ─── eagleview_orders: create if not exists ───────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_eagleview_orders_job     ON eagleview_orders (job_id);
CREATE INDEX IF NOT EXISTS idx_eagleview_orders_ev_id   ON eagleview_orders (eagleview_order_id);

ALTER TABLE eagleview_orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS eagleview_orders_tenant_select ON eagleview_orders;
  DROP POLICY IF EXISTS eagleview_orders_tenant_insert ON eagleview_orders;
  DROP POLICY IF EXISTS eagleview_orders_tenant_update ON eagleview_orders;
  DROP POLICY IF EXISTS eagleview_orders_tenant_delete ON eagleview_orders;
END $$;

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


-- ─── company_integrations: add missing columns ────────────────────────────────
ALTER TABLE company_integrations
  ADD COLUMN IF NOT EXISTS user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS connected        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_token     TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token    TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

SELECT '✅ oauth_states fixed, eagleview_orders ensured, company_integrations patched' AS status;
