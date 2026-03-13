# 🚀 Supabase Setup Checklist for CRM Kanban

**Last Updated:** March 13, 2026  
**Status:** Complete setup guide with all required SQL and Edge Functions

---

## ✅ QUICK ANSWER: What You Need to Run

### Required SQL Scripts
1. ✅ **Main Database Schema** - Tables, RLS, triggers
2. ✅ **Owner Priority View** - For priority board scoring
3. ✅ **Document Templates Table** - For legal documents
4. ✅ **Storage Buckets & Policies** - For logos, avatars, documents

### Required Edge Functions
1. ✅ **send-email** - For document sending (optional, uses Resend)
2. ✅ **send-invite-email** - For team invitations (optional, uses Resend)

### Optional (Already in Migrations)
- All other migrations in `supabase-migrations/` folder
- These add features like suppliers, material orders, expenses, etc.

---

## 📋 STEP-BY-STEP SETUP

### Step 1: Create Supabase Project
1. Go to https://supabase.com
2. Create new project
3. Save credentials:
   - Project URL: `https://xxxxx.supabase.co`
   - Anon Key: `eyJhbGc...`

### Step 2: Configure Environment Variables
Create `.env` file:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_APP_URL=http://localhost:5173
```

---

## 🗄️ REQUIRED SQL #1: Main Database Schema

**Run this in Supabase SQL Editor:**

```sql
-- ============================================================================
-- MAIN DATABASE SCHEMA FOR CRM KANBAN
-- Run this first - creates all core tables
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- COMPANIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  logo_url TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  contractor_license TEXT,
  tagline TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PROFILES TABLE (extends auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  role TEXT DEFAULT 'sales',
  avatar_url TEXT,
  work_email TEXT,
  custom_permissions JSONB,
  ui_prefs JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CONTACTS TABLE (CRM leads/customers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone1 TEXT,
  phone2 TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  status TEXT DEFAULT 'new_lead',
  lead_source TEXT,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  project_type TEXT,
  project_value DECIMAL,
  is_retail BOOLEAN DEFAULT false,
  retail_notes TEXT,
  insurance_company TEXT,
  policy_number TEXT,
  claim_number TEXT,
  adjuster_name TEXT,
  adjuster_phone TEXT,
  deductible DECIMAL,
  notes TEXT,
  tags TEXT[],
  status_changed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- APPOINTMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  type TEXT,
  status TEXT DEFAULT 'scheduled',
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  invoice_number TEXT UNIQUE NOT NULL,
  amount DECIMAL NOT NULL,
  status TEXT DEFAULT 'draft',
  due_date DATE,
  items JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ESTIMATES TABLE (for legal documents)
-- ============================================================================
CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  estimate_number TEXT UNIQUE NOT NULL,
  amount DECIMAL NOT NULL,
  status TEXT DEFAULT 'draft',
  items JSONB,
  notes TEXT,
  signature_data TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- DOCUMENT_TEMPLATES TABLE (for customizable terms)
-- ============================================================================
CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, template_type)
);

-- ============================================================================
-- LEAD_SOURCES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS lead_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_custom BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ACTIVITIES TABLE (audit log)
-- ============================================================================
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned ON contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_status_changed ON contacts(status_changed_at);
CREATE INDEX IF NOT EXISTS idx_appointments_contact ON appointments(contact_id);
CREATE INDEX IF NOT EXISTS idx_appointments_company ON appointments(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contact ON invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_activities_contact ON activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_profiles_custom_permissions ON profiles USING GIN (custom_permissions);
CREATE INDEX IF NOT EXISTS idx_profiles_ui_prefs ON profiles USING GIN (ui_prefs);

-- ============================================================================
-- AUTO-UPDATE TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_estimates_updated_at
  BEFORE UPDATE ON estimates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_templates_updated_at
  BEFORE UPDATE ON document_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
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
    auth.uid() IN (
      SELECT id FROM profiles WHERE company_id = profiles.company_id
    )
  );

