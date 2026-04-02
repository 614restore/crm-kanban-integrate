-- Migration: Add payment tracking fields to contacts table
-- Date: 2026-04-02
-- Issue: Code expects deposit/payment tracking fields that don't exist
--
-- Note: This assumes the base schema (setup-step-2-tables.sql) has already been run
-- If contacts table doesn't exist, run setup-step-2-tables.sql first!

-- Add deposit tracking fields
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(12,2);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deposit_date DATE;

-- Add final payment tracking fields
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS final_payment_amount NUMERIC(12,2);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS final_payment_paid BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS final_payment_date DATE;

-- Add adjuster_email field if missing (some deployments may not have it)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS adjuster_email TEXT;

-- Add helpful comments
COMMENT ON COLUMN contacts.deposit_amount IS 'Deposit amount for project';
COMMENT ON COLUMN contacts.deposit_paid IS 'Whether deposit has been paid';
COMMENT ON COLUMN contacts.deposit_date IS 'Date deposit was paid';
COMMENT ON COLUMN contacts.final_payment_amount IS 'Final payment amount';
COMMENT ON COLUMN contacts.final_payment_paid IS 'Whether final payment has been paid';
COMMENT ON COLUMN contacts.final_payment_date IS 'Date final payment was received';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

SELECT 'Payment tracking fields added successfully ✅' AS status;
