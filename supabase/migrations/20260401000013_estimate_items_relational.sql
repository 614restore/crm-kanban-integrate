-- Migration File: 20260401000013_estimate_items_relational.sql

-- Create estimate_items table
CREATE TABLE IF NOT EXISTS estimate_items (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    estimate_id INTEGER,
    item_name VARCHAR(255) NOT NULL,
    item_description TEXT,
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_estimate_items_company ON estimate_items(company_id);
CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate ON estimate_items(estimate_id);

-- Enable Row Level Security on estimate_items table
ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;

-- Create company-scoped RLS policies
CREATE POLICY select_policy ON estimate_items
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.company_id = estimate_items.company_id
    ));

CREATE POLICY insert_policy ON estimate_items
    FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.company_id = estimate_items.company_id
    ));

CREATE POLICY update_policy ON estimate_items
    FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.company_id = estimate_items.company_id
    ));

CREATE POLICY delete_policy ON estimate_items
    FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.company_id = estimate_items.company_id
    ));
