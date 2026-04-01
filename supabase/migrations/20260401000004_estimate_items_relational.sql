-- Migration: Estimate Items Relational Table
-- Created: 2026-04-01
-- Purpose: Convert estimate items from JSONB to proper relational structure with foreign keys

-- Create estimate_items table
CREATE TABLE IF NOT EXISTS estimate_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Item details
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- labor, material, equipment, other
  
  -- Quantity and pricing
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
  unit TEXT, -- sq ft, linear ft, each, hour, etc.
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  
  -- Tax and discounts
  tax_rate DECIMAL(5, 2) DEFAULT 0,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  discount_rate DECIMAL(5, 2) DEFAULT 0,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  
  -- Cost tracking (for profit margin calculations)
  cost DECIMAL(10, 2),
  profit_margin DECIMAL(5, 2),
  
  -- Display order
  sort_order INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_estimate_items_estimate ON estimate_items(estimate_id);
CREATE INDEX idx_estimate_items_company ON estimate_items(company_id);
CREATE INDEX idx_estimate_items_category ON estimate_items(category);
CREATE INDEX idx_estimate_items_sort ON estimate_items(estimate_id, sort_order);

-- Enable RLS
ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view estimate items for their company"
  ON estimate_items FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert estimate items for their company"
  ON estimate_items FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update estimate items for their company"
  ON estimate_items FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete estimate items for their company"
  ON estimate_items FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Migrate existing JSONB items to relational structure
DO $$
DECLARE
  est_record RECORD;
  item_record JSONB;
  item_index INTEGER;
BEGIN
  -- Loop through all estimates that have items in JSONB format
  FOR est_record IN 
    SELECT id, company_id, items 
    FROM estimates 
    WHERE items IS NOT NULL AND jsonb_array_length(items) > 0
  LOOP
    -- Loop through each item in the JSONB array
    FOR item_index IN 0..(jsonb_array_length(est_record.items) - 1)
    LOOP
      item_record := est_record.items->item_index;
      
      -- Insert into estimate_items table
      INSERT INTO estimate_items (
        estimate_id,
        company_id,
        name,
        description,
        category,
        quantity,
        unit,
        unit_price,
        total_price,
        tax_rate,
        tax_amount,
        discount_rate,
        discount_amount,
        cost,
        profit_margin,
        sort_order
      ) VALUES (
        est_record.id,
        est_record.company_id,
        COALESCE(item_record->>'name', item_record->>'description', 'Item'),
        item_record->>'description',
        COALESCE(item_record->>'category', 'other'),
        COALESCE((item_record->>'quantity')::DECIMAL, 1),
        COALESCE(item_record->>'unit', 'each'),
        COALESCE((item_record->>'unit_price')::DECIMAL, (item_record->>'price')::DECIMAL, 0),
        COALESCE((item_record->>'total_price')::DECIMAL, (item_record->>'total')::DECIMAL, 0),
        COALESCE((item_record->>'tax_rate')::DECIMAL, 0),
        COALESCE((item_record->>'tax_amount')::DECIMAL, 0),
        COALESCE((item_record->>'discount_rate')::DECIMAL, 0),
        COALESCE((item_record->>'discount_amount')::DECIMAL, 0),
        (item_record->>'cost')::DECIMAL,
        (item_record->>'profit_margin')::DECIMAL,
        item_index
      )
      ON CONFLICT DO NOTHING; -- Skip if already migrated
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Migrated estimate items from JSONB to relational table';
END $$;

-- Add a column to track migration status (optional, for rollback capability)
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS items_migrated BOOLEAN DEFAULT FALSE;

-- Mark estimates as migrated
UPDATE estimates SET items_migrated = TRUE WHERE items IS NOT NULL;

-- Create trigger to auto-calculate totals
CREATE OR REPLACE FUNCTION calculate_estimate_item_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate total price
  NEW.total_price = NEW.quantity * NEW.unit_price;
  
  -- Calculate tax amount if tax rate is set
  IF NEW.tax_rate > 0 THEN
    NEW.tax_amount = NEW.total_price * (NEW.tax_rate / 100);
  END IF;
  
  -- Calculate discount amount if discount rate is set
  IF NEW.discount_rate > 0 THEN
    NEW.discount_amount = NEW.total_price * (NEW.discount_rate / 100);
  END IF;
  
  -- Calculate profit margin if cost is set
  IF NEW.cost IS NOT NULL AND NEW.cost > 0 THEN
    NEW.profit_margin = ((NEW.unit_price - NEW.cost) / NEW.unit_price) * 100;
  END IF;
  
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER estimate_item_calculate_totals
  BEFORE INSERT OR UPDATE ON estimate_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_estimate_item_totals();

-- Create trigger to update estimate total when items change
CREATE OR REPLACE FUNCTION update_estimate_total_from_items()
RETURNS TRIGGER AS $$
DECLARE
  new_total DECIMAL(10, 2);
BEGIN
  -- Calculate new total from all items
  SELECT COALESCE(SUM(total_price + tax_amount - discount_amount), 0)
  INTO new_total
  FROM estimate_items
  WHERE estimate_id = COALESCE(NEW.estimate_id, OLD.estimate_id);
  
  -- Update the estimate
  UPDATE estimates
  SET 
    total = new_total,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.estimate_id, OLD.estimate_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER estimate_item_update_estimate_total
  AFTER INSERT OR UPDATE OR DELETE ON estimate_items
  FOR EACH ROW
  EXECUTE FUNCTION update_estimate_total_from_items();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON estimate_items TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE estimate_items IS 'Relational structure for estimate line items. Migrated from JSONB estimates.items column. The old JSONB column is kept for backward compatibility but marked as deprecated via items_migrated flag.';
