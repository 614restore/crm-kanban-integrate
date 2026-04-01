-- Missing tables migration: estimates, estimate_items, projects, work_orders,
-- suppliers, material_orders, material_order_items

-- ─── ESTIMATES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estimates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  estimate_number TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'draft',
  items           JSONB DEFAULT '[]',
  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax             NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  validity_date   DATE,
  valid_until     DATE,
  notes           TEXT,
  terms_and_conditions TEXT,
  terms           TEXT,
  sent_at         TIMESTAMPTZ,
  viewed_at       TIMESTAMPTZ,
  accepted_at     TIMESTAMPTZ,
  declined_at     TIMESTAMPTZ,
  signed_by       TEXT,
  signature_data  TEXT,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estimates_tenant_select" ON estimates FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "estimates_tenant_insert" ON estimates FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "estimates_tenant_update" ON estimates FOR UPDATE USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "estimates_tenant_delete" ON estimates FOR DELETE USING (company_id = get_my_company_id());

-- ─── PROJECTS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_number      TEXT NOT NULL,
  name                TEXT NOT NULL,
  contact_id          UUID REFERENCES contacts(id) ON DELETE SET NULL,
  estimate_id         UUID REFERENCES estimates(id) ON DELETE SET NULL,
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'planning',
  priority            TEXT NOT NULL DEFAULT 'medium',
  start_date          DATE,
  end_date            DATE,
  completed_date      DATE,
  estimated_budget    NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_cost         NUMERIC(12,2) NOT NULL DEFAULT 0,
  address             TEXT,
  city                TEXT,
  state               TEXT,
  zip                 TEXT,
  project_manager_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes               TEXT,
  tags                TEXT[] DEFAULT '{}',
  created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_tenant_select" ON projects FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "projects_tenant_insert" ON projects FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "projects_tenant_update" ON projects FOR UPDATE USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "projects_tenant_delete" ON projects FOR DELETE USING (company_id = get_my_company_id());

-- ─── WORK ORDERS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  work_order_number   TEXT NOT NULL,
  project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
  contact_id          UUID REFERENCES contacts(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',
  priority            TEXT NOT NULL DEFAULT 'medium',
  scheduled_date      DATE,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  assigned_to         UUID[] DEFAULT '{}',
  estimated_hours     NUMERIC(8,2),
  actual_hours        NUMERIC(8,2),
  labor_cost          NUMERIC(12,2) NOT NULL DEFAULT 0,
  material_cost       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost          NUMERIC(12,2) NOT NULL DEFAULT 0,
  address             TEXT,
  city                TEXT,
  state               TEXT,
  zip                 TEXT,
  notes               TEXT,
  attachments         TEXT[] DEFAULT '{}',
  checklist_items     JSONB DEFAULT '[]',
  created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "work_orders_tenant_select" ON work_orders FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "work_orders_tenant_insert" ON work_orders FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "work_orders_tenant_update" ON work_orders FOR UPDATE USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "work_orders_tenant_delete" ON work_orders FOR DELETE USING (company_id = get_my_company_id());

-- ─── SUPPLIERS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  contact_name    TEXT,
  email           TEXT,
  phone           TEXT,
  address         TEXT,
  city            TEXT,
  state           TEXT,
  zip             TEXT,
  website         TEXT,
  account_number  TEXT,
  payment_terms   TEXT,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_tenant_select" ON suppliers FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "suppliers_tenant_insert" ON suppliers FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "suppliers_tenant_update" ON suppliers FOR UPDATE USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "suppliers_tenant_delete" ON suppliers FOR DELETE USING (company_id = get_my_company_id());

-- ─── MATERIAL ORDERS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS material_orders (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id             UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  contact_id              UUID REFERENCES contacts(id) ON DELETE SET NULL,
  job_id                  UUID REFERENCES jobs(id) ON DELETE SET NULL,
  order_number            TEXT,
  order_date              DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date  DATE,
  actual_delivery_date    DATE,
  status                  TEXT NOT NULL DEFAULT 'pending',
  subtotal                NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax                     NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping                NUMERIC(12,2) NOT NULL DEFAULT 0,
  total                   NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes                   TEXT,
  created_by              UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE material_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "material_orders_tenant_select" ON material_orders FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "material_orders_tenant_insert" ON material_orders FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "material_orders_tenant_update" ON material_orders FOR UPDATE USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "material_orders_tenant_delete" ON material_orders FOR DELETE USING (company_id = get_my_company_id());

-- ─── MATERIAL ORDER ITEMS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS material_order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES material_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit        TEXT NOT NULL DEFAULT 'each',
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total       NUMERIC(12,2) NOT NULL DEFAULT 0
);

ALTER TABLE material_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "material_order_items_select" ON material_order_items FOR SELECT USING (
  order_id IN (SELECT id FROM material_orders WHERE company_id = get_my_company_id())
);
CREATE POLICY "material_order_items_insert" ON material_order_items FOR INSERT WITH CHECK (
  order_id IN (SELECT id FROM material_orders WHERE company_id = get_my_company_id())
);
CREATE POLICY "material_order_items_update" ON material_order_items FOR UPDATE USING (
  order_id IN (SELECT id FROM material_orders WHERE company_id = get_my_company_id())
);
CREATE POLICY "material_order_items_delete" ON material_order_items FOR DELETE USING (
  order_id IN (SELECT id FROM material_orders WHERE company_id = get_my_company_id())
);

-- ─── UPDATED_AT TRIGGERS ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

DO $$ BEGIN
  CREATE TRIGGER update_estimates_updated_at BEFORE UPDATE ON estimates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TRIGGER update_work_orders_updated_at BEFORE UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TRIGGER update_material_orders_updated_at BEFORE UPDATE ON material_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

SELECT '✅ Missing tables created: estimates, projects, work_orders, suppliers, material_orders' as status;
