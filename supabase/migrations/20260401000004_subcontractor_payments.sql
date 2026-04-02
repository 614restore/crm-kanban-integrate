-- Migration: 20260401000004_subcontractor_payments.sql
-- Creates the subcontractor_payments table for tracking payments made to
-- subcontractors against work orders.

CREATE TABLE IF NOT EXISTS subcontractor_payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  work_order_id       UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  subcontractor_name  TEXT NOT NULL,
  amount              NUMERIC(12, 2) NOT NULL,
  payment_date        DATE NOT NULL,
  payment_method      TEXT,
  reference_number    TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'paid', 'voided')),
  notes               TEXT,
  created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subcontractor_payments_company    ON subcontractor_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_payments_work_order ON subcontractor_payments(work_order_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_payments_date       ON subcontractor_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_subcontractor_payments_status     ON subcontractor_payments(status);

ALTER TABLE subcontractor_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subcontractor_payments_tenant_select" ON subcontractor_payments
  FOR SELECT USING (company_id = get_my_company_id());

CREATE POLICY "subcontractor_payments_tenant_insert" ON subcontractor_payments
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "subcontractor_payments_tenant_update" ON subcontractor_payments
  FOR UPDATE USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "subcontractor_payments_tenant_delete" ON subcontractor_payments
  FOR DELETE USING (company_id = get_my_company_id());
