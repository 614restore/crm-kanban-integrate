-- TrussCTR v2 — Project Manager Features
-- Tables: crew_schedules, change_orders, permits, equipment, equipment_assignments
-- Also adds is_archived to contacts

-- ─────────────────────────────────────────────
-- 1. Contact archiving
-- ─────────────────────────────────────────────
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_contacts_is_archived ON contacts (company_id, is_archived);

-- ─────────────────────────────────────────────
-- 2. Crew Schedules
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crew_schedules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  crew_member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id         UUID REFERENCES jobs(id) ON DELETE SET NULL,
  contact_id     UUID REFERENCES contacts(id) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  notes          TEXT,
  scheduled_date DATE NOT NULL,
  start_time     TIME,
  end_time       TIME,
  status         TEXT NOT NULL DEFAULT 'scheduled'
                   CHECK (status IN ('scheduled','in-progress','completed','cancelled')),
  created_by     UUID REFERENCES profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crew_schedules_company_date
  ON crew_schedules (company_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_crew_schedules_member
  ON crew_schedules (crew_member_id, scheduled_date);

ALTER TABLE crew_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_members_crew_schedules"
  ON crew_schedules FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ─────────────────────────────────────────────
-- 3. Change Orders
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS change_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  change_order_number TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','sent','signed','approved','rejected','void')),
  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax             NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  items           JSONB NOT NULL DEFAULT '[]',
  sign_token      UUID DEFAULT gen_random_uuid(),
  signed_at       TIMESTAMPTZ,
  signed_by_name  TEXT,
  signed_ip       TEXT,
  signature_data  TEXT,
  sent_at         TIMESTAMPTZ,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_change_orders_company
  ON change_orders (company_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_contact
  ON change_orders (contact_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_change_orders_sign_token
  ON change_orders (sign_token);

ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_members_change_orders"
  ON change_orders FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
-- Public read for signing (by token — app logic handles this)

-- ─────────────────────────────────────────────
-- 4. Permits
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permits (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id       UUID REFERENCES contacts(id) ON DELETE SET NULL,
  job_id           UUID REFERENCES jobs(id) ON DELETE SET NULL,
  permit_number    TEXT,
  permit_type      TEXT NOT NULL DEFAULT 'building',
  issuing_authority TEXT,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('not-required','pending','applied','approved','inspected','closed','expired','denied')),
  applied_date     DATE,
  approved_date    DATE,
  expires_date     DATE,
  inspection_date  DATE,
  fee              NUMERIC(10,2),
  notes            TEXT,
  documents        JSONB NOT NULL DEFAULT '[]',
  created_by       UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permits_company
  ON permits (company_id);
CREATE INDEX IF NOT EXISTS idx_permits_contact
  ON permits (contact_id);

ALTER TABLE permits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_members_permits"
  ON permits FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ─────────────────────────────────────────────
-- 5. Equipment / Assets
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  category          TEXT NOT NULL DEFAULT 'tool'
                      CHECK (category IN ('tool','vehicle','machinery','other')),
  make              TEXT,
  model             TEXT,
  year              INT,
  serial_number     TEXT,
  license_plate     TEXT,
  vin               TEXT,
  status            TEXT NOT NULL DEFAULT 'available'
                      CHECK (status IN ('available','in-use','maintenance','retired')),
  purchase_date     DATE,
  purchase_price    NUMERIC(12,2),
  last_maintenance  DATE,
  next_maintenance  DATE,
  notes             TEXT,
  assigned_to       UUID REFERENCES profiles(id),
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_company
  ON equipment (company_id);
CREATE INDEX IF NOT EXISTS idx_equipment_status
  ON equipment (company_id, status);

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_members_equipment"
  ON equipment FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ─────────────────────────────────────────────
-- 6. Equipment Assignments (assign to jobs/projects)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  equipment_id  UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  job_id        UUID REFERENCES jobs(id) ON DELETE SET NULL,
  contact_id    UUID REFERENCES contacts(id) ON DELETE SET NULL,
  assigned_by   UUID REFERENCES profiles(id),
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  returned_at   TIMESTAMPTZ,
  notes         TEXT
);

CREATE INDEX IF NOT EXISTS idx_equipment_assignments_equipment
  ON equipment_assignments (equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_assignments_job
  ON equipment_assignments (job_id);

ALTER TABLE equipment_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_members_equipment_assignments"
  ON equipment_assignments FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ─────────────────────────────────────────────
-- updated_at triggers (shared function reuse)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_crew_schedules_updated_at') THEN
    CREATE TRIGGER trg_crew_schedules_updated_at
      BEFORE UPDATE ON crew_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_change_orders_updated_at') THEN
    CREATE TRIGGER trg_change_orders_updated_at
      BEFORE UPDATE ON change_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_permits_updated_at') THEN
    CREATE TRIGGER trg_permits_updated_at
      BEFORE UPDATE ON permits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_equipment_updated_at') THEN
    CREATE TRIGGER trg_equipment_updated_at
      BEFORE UPDATE ON equipment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
