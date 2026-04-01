-- ============================================================================
-- STEP 5: ENABLE ROW LEVEL SECURITY
-- Run this after Step 4
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view all profiles in their company" ON profiles;
CREATE POLICY "Users can view all profiles in their company"
  ON profiles FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners and admins can update team member permissions" ON profiles;
CREATE POLICY "Owners and admins can update team member permissions"
  ON profiles FOR UPDATE
  USING (
    auth.uid() = id
    OR company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('owner', 'admin', 'sales_manager', 'production_manager', 'manager')
    )
  );

-- Companies policies
DROP POLICY IF EXISTS "Users can view their company" ON companies;
CREATE POLICY "Users can view their company"
  ON companies FOR SELECT
  USING (
    id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update their company" ON companies;
CREATE POLICY "Users can update their company"
  ON companies FOR UPDATE
  USING (
    id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- Contacts policies
DROP POLICY IF EXISTS "Users can view company contacts" ON contacts;
CREATE POLICY "Users can view company contacts"
  ON contacts FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert company contacts" ON contacts;
CREATE POLICY "Users can insert company contacts"
  ON contacts FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update company contacts" ON contacts;
CREATE POLICY "Users can update company contacts"
  ON contacts FOR UPDATE
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete company contacts" ON contacts;
CREATE POLICY "Users can delete company contacts"
  ON contacts FOR DELETE
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- Appointments policies
DROP POLICY IF EXISTS "Users can manage company appointments" ON appointments;
CREATE POLICY "Users can manage company appointments"
  ON appointments FOR ALL
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- Invoices policies
DROP POLICY IF EXISTS "Users can manage company invoices" ON invoices;
CREATE POLICY "Users can manage company invoices"
  ON invoices FOR ALL
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- Estimates policies
DROP POLICY IF EXISTS "Users can manage company estimates" ON estimates;
CREATE POLICY "Users can manage company estimates"
  ON estimates FOR ALL
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- Document templates policies
DROP POLICY IF EXISTS "Users can manage company document templates" ON document_templates;
CREATE POLICY "Users can manage company document templates"
  ON document_templates FOR ALL
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- Lead sources policies
DROP POLICY IF EXISTS "Users can manage company lead sources" ON lead_sources;
CREATE POLICY "Users can manage company lead sources"
  ON lead_sources FOR ALL
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- Activities policies
DROP POLICY IF EXISTS "Users can view company activities" ON activities;
CREATE POLICY "Users can view company activities"
  ON activities FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert company activities" ON activities;
CREATE POLICY "Users can insert company activities"
  ON activities FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );
