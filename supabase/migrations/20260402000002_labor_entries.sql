-- Create labor_entries table
CREATE TABLE labor_entries (
    id SERIAL PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    work_order_id INTEGER NOT NULL,
    crew_member_id INTEGER NOT NULL,
    clock_in_time TIMESTAMP NOT NULL,
    clock_out_time TIMESTAMP NOT NULL,
    hours_worked NUMERIC NOT NULL,
    hourly_rate NUMERIC NOT NULL,
    break_minutes INTEGER NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_labor_entries_company_id ON labor_entries(company_id);
CREATE INDEX idx_labor_entries_work_order_id ON labor_entries(work_order_id);
CREATE INDEX idx_labor_entries_crew_member_id ON labor_entries(crew_member_id);
CREATE INDEX idx_labor_entries_clock_in_time ON labor_entries(clock_in_time);
CREATE INDEX idx_labor_entries_clock_out_time ON labor_entries(clock_out_time);

-- Enable Row Level Security
ALTER TABLE labor_entries ENABLE ROW LEVEL SECURITY;

-- Create policies with tenant isolation
CREATE POLICY "labor_entries_tenant_select" ON labor_entries
    FOR SELECT TO authenticated
    USING (company_id = get_my_company_id());

CREATE POLICY "labor_entries_tenant_insert" ON labor_entries
    FOR INSERT TO authenticated
    WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "labor_entries_tenant_update" ON labor_entries
    FOR UPDATE TO authenticated
    USING (company_id = get_my_company_id())
    WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "labor_entries_tenant_delete" ON labor_entries
    FOR DELETE TO authenticated
    USING (company_id = get_my_company_id());