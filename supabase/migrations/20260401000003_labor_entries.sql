-- Migration: 20260401000003_labor_entries.sql
-- Creates the labor_entries table for clock-in/out records and time tracking
-- for crew members on work orders.

CREATE TABLE IF NOT EXISTS labor_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  work_order_id   UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  crew_member_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  clock_in_time   TIMESTAMPTZ NOT NULL,
  clock_out_time  TIMESTAMPTZ,
  hours_worked    NUMERIC(6, 2),
  hourly_rate     NUMERIC(10, 2),
  break_minutes   INT NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_labor_entries_company      ON labor_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_labor_entries_work_order   ON labor_entries(work_order_id);
CREATE INDEX IF NOT EXISTS idx_labor_entries_crew_member  ON labor_entries(crew_member_id);
CREATE INDEX IF NOT EXISTS idx_labor_entries_clock_in     ON labor_entries(clock_in_time);

ALTER TABLE labor_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "labor_entries_tenant_select" ON labor_entries
  FOR SELECT USING (company_id = get_my_company_id());

CREATE POLICY "labor_entries_tenant_insert" ON labor_entries
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "labor_entries_tenant_update" ON labor_entries
  FOR UPDATE USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "labor_entries_tenant_delete" ON labor_entries
  FOR DELETE USING (company_id = get_my_company_id());
