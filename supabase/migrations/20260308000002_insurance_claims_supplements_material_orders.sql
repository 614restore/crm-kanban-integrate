-- Migration: insurance_claims + supplements tables, plus missing material_orders columns
-- Fixes: insurance claim/supplement save failures and material order save failures

-- ─── INSURANCE CLAIMS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insurance_claims (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id        UUID REFERENCES contacts(id) ON DELETE SET NULL,
  project_id        UUID REFERENCES projects(id) ON DELETE SET NULL,
  claim_number      TEXT NOT NULL,
  insurance_company TEXT NOT NULL,
  adjuster_name     TEXT,
  adjuster_phone    TEXT,
  adjuster_email    TEXT,
  claim_amount      NUMERIC(12,2),
  approved_amount   NUMERIC(12,2),
  deductible        NUMERIC(12,2),
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','inspection_scheduled','inspection_complete',
                                        'approved','denied','supplement_in_progress','closed')),
  inspection_date   DATE,
  loss_date         DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_claims_company ON insurance_claims (company_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_contact ON insurance_claims (contact_id);

ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insurance_claims_tenant_select" ON insurance_claims FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());
CREATE POLICY "insurance_claims_tenant_insert" ON insurance_claims FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "insurance_claims_tenant_update" ON insurance_claims FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "insurance_claims_tenant_delete" ON insurance_claims FOR DELETE TO authenticated
  USING (company_id = get_my_company_id());

DO $$ BEGIN
  CREATE TRIGGER update_insurance_claims_updated_at
    BEFORE UPDATE ON insurance_claims
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── SUPPLEMENTS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplements (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  claim_id           UUID NOT NULL REFERENCES insurance_claims(id) ON DELETE CASCADE,
  supplement_number  TEXT NOT NULL,
  description        TEXT NOT NULL,
  amount_requested   NUMERIC(12,2),
  amount_approved    NUMERIC(12,2),
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','submitted','approved','denied','partial')),
  submitted_date     DATE,
  approved_date      DATE,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplements_claim ON supplements (claim_id);
CREATE INDEX IF NOT EXISTS idx_supplements_company ON supplements (company_id);

ALTER TABLE supplements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplements_tenant_select" ON supplements FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());
CREATE POLICY "supplements_tenant_insert" ON supplements FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "supplements_tenant_update" ON supplements FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "supplements_tenant_delete" ON supplements FOR DELETE TO authenticated
  USING (company_id = get_my_company_id());

DO $$ BEGIN
  CREATE TRIGGER update_supplements_updated_at
    BEFORE UPDATE ON supplements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── MATERIAL ORDERS — add missing columns ────────────────────────────────────
ALTER TABLE material_orders
  ADD COLUMN IF NOT EXISTS project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attachments TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_material_orders_project ON material_orders (project_id);

SELECT '✅ Created insurance_claims, supplements; patched material_orders with project_id + attachments' AS status;
