-- Migration: Create subcontractor_payments table for tracking subcontractor payment records

CREATE TABLE IF NOT EXISTS subcontractor_payments (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    subcontractor_id INTEGER NOT NULL,
    work_order_id INTEGER,
    amount NUMERIC(10, 2) NOT NULL,
    payment_date DATE NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_subcontractor_payments_company ON subcontractor_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_payments_subcontractor ON subcontractor_payments(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_payments_work_order ON subcontractor_payments(work_order_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_payments_date ON subcontractor_payments(payment_date);

-- Enable Row Level Security
ALTER TABLE subcontractor_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies scoped to company
CREATE POLICY "select_subcontractor_payments" ON subcontractor_payments
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "insert_subcontractor_payments" ON subcontractor_payments
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "update_subcontractor_payments" ON subcontractor_payments
    FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "delete_subcontractor_payments" ON subcontractor_payments
    FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );
