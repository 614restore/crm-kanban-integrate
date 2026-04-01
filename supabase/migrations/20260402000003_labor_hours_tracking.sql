-- Add labor hours tracking to work_orders table
-- Migration: 20260402000003_labor_hours_tracking.sql

-- Add labor hours columns to work_orders
ALTER TABLE work_orders 
  ADD COLUMN estimated_labor_hours decimal(5,2) DEFAULT 0,
  ADD COLUMN actual_labor_hours decimal(5,2) DEFAULT 0,
  ADD COLUMN labor_rate_per_hour decimal(8,2) DEFAULT 0,
  ADD COLUMN labor_start_time timestamptz,
  ADD COLUMN labor_end_time timestamptz,
  ADD COLUMN is_labor_timer_active boolean DEFAULT false;

-- Create time_entries table for detailed time tracking
CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id uuid REFERENCES work_orders(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  duration_minutes integer GENERATED ALWAYS AS (
    CASE 
      WHEN end_time IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (end_time - start_time)) / 60
      ELSE NULL 
    END
  ) STORED,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- RLS for time_entries
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_entries_company_isolation" ON time_entries
  FOR ALL USING (company_id = get_my_company_id());

-- Function to update actual_labor_hours when time entries change
CREATE OR REPLACE FUNCTION update_work_order_labor_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the work order's actual_labor_hours based on completed time entries
  UPDATE work_orders 
  SET actual_labor_hours = (
    SELECT COALESCE(SUM(duration_minutes), 0) / 60.0
    FROM time_entries 
    WHERE work_order_id = COALESCE(NEW.work_order_id, OLD.work_order_id)
      AND end_time IS NOT NULL
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.work_order_id, OLD.work_order_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update labor hours
DROP TRIGGER IF EXISTS update_labor_hours_trigger ON time_entries;
CREATE TRIGGER update_labor_hours_trigger
  AFTER INSERT OR UPDATE OR DELETE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_work_order_labor_hours();

-- Add helpful indexes
CREATE INDEX IF NOT EXISTS idx_time_entries_work_order_id ON time_entries(work_order_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_company_id ON time_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_active ON time_entries(is_active) WHERE is_active = true;