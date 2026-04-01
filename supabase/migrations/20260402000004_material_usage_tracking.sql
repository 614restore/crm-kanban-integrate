-- Add material usage tracking to work orders and material order items
-- Migration: 20260402000004_material_usage_tracking.sql

-- Add usage tracking columns to material_order_items
ALTER TABLE material_order_items 
  ADD COLUMN quantity_ordered decimal(10,2) DEFAULT quantity,
  ADD COLUMN quantity_used decimal(10,2) DEFAULT 0,
  ADD COLUMN quantity_remaining decimal(10,2) GENERATED ALWAYS AS (quantity_ordered - quantity_used) STORED,
  ADD COLUMN usage_percentage decimal(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN quantity_ordered > 0 THEN (quantity_used / quantity_ordered) * 100
      ELSE 0 
    END
  ) STORED,
  ADD COLUMN is_overused boolean GENERATED ALWAYS AS (quantity_used > quantity_ordered) STORED;

-- Create material_usage_entries table for detailed tracking
CREATE TABLE IF NOT EXISTS material_usage_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_order_item_id uuid REFERENCES material_order_items(id) ON DELETE CASCADE,
  work_order_id uuid REFERENCES work_orders(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  quantity_used decimal(10,2) NOT NULL CHECK (quantity_used > 0),
  used_date date DEFAULT CURRENT_DATE,
  used_by uuid REFERENCES users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- RLS for material_usage_entries
ALTER TABLE material_usage_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "material_usage_entries_company_isolation" ON material_usage_entries
  FOR ALL USING (company_id = get_my_company_id());

-- Function to update quantity_used when usage entries change
CREATE OR REPLACE FUNCTION update_material_usage_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the material_order_items quantity_used based on usage entries
  UPDATE material_order_items 
  SET quantity_used = (
    SELECT COALESCE(SUM(quantity_used), 0)
    FROM material_usage_entries 
    WHERE material_order_item_id = COALESCE(NEW.material_order_item_id, OLD.material_order_item_id)
  )
  WHERE id = COALESCE(NEW.material_order_item_id, OLD.material_order_item_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update material usage totals
DROP TRIGGER IF EXISTS update_usage_totals_trigger ON material_usage_entries;
CREATE TRIGGER update_usage_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON material_usage_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_material_usage_totals();

-- Add material usage summary to work_orders
ALTER TABLE work_orders
  ADD COLUMN total_materials_ordered decimal(10,2) DEFAULT 0,
  ADD COLUMN total_materials_used decimal(10,2) DEFAULT 0,
  ADD COLUMN materials_usage_percentage decimal(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN total_materials_ordered > 0 THEN (total_materials_used / total_materials_ordered) * 100
      ELSE 0 
    END
  ) STORED;

-- Function to update work order material totals
CREATE OR REPLACE FUNCTION update_work_order_material_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Update work order material totals when usage entries change
  UPDATE work_orders 
  SET 
    total_materials_used = (
      SELECT COALESCE(SUM(mue.quantity_used), 0)
      FROM material_usage_entries mue
      WHERE mue.work_order_id = COALESCE(NEW.work_order_id, OLD.work_order_id)
    )
  WHERE id = COALESCE(NEW.work_order_id, OLD.work_order_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update work order material totals
DROP TRIGGER IF EXISTS update_work_order_materials_trigger ON material_usage_entries;
CREATE TRIGGER update_work_order_materials_trigger
  AFTER INSERT OR UPDATE OR DELETE ON material_usage_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_work_order_material_totals();

-- Add helpful indexes
CREATE INDEX IF NOT EXISTS idx_material_usage_entries_material_item_id ON material_usage_entries(material_order_item_id);
CREATE INDEX IF NOT EXISTS idx_material_usage_entries_work_order_id ON material_usage_entries(work_order_id);
CREATE INDEX IF NOT EXISTS idx_material_usage_entries_company_id ON material_usage_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_material_usage_entries_used_date ON material_usage_entries(used_date);

-- Create view for material variance analysis
CREATE OR REPLACE VIEW material_variance_report AS
SELECT 
  moi.id,
  moi.description,
  mo.order_number,
  s.name as supplier_name,
  moi.quantity_ordered,
  moi.quantity_used,
  moi.quantity_remaining,
  moi.usage_percentage,
  moi.is_overused,
  moi.unit_price,
  (moi.quantity_used * moi.unit_price) as actual_cost,
  (moi.quantity_ordered * moi.unit_price) as planned_cost,
  ((moi.quantity_used - moi.quantity_ordered) * moi.unit_price) as cost_variance,
  mo.company_id
FROM material_order_items moi
JOIN material_orders mo ON moi.order_id = mo.id
JOIN suppliers s ON mo.supplier_id = s.id
WHERE moi.quantity_used > 0 OR moi.quantity_ordered > 0;