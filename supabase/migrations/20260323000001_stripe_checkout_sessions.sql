-- ============================================================
-- Migration: Stripe Checkout Sessions + QB refresh_token expiry
-- Date: 2026-03-23
-- Purpose: Track Stripe Checkout Sessions created for homeowner
--          invoice payments, and extend company_integrations with
--          refresh_token_expires_at for QuickBooks OAuth.
-- ============================================================

-- ─── STRIPE CHECKOUT SESSIONS ─────────────────────────────────────────────────
-- Tracks payment links sent to homeowners so we can reconcile webhooks.
CREATE TABLE IF NOT EXISTS stripe_checkout_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  session_id      TEXT NOT NULL UNIQUE,        -- Stripe session ID (cs_...)
  invoice_id      UUID REFERENCES invoices(id) ON DELETE SET NULL,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  amount_cents    INTEGER NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'usd',
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | paid | expired | canceled
  payment_url     TEXT,                            -- Stripe hosted payment page URL
  stripe_pi_id    TEXT,                            -- payment_intent ID (set by webhook)
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_stripe_sessions_company  ON stripe_checkout_sessions (company_id);
CREATE INDEX IF NOT EXISTS idx_stripe_sessions_invoice  ON stripe_checkout_sessions (invoice_id);
CREATE INDEX IF NOT EXISTS idx_stripe_sessions_contact  ON stripe_checkout_sessions (contact_id);
CREATE INDEX IF NOT EXISTS idx_stripe_sessions_status   ON stripe_checkout_sessions (status);

ALTER TABLE stripe_checkout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY stripe_sessions_tenant_select ON stripe_checkout_sessions
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());

CREATE POLICY stripe_sessions_tenant_insert ON stripe_checkout_sessions
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY stripe_sessions_tenant_update ON stripe_checkout_sessions
  FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());


-- ─── PATCH company_integrations: QuickBooks refresh token expiry ───────────────
-- Add refresh_token_expires_at so we know when the QB refresh token itself expires
-- (QB refresh tokens last 101 days; if expired, user must reconnect).
ALTER TABLE company_integrations
  ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN company_integrations.refresh_token_expires_at IS
  'For QuickBooks: when the refresh_token expires (~101 days). After this, user must reconnect.';


SELECT '✅ stripe_checkout_sessions created; company_integrations patched (refresh_token_expires_at)' AS status;
