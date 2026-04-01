-- Migration: 20260402000003_subcontractor_payment_tracking.sql
-- Creates the subcontractor_payments table for tracking payments to subcontractors

CREATE TABLE subcontractor_payments (
    id SERIAL PRIMARY KEY,
    company_id UUID NOT NULL,
    subcontractor_id INTEGER NOT NULL,
    work_order_id INTEGER,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date DATE NOT NULL,
    description TEXT,
    payment_method VARCHAR(50),
    reference_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_subcontractor_payments_company ON subcontractor_payments(company_id);
CREATE INDEX idx_subcontractor_payments_subcontractor ON subcontractor_payments(subcontractor_id);
CREATE INDEX idx_subcontractor_payments_work_order ON subcontractor_payments(work_order_id);
CREATE INDEX idx_subcontractor_payments_date ON subcontractor_payments(payment_date);

-- Enable Row Level Security
ALTER TABLE subcontractor_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subcontractor_payments_tenant_select" ON subcontractor_payments
    FOR SELECT TO authenticated
    USING (company_id = get_my_company_id());

CREATE POLICY "subcontractor_payments_tenant_insert" ON subcontractor_payments
    FOR INSERT TO authenticated
    WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "subcontractor_payments_tenant_update" ON subcontractor_payments
    FOR UPDATE TO authenticated
    USING (company_id = get_my_company_id())
    WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "subcontractor_payments_tenant_delete" ON subcontractor_payments
    FOR DELETE TO authenticated
    USING (company_id = get_my_company_id());