DROP POLICY IF EXISTS "Owners and admins can update team member permissions" ON profiles;
CREATE POLICY "Owners and admins can update team member permissions"
  ON profiles FOR UPDATE
  USING (
    auth.uid() = id
    OR auth.uid() IN (
      SELECT id FROM profiles 
      WHERE company_id = profiles.company_id 
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

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Main database schema created successfully!';
  RAISE NOTICE 'Next: Run the Owner Priority View SQL';
END $$;
```

---

## 🗄️ REQUIRED SQL #2: Owner Priority View

**This powers the Owner Priority Board feature:**

```sql
-- ============================================================================
-- OWNER PRIORITY VIEW
-- Powers the intelligent priority board with scoring algorithm
-- ============================================================================

CREATE OR REPLACE VIEW v_owner_priority AS
SELECT 
  c.id,
  c.first_name,
  c.last_name,
  c.status,
  c.project_value,
  c.assigned_to,
  c.updated_at,
  c.company_id,
  
  -- Calculate days stale
  EXTRACT(DAY FROM NOW() - c.status_changed_at)::INTEGER AS days_stale,
  
  -- Determine alert type
  CASE
    WHEN c.status = 'estimate_sent' AND EXTRACT(DAY FROM NOW() - c.status_changed_at) > 7 
      THEN 'stale_estimate'
    WHEN c.status = 'new_lead' AND EXTRACT(DAY FROM NOW() - c.status_changed_at) > 3 
      THEN 'no_touch'
    WHEN c.status = 'estimate_viewed' 
      THEN 'hot_lead'
    ELSE 'normal'
  END AS alert_type,
  
  -- Threshold days for each status
  CASE
    WHEN c.status = 'estimate_sent' THEN 7
    WHEN c.status = 'new_lead' THEN 3
    WHEN c.status = 'estimate_viewed' THEN 1
    ELSE 14
  END AS threshold_days,
  
  -- Calculate priority score (higher = more urgent)
  (
    -- Base score from days stale
    EXTRACT(DAY FROM NOW() - c.status_changed_at)::INTEGER * 10 +
    
    -- Bonus for high project value
    CASE 
      WHEN c.project_value > 50000 THEN 100
      WHEN c.project_value > 25000 THEN 50
      WHEN c.project_value > 10000 THEN 25
      ELSE 0
    END +
    
    -- Bonus for hot leads (estimate viewed)
    CASE WHEN c.status = 'estimate_viewed' THEN 200 ELSE 0 END +
    
    -- Penalty for unassigned
    CASE WHEN c.assigned_to IS NULL THEN 50 ELSE 0 END
  )::INTEGER AS priority_score,
  
  -- Determine concern type
  CASE
    WHEN c.status IN ('invoice_sent', 'partial_payment') 
      AND EXTRACT(DAY FROM NOW() - c.status_changed_at) > 30 
      THEN 'payment'
    ELSE 'sales'
  END AS concern

FROM contacts c
WHERE 
  -- Only show contacts that need attention
  (
    (c.status = 'estimate_sent' AND EXTRACT(DAY FROM NOW() - c.status_changed_at) > 7) OR
    (c.status = 'new_lead' AND EXTRACT(DAY FROM NOW() - c.status_changed_at) > 3) OR
    (c.status = 'estimate_viewed') OR
    (c.status IN ('invoice_sent', 'partial_payment') AND EXTRACT(DAY FROM NOW() - c.status_changed_at) > 30)
  )
ORDER BY priority_score DESC;

-- Grant access to authenticated users
GRANT SELECT ON v_owner_priority TO authenticated;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Owner Priority View created successfully!';
  RAISE NOTICE 'The Owner Priority Board will now show intelligent alerts';
END $$;
```

---

## 🗄️ REQUIRED SQL #3: Storage Buckets

**For logos, avatars, and documents:**

```sql
-- ============================================================================
-- STORAGE BUCKETS SETUP
-- Run this in SQL Editor (Storage buckets must be created first in UI)
-- ============================================================================

-- First, create these buckets in Supabase Dashboard > Storage:
-- 1. company-logos (public)
-- 2. avatars (public)
-- 3. projectceo-documents (private)

-- Then run this SQL to set policies:

-- Company logos bucket policies
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Public company-logos read" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'company-logos');

CREATE POLICY "Authenticated company-logos upload" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'company-logos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated company-logos update" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'company-logos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated company-logos delete" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'company-logos' 
  AND auth.role() = 'authenticated'
);

-- Avatars bucket policies
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Public avatars read" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated avatars upload" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated avatars update" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated avatars delete" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

-- Documents bucket policies (private)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('projectceo-documents', 'projectceo-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE POLICY "Authenticated projectceo-documents read" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'projectceo-documents' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated projectceo-documents upload" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'projectceo-documents' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated projectceo-documents update" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'projectceo-documents' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated projectceo-documents delete" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'projectceo-documents' 
  AND auth.role() = 'authenticated'
);

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Storage buckets and policies configured!';
  RAISE NOTICE 'You can now upload logos, avatars, and documents';
END $$;
```

---

## 🔧 OPTIONAL: Edge Functions

### Edge Function #1: send-email (Optional)

**Only needed if you want to send emails from the app**

**Deploy command:**
```bash
supabase functions deploy send-email
```

**Set secrets:**
```bash
supabase secrets set RESEND_API_KEY=your_resend_api_key
supabase secrets set FROM_EMAIL="Your Company <noreply@yourdomain.com>"
```

**Code is already in:** `supabase/functions/send-email/index.ts`

### Edge Function #2: send-invite-email (Optional)

**Only needed for team member invitations**

**Deploy command:**
```bash
supabase functions deploy send-invite-email
```

**Set secrets:**
```bash
supabase secrets set RESEND_API_KEY=your_resend_api_key
supabase secrets set VITE_APP_URL=https://your-app-url.com
```

**Code is already in:** `supabase/functions/send-invite-email/index.ts`

---

## ✅ VERIFICATION CHECKLIST

After running the SQL scripts, verify:

- [ ] Tables exist in **Table Editor**
  - companies
  - profiles
  - contacts
  - appointments
  - invoices
  - estimates
  - document_templates
  - lead_sources
  - activities

- [ ] View exists: `v_owner_priority`

- [ ] Storage buckets exist:
  - company-logos (public)
  - avatars (public)
  - projectceo-documents (private)

- [ ] RLS is enabled on all tables

- [ ] Triggers are working (check `updated_at` auto-updates)

- [ ] Can create a user and profile is auto-created

---

## 🎯 WHAT EACH PIECE DOES

### Main Schema
- **Core tables** for CRM functionality
- **RLS policies** for data security
- **Triggers** for auto-updating timestamps
- **Indexes** for performance

### Owner Priority View
- **Calculates priority scores** for contacts
- **Identifies stale jobs** (no activity in X days)
- **Detects hot leads** (estimate just viewed)
- **Flags payment issues** (overdue invoices)
- Powers the Owner Priority Board UI

### Storage Buckets
- **company-logos** - Company branding
- **avatars** - User profile photos
- **projectceo-documents** - Signed documents, PDFs

### Edge Functions (Optional)
- **send-email** - Generic email sender (uses Resend API)
- **send-invite-email** - Team invitation emails

---

## 🚨 COMMON ISSUES

### "relation does not exist"
- Run the main schema SQL first
- Check table names are lowercase
- Verify you're in the correct project

### "permission denied for table"
- Enable RLS on the table
- Check RLS policies are created
- Verify user is authenticated

### "Failed to upload"
- Create storage buckets in UI first
- Run storage policies SQL
- Check bucket names match exactly

### Owner Priority Board shows nothing
- Run the view SQL
- Check contacts have `status_changed_at` values
- Verify contacts meet the criteria (stale > X days)

---

## 📚 ADDITIONAL MIGRATIONS (Optional)

The `supabase-migrations/` folder contains additional features:
- Suppliers and material orders
- Commission tracking
- Expenses
- Insurance claims
- Supplements
- OAuth integrations

**Run these only if you need those features.**

---

## ✅ SUMMARY

**Minimum Required:**
1. ✅ Main Database Schema SQL
2. ✅ Owner Priority View SQL
3. ✅ Storage Buckets SQL

**Optional:**
- Edge Functions (only if sending emails)
- Additional migrations (only if using those features)

**After setup, your app will have:**
- Full CRM functionality
- Intelligent Owner Priority Board
- Document templates system
- Signature capture
- File uploads (logos, avatars)
- Multi-tenant security (RLS)

---

**Questions?** Check `SUPABASE_SETUP.md` for detailed troubleshooting.
