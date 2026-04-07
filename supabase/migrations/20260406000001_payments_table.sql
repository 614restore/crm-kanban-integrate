-- Payments Table Migration
-- Migration: 20260406000001_payments_table.sql
-- Creates a universal payments table linked to contacts, jobs, estimates, and processors

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(50) NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash','check','credit_card','ach','insurance_check','stripe_link','stripe_payment_link','external','other')),
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reference_number VARCHAR(100),
  notes TEXT,
  -- Stripe tracking
  stripe_payment_intent_id VARCHAR(255),
  stripe_payment_link_id VARCHAR(255),
  stripe_payment_link_url TEXT,
  stripe_status VARCHAR(50),
  -- Who processed it
  processed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  processed_by_name TEXT,  -- denormalized so it persists even if profile deleted
  -- Receipt tracking
  receipt_sent BOOLEAN DEFAULT FALSE,
  receipt_sent_at TIMESTAMPTZ,
  receipt_sent_to TEXT,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payments_contact ON payments(contact_id);
CREATE INDEX IF NOT EXISTS idx_payments_company ON payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_work_order ON payments(work_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_estimate ON payments(estimate_id);
CREATE INDEX IF NOT EXISTS idx_payments_processed_by ON payments(processed_by);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date DESC);

-- RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_company_isolation" ON payments
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_payments_updated_at ON payments;
CREATE TRIGGER trigger_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();

-- Helpful view: payments with contact name and processor name
CREATE OR REPLACE VIEW payments_with_details AS
SELECT
  p.*,
  c.name AS contact_name,
  c.email AS contact_email,
  c.phone AS contact_phone,
  pr.first_name || ' ' || pr.last_name AS processor_full_name,
  wo.title AS work_order_title,
  wo.work_order_number,
  e.title AS estimate_title,
  e.estimate_number
FROM payments p
LEFT JOIN contacts c ON c.id = p.contact_id
LEFT JOIN profiles pr ON pr.id = p.processed_by
LEFT JOIN work_orders wo ON wo.id = p.work_order_id
LEFT JOIN estimates e ON e.id = p.estimate_id;

SELECT '✅ Payments table created with RLS, indexes, and detail view' AS status;
