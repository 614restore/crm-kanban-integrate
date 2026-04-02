-- Migration: Labor Hours Tracking
-- Created: 2026-04-01
-- Purpose: Track crew labor hours for accurate cost tracking and productivity metrics

-- Create labor_entries table
CREATE TABLE IF NOT EXISTS labor_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  
  -- Worker information
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  worker_name TEXT NOT NULL,
  worker_role TEXT, -- foreman, laborer, technician, etc.
  
  -- Time tracking
  clock_in TIMESTAMP WITH TIME ZONE NOT NULL,
  clock_out TIMESTAMP WITH TIME ZONE,
  total_hours DECIMAL(5, 2),
  
  -- Cost tracking
  hourly_rate DECIMAL(10, 2),
  total_cost DECIMAL(10, 2),
  
  -- Entry type and status
  entry_type TEXT CHECK (entry_type IN ('clock', 'manual')) DEFAULT 'clock',
  status TEXT CHECK (status IN ('active', 'completed', 'approved', 'paid')) DEFAULT 'active',
  
  -- Notes
  notes TEXT,
  work_description TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES profiles(id)
);

-- Create indexes
CREATE INDEX idx_labor_entries_company ON labor_entries(company_id);
CREATE INDEX idx_labor_entries_project ON labor_entries(project_id);
CREATE INDEX idx_labor_entries_work_order ON labor_entries(work_order_id);
CREATE INDEX idx_labor_entries_user ON labor_entries(user_id);
CREATE INDEX idx_labor_entries_status ON labor_entries(status);
CREATE INDEX idx_labor_entries_date ON labor_entries(clock_in);
CREATE INDEX idx_labor_entries_active ON labor_entries(status) WHERE status = 'active';

-- Enable RLS
ALTER TABLE labor_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view labor entries for their company"
  ON labor_entries FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own labor entries"
  ON labor_entries FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own labor entries"
  ON labor_entries FOR UPDATE
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND company_id = labor_entries.company_id
      AND role IN ('owner', 'admin', 'manager')
    )
  );

-- Create trigger to auto-calculate total_hours and total_cost
CREATE OR REPLACE FUNCTION calculate_labor_entry_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate total hours if clock_out is set
  IF NEW.clock_out IS NOT NULL AND NEW.clock_in IS NOT NULL THEN
    NEW.total_hours = EXTRACT(EPOCH FROM (NEW.clock_out - NEW.clock_in)) / 3600;
  END IF;
  
  -- Calculate total cost if hourly_rate and total_hours are set
  IF NEW.total_hours IS NOT NULL AND NEW.hourly_rate IS NOT NULL THEN
    NEW.total_cost = NEW.total_hours * NEW.hourly_rate;
  END IF;
  
  -- Update status to completed when clocked out
  IF NEW.clock_out IS NOT NULL AND NEW.status = 'active' THEN
    NEW.status = 'completed';
  END IF;
  
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER labor_entry_calculate_totals
  BEFORE INSERT OR UPDATE ON labor_entries
  FOR EACH ROW
  EXECUTE FUNCTION calculate_labor_entry_totals();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON labor_entries TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
