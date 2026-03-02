-- Migration: Add Suppliers, Material Orders, Estimates, Projects, and Work Orders tables
-- Created: 2026-03-02
-- Description: Creates tables for supplier management, material orders, customer estimates, project tracking, and work orders

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SUPPLIERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  website TEXT,
  account_number TEXT,
  payment_terms TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- Create trigger for suppliers updated_at
CREATE OR REPLACE FUNCTION update_suppliers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER suppliers_updated_at_trigger
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_suppliers_updated_at();

-- RLS Policies for suppliers
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view suppliers from their company
CREATE POLICY "Users can view suppliers from their company"
  ON suppliers FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert suppliers for their company
CREATE POLICY "Users can insert suppliers for their company"
  ON suppliers FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can update suppliers from their company
CREATE POLICY "Users can update suppliers from their company"
  ON suppliers FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete suppliers from their company
CREATE POLICY "Users can delete suppliers from their company"
  ON suppliers FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================
-- MATERIAL ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS material_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  order_date DATE NOT NULL,
  delivery_date DATE,
  expected_delivery_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'delivered', 'cancelled')),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax NUMERIC(10,2) DEFAULT 0,
  shipping NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  tracking_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for material_orders
CREATE INDEX IF NOT EXISTS idx_material_orders_company_id ON material_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_material_orders_supplier_id ON material_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_material_orders_status ON material_orders(status);
CREATE INDEX IF NOT EXISTS idx_material_orders_order_number ON material_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_material_orders_order_date ON material_orders(order_date DESC);

-- Create trigger for material_orders updated_at
CREATE OR REPLACE FUNCTION update_material_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER material_orders_updated_at_trigger
  BEFORE UPDATE ON material_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_material_orders_updated_at();

-- RLS Policies for material_orders
ALTER TABLE material_orders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view material orders from their company
CREATE POLICY "Users can view material orders from their company"
  ON material_orders FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert material orders for their company
CREATE POLICY "Users can insert material orders for their company"
  ON material_orders FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can update material orders from their company
CREATE POLICY "Users can update material orders from their company"
  ON material_orders FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete material orders from their company
CREATE POLICY "Users can delete material orders from their company"
  ON material_orders FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================
-- ESTIMATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  estimate_number TEXT NOT NULL,
  title TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  validity_date DATE NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'declined')),
  notes TEXT,
  terms_and_conditions TEXT,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  signed_by TEXT,
  signature_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for estimates
