-- Migration: Add sign_token to estimates and signature fields to work_orders
-- Purpose: Enable customer-facing signing links for estimates and crew sign-off on work orders

-- Estimates: add sign_token for secure public signing links
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS sign_token TEXT;
CREATE INDEX IF NOT EXISTS idx_estimates_sign_token ON estimates(sign_token) WHERE sign_token IS NOT NULL;

-- Work orders: add signature fields for crew/customer sign-off on completion
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS signed_by TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS signature_data TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS sign_token TEXT;
CREATE INDEX IF NOT EXISTS idx_work_orders_sign_token ON work_orders(sign_token) WHERE sign_token IS NOT NULL;
