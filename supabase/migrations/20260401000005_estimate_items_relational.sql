-- Migration: 20260401000005_estimate_items_relational.sql
-- Creates the estimate_items table as a relational table for estimate line items,
-- replacing the JSONB items column approach with a proper normalized structure.

CREATE TABLE IF NOT EXISTS estimate_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  item_name   TEXT NOT NULL,
  description TEXT,
  quantity    NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estimate_items_company  ON estimate_items(company_id);
CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate ON estimate_items(estimate_id);

ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estimate_items_tenant_select" ON estimate_items
  FOR SELECT USING (company_id = get_my_company_id());

CREATE POLICY "estimate_items_tenant_insert" ON estimate_items
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "estimate_items_tenant_update" ON estimate_items
  FOR UPDATE USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "estimate_items_tenant_delete" ON estimate_items
  FOR DELETE USING (company_id = get_my_company_id());
