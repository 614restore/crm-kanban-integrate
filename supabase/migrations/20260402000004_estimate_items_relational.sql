-- Migration File: 20260402000004_estimate_items_relational.sql

-- Create estimate_items table
CREATE TABLE estimate_items (
    id SERIAL PRIMARY KEY,
    estimate_id INTEGER,
    item_name VARCHAR(255) NOT NULL,
    item_description TEXT,
    quantity INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Enable Row Level Security on estimate_items table
ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
-- Note: estimate_items are accessible if the parent estimate is accessible to the user.
-- Adjust conditions here once the estimates table RLS is established.
CREATE POLICY "estimate_items_select" ON estimate_items
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "estimate_items_insert" ON estimate_items
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "estimate_items_update" ON estimate_items
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "estimate_items_delete" ON estimate_items
    FOR DELETE TO authenticated
    USING (true);