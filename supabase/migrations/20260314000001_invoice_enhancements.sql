-- Invoice Enhancements Migration
-- Migration: 20260314000001_invoice_enhancements.sql
-- Adds: work order linking, payment tracking, payment methods

-- Link invoices to work orders
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS work_order_id UUID REFERENCES work_orders(id);
CREATE INDEX IF NOT EXISTS idx_invoices_work_order ON invoices(work_order_id);

-- Add payment tracking fields to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS balance_due NUMERIC(12,2);

-- Create invoice payments table for payment history
CREATE TABLE IF NOT EXISTS invoice_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  payment_date TIMESTAMP NOT NULL,
  reference_number VARCHAR(100),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_company ON invoice_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_date ON invoice_payments(payment_date);

-- Comments for documentation
COMMENT ON COLUMN invoices.work_order_id IS 'Links invoice to originating work order';
COMMENT ON COLUMN invoices.payment_method IS 'Primary payment method: cash, check, credit_card, ach, insurance_check';
COMMENT ON COLUMN invoices.paid_amount IS 'Total amount paid so far (sum of all payments)';
COMMENT ON COLUMN invoices.balance_due IS 'Remaining balance (total - paid_amount)';
COMMENT ON TABLE invoice_payments IS 'Tracks individual payments made against invoices';

-- Function to update invoice paid amount and balance
CREATE OR REPLACE FUNCTION update_invoice_payment_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE invoices
  SET 
    paid_amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM invoice_payments
      WHERE invoice_id = NEW.invoice_id
    ),
    balance_due = total - (
      SELECT COALESCE(SUM(amount), 0)
      FROM invoice_payments
      WHERE invoice_id = NEW.invoice_id
    ),
    status = CASE
      WHEN total <= (
        SELECT COALESCE(SUM(amount), 0)
        FROM invoice_payments
        WHERE invoice_id = NEW.invoice_id
      ) THEN 'paid'
      ELSE status
    END,
    paid_at = CASE
      WHEN total <= (
        SELECT COALESCE(SUM(amount), 0)
        FROM invoice_payments
        WHERE invoice_id = NEW.invoice_id
      ) THEN NOW()
      ELSE paid_at
    END,
    updated_at = NOW()
  WHERE id = NEW.invoice_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update invoice totals when payment is added
DROP TRIGGER IF EXISTS trigger_update_invoice_payment_totals ON invoice_payments;
CREATE TRIGGER trigger_update_invoice_payment_totals
  AFTER INSERT OR UPDATE OR DELETE ON invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_payment_totals();

SELECT '✅ Invoice enhancements complete: work order linking, payment tracking, and auto-calculations' as status;
