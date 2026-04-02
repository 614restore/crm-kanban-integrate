-- Migration: Subcontractor Payment Tracking
-- Created: 2026-04-01
-- Purpose: Track subcontractor payment status and schedules for better cost management

-- Add payment tracking columns to work_orders table
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS sub_payment_status TEXT CHECK (sub_payment_status IN ('unpaid', 'partial', 'paid')) DEFAULT 'unpaid';
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS sub_payment_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS sub_payment_due_date DATE;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS sub_last_payment_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS sub_last_payment_amount DECIMAL(10, 2);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS sub_payment_notes TEXT;

-- Create index for payment queries
CREATE INDEX IF NOT EXISTS idx_work_orders_sub_payment_status ON work_orders(sub_payment_status);
CREATE INDEX IF NOT EXISTS idx_work_orders_sub_payment_due ON work_orders(sub_payment_due_date) WHERE sub_payment_status != 'paid';

-- Create subcontractor_payments table for detailed payment history
CREATE TABLE IF NOT EXISTS subcontractor_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  
  -- Payment details
  amount DECIMAL(10, 2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT, -- check, ACH, wire, cash, etc.
  check_number TEXT,
  reference_number TEXT,
  
  -- Status and verification
  status TEXT CHECK (status IN ('pending', 'processed', 'cleared', 'void')) DEFAULT 'pending',
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for subcontractor_payments
CREATE INDEX idx_subcontractor_payments_company ON subcontractor_payments(company_id);
CREATE INDEX idx_subcontractor_payments_work_order ON subcontractor_payments(work_order_id);
CREATE INDEX idx_subcontractor_payments_project ON subcontractor_payments(project_id);
CREATE INDEX idx_subcontractor_payments_date ON subcontractor_payments(payment_date);
CREATE INDEX idx_subcontractor_payments_status ON subcontractor_payments(status);

-- Enable RLS
ALTER TABLE subcontractor_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subcontractor_payments
CREATE POLICY "Users can view subcontractor payments for their company"
  ON subcontractor_payments FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Managers can insert subcontractor payments"
  ON subcontractor_payments FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Managers can update subcontractor payments"
  ON subcontractor_payments FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager')
    )
  );

-- Create trigger to update work_orders payment status
CREATE OR REPLACE FUNCTION update_work_order_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  total_paid DECIMAL(10, 2);
  wo_cost DECIMAL(10, 2);
BEGIN
  -- Get total payments for this work order
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM subcontractor_payments
  WHERE work_order_id = NEW.work_order_id AND status != 'void';
  
  -- Get work order cost
  SELECT subcontractor_cost INTO wo_cost
  FROM work_orders
  WHERE id = NEW.work_order_id;
  
  -- Update work order payment status
  UPDATE work_orders
  SET 
    sub_payment_amount = total_paid,
    sub_last_payment_date = NEW.payment_date,
    sub_last_payment_amount = NEW.amount,
    sub_payment_status = CASE
      WHEN total_paid = 0 THEN 'unpaid'
      WHEN total_paid >= wo_cost THEN 'paid'
      ELSE 'partial'
    END
  WHERE id = NEW.work_order_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subcontractor_payment_update_status
  AFTER INSERT OR UPDATE ON subcontractor_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_work_order_payment_status();

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_subcontractor_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subcontractor_payments_updated_at
  BEFORE UPDATE ON subcontractor_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_subcontractor_payments_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON subcontractor_payments TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