CREATE INDEX IF NOT EXISTS idx_estimates_company_id ON estimates(company_id);
CREATE INDEX IF NOT EXISTS idx_estimates_contact_id ON estimates(contact_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimates_estimate_number ON estimates(estimate_number);
CREATE INDEX IF NOT EXISTS idx_estimates_validity_date ON estimates(validity_date);
CREATE INDEX IF NOT EXISTS idx_estimates_created_at ON estimates(created_at DESC);

-- Create unique constraint for estimate number per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_estimates_company_number 
  ON estimates(company_id, estimate_number);

-- Create trigger for estimates updated_at
CREATE OR REPLACE FUNCTION update_estimates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER estimates_updated_at_trigger
  BEFORE UPDATE ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION update_estimates_updated_at();

-- RLS Policies for estimates
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view estimates from their company
CREATE POLICY "Users can view estimates from their company"
  ON estimates FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert estimates for their company
CREATE POLICY "Users can insert estimates for their company"
  ON estimates FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can update estimates from their company
CREATE POLICY "Users can update estimates from their company"
  ON estimates FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete estimates from their company
CREATE POLICY "Users can delete estimates from their company"
  ON estimates FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================
-- UPDATE PROFILES TABLE (Add work_email)
-- ============================================
-- Add work_email column to profiles if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'work_email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN work_email TEXT;
  END IF;
END $$;

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_number TEXT NOT NULL,
  name TEXT NOT NULL,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL,
  description TEXT,
  status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  start_date DATE,
  end_date DATE,
  completed_date DATE,
  estimated_budget NUMERIC(10,2) DEFAULT 0,
  actual_cost NUMERIC(10,2) DEFAULT 0,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  project_manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  tags TEXT[],
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for projects
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_contact_id ON projects(contact_id);
CREATE INDEX IF NOT EXISTS idx_projects_estimate_id ON projects(estimate_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_priority ON projects(priority);
CREATE INDEX IF NOT EXISTS idx_projects_project_manager_id ON projects(project_manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_start_date ON projects(start_date);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

-- Create unique constraint for project number per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_company_number 
  ON projects(company_id, project_number);

-- Create trigger for projects updated_at
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at_trigger
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_projects_updated_at();

-- RLS Policies for projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view projects from their company
CREATE POLICY "Users can view projects from their company"
  ON projects FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert projects for their company
CREATE POLICY "Users can insert projects for their company"
  ON projects FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can update projects from their company
CREATE POLICY "Users can update projects from their company"
  ON projects FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete projects from their company
CREATE POLICY "Users can delete projects from their company"
  ON projects FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================
-- WORK ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS work_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  work_order_number TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'on_hold')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  scheduled_date TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  assigned_to UUID[] DEFAULT '{}',
  estimated_hours NUMERIC(5,2),
  actual_hours NUMERIC(5,2),
  labor_cost NUMERIC(10,2) DEFAULT 0,
  material_cost NUMERIC(10,2) DEFAULT 0,
  total_cost NUMERIC(10,2) DEFAULT 0,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  notes TEXT,
  attachments TEXT[],
  checklist_items JSONB DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for work_orders
CREATE INDEX IF NOT EXISTS idx_work_orders_company_id ON work_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_project_id ON work_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_contact_id ON work_orders(contact_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_priority ON work_orders(priority);
CREATE INDEX IF NOT EXISTS idx_work_orders_scheduled_date ON work_orders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_to ON work_orders USING GIN(assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_orders_created_at ON work_orders(created_at DESC);

-- Create unique constraint for work order number per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_orders_company_number 
  ON work_orders(company_id, work_order_number);

-- Create trigger for work_orders updated_at
CREATE OR REPLACE FUNCTION update_work_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_orders_updated_at_trigger
  BEFORE UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_work_orders_updated_at();

-- RLS Policies for work_orders
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view work orders from their company
CREATE POLICY "Users can view work orders from their company"
  ON work_orders FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert work orders for their company
CREATE POLICY "Users can insert work orders for their company"
  ON work_orders FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can update work orders from their company
CREATE POLICY "Users can update work orders from their company"
  ON work_orders FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete work orders from their company
CREATE POLICY "Users can delete work orders from their company"
  ON work_orders FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================
-- HELPFUL VIEWS (Optional)
-- ============================================

-- View: Active suppliers with order count
CREATE OR REPLACE VIEW active_suppliers_with_stats AS
SELECT 
  s.*,
  COUNT(mo.id) as order_count,
  COALESCE(SUM(mo.total), 0) as total_ordered
FROM suppliers s
LEFT JOIN material_orders mo ON s.id = mo.supplier_id
WHERE s.is_active = true
GROUP BY s.id;

-- View: Estimates with customer details
CREATE OR REPLACE VIEW estimates_with_customer AS
SELECT 
  e.*,
  c.first_name,
  c.last_name,
  c.email as customer_email,
  c.phone as customer_phone
FROM estimates e
JOIN contacts c ON e.contact_id = c.id;

-- View: Pending estimates (not expired)
CREATE OR REPLACE VIEW pending_estimates AS
SELECT *
FROM estimates
WHERE status IN ('sent', 'viewed')
  AND validity_date >= CURRENT_DATE;

-- View: Active projects with budget tracking
CREATE OR REPLACE VIEW active_projects_with_stats AS
SELECT 
  p.*,
  c.first_name || ' ' || c.last_name as customer_name,
  c.email as customer_email,
  COUNT(wo.id) as work_order_count,
  COALESCE(SUM(wo.total_cost), 0) as total_work_order_cost,
  p.estimated_budget - p.actual_cost as budget_remaining
FROM projects p
JOIN contacts c ON p.contact_id = c.id
LEFT JOIN work_orders wo ON p.id = wo.project_id
WHERE p.status NOT IN ('completed', 'cancelled')
GROUP BY p.id, c.first_name, c.last_name, c.email;

-- View: Work orders with project and customer details
CREATE OR REPLACE VIEW work_orders_with_details AS
SELECT 
  wo.*,
  c.first_name || ' ' || c.last_name as customer_name,
  c.phone as customer_phone,
  p.name as project_name,
  p.project_number
FROM work_orders wo
JOIN contacts c ON wo.contact_id = c.id
LEFT JOIN projects p ON wo.project_id = p.id;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant usage on views
GRANT SELECT ON active_suppliers_with_stats TO authenticated;
GRANT SELECT ON estimates_with_customer TO authenticated;
GRANT SELECT ON pending_estimates TO authenticated;
GRANT SELECT ON active_projects_with_stats TO authenticated;
GRANT SELECT ON work_orders_with_details TO authenticated;

-- ============================================
-- COMPLETION MESSAGE
-- ============================================

DO $$ 
BEGIN
  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE 'Created tables: suppliers, material_orders, estimates, projects, work_orders';
  RAISE NOTICE 'Added RLS policies for all tables';
  RAISE NOTICE 'Created indexes for performance';
  RAISE NOTICE 'Added helpful views for reporting';
  RAISE NOTICE 'Next step: Test the tables in your application';
END $$;
