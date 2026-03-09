-- Migration: Commission rates + Subcontractor crew support
-- Date: 2026-03-09

-- 1. Add commission_rate and member_type to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS member_type TEXT DEFAULT 'employee' CHECK (member_type IN ('employee', 'subcontractor'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subcontractor_company TEXT;

-- 2. Create subcontractor_crews table for external (non-user) subcontractors
CREATE TABLE IF NOT EXISTS subcontractor_crews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  trade TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS for subcontractor_crews
ALTER TABLE subcontractor_crews ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "subcontractor_crews_company_isolation"
  ON subcontractor_crews
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 4. Update crew_schedules to support subcontractor assignments
ALTER TABLE crew_schedules ADD COLUMN IF NOT EXISTS subcontractor_id UUID REFERENCES subcontractor_crews(id) ON DELETE SET NULL;

-- crew_member_id may now be null if a subcontractor is assigned instead
ALTER TABLE crew_schedules ALTER COLUMN crew_member_id DROP NOT NULL;

-- 5. Add Self Generated to lead_sources defaults (if table exists)
-- This is a no-op if your app manages lead sources in localStorage only.
-- If you store them in a DB table, add:
-- INSERT INTO lead_sources (company_id, name, is_active, is_custom)
-- SELECT company_id, 'Self Generated', true, false FROM companies
-- ON CONFLICT DO NOTHING;

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
