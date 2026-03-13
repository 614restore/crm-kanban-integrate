-- ============================================================================
-- STEP 3: CREATE INDEXES
-- Run this after Step 2
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
