-- Add new work order fields for enhanced functionality
-- Migration: 20260313000001_work_orders_enhancements.sql

-- Add subcontractor fields
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS is_subcontractor BOOLEAN DEFAULT false;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS subcontractor_company TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS subcontractor_foreman TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS subcontractor_phone TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS subcontractor_pay_type TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS subcontractor_rate NUMERIC(12,2);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS subcontractor_cost NUMERIC(12,2) DEFAULT 0;

-- Add insurance and job type fields
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS is_insurance_job BOOLEAN DEFAULT false;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS job_type TEXT;

-- Add roof/job specification fields
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS squares NUMERIC(10,2);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS pitch TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS layers INTEGER;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS decking_type TEXT;

-- Add product selection fields
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS shingle_brand TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS shingle_line TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS shingle_color TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS underlayment TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS drip_edge TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS ventilation TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS flashing TEXT;

-- Add change orders and photo checklist
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS change_orders JSONB DEFAULT '[]';
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS photo_checklist JSONB DEFAULT '[]';

-- Add signature fields
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS signed_by TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS signature_data TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS foreman_signed_by TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS foreman_signature_data TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS sign_token TEXT;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_work_orders_job_type ON work_orders(job_type);
CREATE INDEX IF NOT EXISTS idx_work_orders_is_insurance ON work_orders(is_insurance_job);
CREATE INDEX IF NOT EXISTS idx_work_orders_is_subcontractor ON work_orders(is_subcontractor);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_scheduled_date ON work_orders(scheduled_date);

-- Add comment for documentation
COMMENT ON COLUMN work_orders.is_subcontractor IS 'True if using subcontractor instead of in-house crew';
COMMENT ON COLUMN work_orders.subcontractor_cost IS 'Total cost paid to subcontractor (separate from labor_cost)';
COMMENT ON COLUMN work_orders.is_insurance_job IS 'True if this is an insurance claim job vs retail';
COMMENT ON COLUMN work_orders.job_type IS 'Type of job: roof_tear_off, gutters, siding, etc.';
COMMENT ON COLUMN work_orders.change_orders IS 'Array of change orders/AWOs with description, amount, approver';
COMMENT ON COLUMN work_orders.photo_checklist IS 'Array of required photos with completion status';

SELECT '✅ Work orders table enhanced with subcontractor, insurance, job type, specs, and change order fields' as status;
