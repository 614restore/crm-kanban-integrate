-- ============================================================
-- FIX: Recursive RLS policies on 6 tables (B01)
-- The 20260307_v2_pm_features.sql and 20260307_company_integrations.sql
-- migrations used:
--   company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
-- which triggers infinite recursion (42P17) because profiles itself
-- has an RLS policy that reads profiles.
--
-- Fix: use EXISTS with a lateral reference instead of IN (subquery),
-- or use auth.jwt() -> 'company_id' if available. Safest fix is EXISTS.
-- ============================================================

-- ── crew_schedules ───────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_crew_schedules" ON crew_schedules;
CREATE POLICY "company_members_crew_schedules"
  ON crew_schedules FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = crew_schedules.company_id
  ));

-- ── change_orders ────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_change_orders" ON change_orders;
CREATE POLICY "company_members_change_orders"
  ON change_orders FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = change_orders.company_id
  ));

-- ── permits ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_permits" ON permits;
CREATE POLICY "company_members_permits"
  ON permits FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = permits.company_id
  ));

-- ── equipment ────────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_equipment" ON equipment;
CREATE POLICY "company_members_equipment"
  ON equipment FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = equipment.company_id
  ));

-- ── equipment_assignments ────────────────────────────────────
DROP POLICY IF EXISTS "company_members_equipment_assignments" ON equipment_assignments;
CREATE POLICY "company_members_equipment_assignments"
  ON equipment_assignments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = equipment_assignments.company_id
  ));

-- ── contacts ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view their company contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert their company contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update their company contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete their company contacts" ON contacts;
DROP POLICY IF EXISTS "company_members_contacts" ON contacts;
DROP POLICY IF EXISTS "contacts_select_policy" ON contacts;
DROP POLICY IF EXISTS "contacts_insert_policy" ON contacts;
DROP POLICY IF EXISTS "contacts_update_policy" ON contacts;
DROP POLICY IF EXISTS "contacts_delete_policy" ON contacts;
DROP POLICY IF EXISTS "Enable read access for company members" ON contacts;
DROP POLICY IF EXISTS "Enable insert for company members" ON contacts;
DROP POLICY IF EXISTS "Enable update for company members" ON contacts;
DROP POLICY IF EXISTS "Enable delete for company members" ON contacts;

CREATE POLICY "company_members_contacts"
  ON contacts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = contacts.company_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = contacts.company_id
  ));

-- ── appointments ──────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_appointments" ON appointments;
DROP POLICY IF EXISTS "Users can view their company appointments" ON appointments;
DROP POLICY IF EXISTS "Users can insert their company appointments" ON appointments;
DROP POLICY IF EXISTS "Users can update their company appointments" ON appointments;
DROP POLICY IF EXISTS "Users can delete their company appointments" ON appointments;

CREATE POLICY "company_members_appointments"
  ON appointments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = appointments.company_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = appointments.company_id
  ));

-- ── company_integrations ─────────────────────────────────────
DROP POLICY IF EXISTS "company_members_read_integrations" ON company_integrations;
DROP POLICY IF EXISTS "company_admins_write_integrations" ON company_integrations;

CREATE POLICY "company_members_read_integrations"
  ON company_integrations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = company_integrations.company_id
  ));

CREATE POLICY "company_admins_write_integrations"
  ON company_integrations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = company_integrations.company_id
  ));

-- ── invoices ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_invoices" ON invoices;
DROP POLICY IF EXISTS "Users can view their company invoices" ON invoices;
DROP POLICY IF EXISTS "Users can insert their company invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update their company invoices" ON invoices;
DROP POLICY IF EXISTS "Users can delete their company invoices" ON invoices;

CREATE POLICY "company_members_invoices"
  ON invoices FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = invoices.company_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = invoices.company_id
  ));

-- ── invoice_items ─────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_invoice_items" ON invoice_items;
DROP POLICY IF EXISTS "Users can view their company invoice_items" ON invoice_items;
DROP POLICY IF EXISTS "Users can insert their company invoice_items" ON invoice_items;
DROP POLICY IF EXISTS "Users can update their company invoice_items" ON invoice_items;
DROP POLICY IF EXISTS "Users can delete their company invoice_items" ON invoice_items;

CREATE POLICY "company_members_invoice_items"
  ON invoice_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM invoices
    WHERE invoices.id = invoice_items.invoice_id
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.company_id = invoices.company_id
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM invoices
    WHERE invoices.id = invoice_items.invoice_id
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.company_id = invoices.company_id
      )
  ));

-- ── jobs ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_jobs" ON jobs;
DROP POLICY IF EXISTS "Users can view their company jobs" ON jobs;
DROP POLICY IF EXISTS "Users can insert their company jobs" ON jobs;
DROP POLICY IF EXISTS "Users can update their company jobs" ON jobs;
DROP POLICY IF EXISTS "Users can delete their company jobs" ON jobs;

CREATE POLICY "company_members_jobs"
  ON jobs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = jobs.company_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = jobs.company_id
  ));

-- ── work_orders ───────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_work_orders" ON work_orders;
DROP POLICY IF EXISTS "Users can view their company work_orders" ON work_orders;
DROP POLICY IF EXISTS "Users can insert their company work_orders" ON work_orders;
DROP POLICY IF EXISTS "Users can update their company work_orders" ON work_orders;
DROP POLICY IF EXISTS "Users can delete their company work_orders" ON work_orders;

CREATE POLICY "company_members_work_orders"
  ON work_orders FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = work_orders.company_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = work_orders.company_id
  ));

-- ── communications ────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_communications" ON communications;
DROP POLICY IF EXISTS "Users can view their company communications" ON communications;
DROP POLICY IF EXISTS "Users can insert their company communications" ON communications;
DROP POLICY IF EXISTS "Users can update their company communications" ON communications;
DROP POLICY IF EXISTS "Users can delete their company communications" ON communications;

CREATE POLICY "company_members_communications"
  ON communications FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = communications.company_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = communications.company_id
  ));

-- ── documents ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_documents" ON documents;
DROP POLICY IF EXISTS "Users can view their company documents" ON documents;
DROP POLICY IF EXISTS "Users can insert their company documents" ON documents;
DROP POLICY IF EXISTS "Users can update their company documents" ON documents;
DROP POLICY IF EXISTS "Users can delete their company documents" ON documents;

CREATE POLICY "company_members_documents"
  ON documents FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = documents.company_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = documents.company_id
  ));

-- ── notifications ─────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view their company notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert their company notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their company notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their company notifications" ON notifications;

CREATE POLICY "company_members_notifications"
  ON notifications FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = notifications.company_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = notifications.company_id
  ));

-- ── kanban_boards ─────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_kanban_boards" ON kanban_boards;
DROP POLICY IF EXISTS "Users can view their company kanban_boards" ON kanban_boards;
DROP POLICY IF EXISTS "Users can insert their company kanban_boards" ON kanban_boards;
DROP POLICY IF EXISTS "Users can update their company kanban_boards" ON kanban_boards;
DROP POLICY IF EXISTS "Users can delete their company kanban_boards" ON kanban_boards;

CREATE POLICY "company_members_kanban_boards"
  ON kanban_boards FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = kanban_boards.company_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = kanban_boards.company_id
  ));

-- ── kanban_columns ────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_kanban_columns" ON kanban_columns;
DROP POLICY IF EXISTS "Users can view their company kanban_columns" ON kanban_columns;
DROP POLICY IF EXISTS "Users can insert their company kanban_columns" ON kanban_columns;
DROP POLICY IF EXISTS "Users can update their company kanban_columns" ON kanban_columns;
DROP POLICY IF EXISTS "Users can delete their company kanban_columns" ON kanban_columns;

CREATE POLICY "company_members_kanban_columns"
  ON kanban_columns FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = kanban_columns.company_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = kanban_columns.company_id
  ));

-- ── expenses ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_expenses" ON expenses;
DROP POLICY IF EXISTS "Users can view their company expenses" ON expenses;
DROP POLICY IF EXISTS "Users can insert their company expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update their company expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete their company expenses" ON expenses;

CREATE POLICY "company_members_expenses"
  ON expenses FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = expenses.company_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = expenses.company_id
  ));

-- ── estimates ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_estimates" ON estimates;
DROP POLICY IF EXISTS "Users can view their company estimates" ON estimates;
DROP POLICY IF EXISTS "Users can insert their company estimates" ON estimates;
DROP POLICY IF EXISTS "Users can update their company estimates" ON estimates;
DROP POLICY IF EXISTS "Users can delete their company estimates" ON estimates;

CREATE POLICY "company_members_estimates"
  ON estimates FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = estimates.company_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = estimates.company_id
  ));

-- estimate_items: stored as JSONB in estimates table — no separate table

-- ── material_orders ───────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_material_orders" ON material_orders;
DROP POLICY IF EXISTS "Users can view their company material_orders" ON material_orders;
DROP POLICY IF EXISTS "Users can insert their company material_orders" ON material_orders;
DROP POLICY IF EXISTS "Users can update their company material_orders" ON material_orders;
DROP POLICY IF EXISTS "Users can delete their company material_orders" ON material_orders;

CREATE POLICY "company_members_material_orders"
  ON material_orders FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = material_orders.company_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = material_orders.company_id
  ));

-- material_order_items: stored as JSONB in material_orders table — no separate table

-- ── suppliers ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can view their company suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can insert their company suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can update their company suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can delete their company suppliers" ON suppliers;

CREATE POLICY "company_members_suppliers"
  ON suppliers FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = suppliers.company_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = suppliers.company_id
  ));

-- ── automations ───────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_automations" ON automations;
DROP POLICY IF EXISTS "Users can view their company automations" ON automations;
DROP POLICY IF EXISTS "Users can insert their company automations" ON automations;
DROP POLICY IF EXISTS "Users can update their company automations" ON automations;
DROP POLICY IF EXISTS "Users can delete their company automations" ON automations;

CREATE POLICY "company_members_automations"
  ON automations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = automations.company_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = automations.company_id
  ));

-- ── lead_sources ──────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_lead_sources" ON lead_sources;
DROP POLICY IF EXISTS "Users can view their company lead_sources" ON lead_sources;
DROP POLICY IF EXISTS "Users can insert their company lead_sources" ON lead_sources;
DROP POLICY IF EXISTS "Users can update their company lead_sources" ON lead_sources;
DROP POLICY IF EXISTS "Users can delete their company lead_sources" ON lead_sources;

CREATE POLICY "company_members_lead_sources"
  ON lead_sources FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = lead_sources.company_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = lead_sources.company_id
  ));

-- ── projects ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "company_members_projects" ON projects;
DROP POLICY IF EXISTS "Users can view their company projects" ON projects;
DROP POLICY IF EXISTS "Users can insert their company projects" ON projects;
DROP POLICY IF EXISTS "Users can update their company projects" ON projects;
DROP POLICY IF EXISTS "Users can delete their company projects" ON projects;

CREATE POLICY "company_members_projects"
  ON projects FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = projects.company_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.company_id = projects.company_id
  ));

-- ============================================================
-- FIX: Expense receipts storage bucket isolation (B02)
-- Add company-scoped storage policies so users can only access
-- their own company's receipts. Path convention: {company_id}/{filename}
-- ============================================================

-- Remove any existing policies on expense-receipts (including previously created ones)
DROP POLICY IF EXISTS "allow_all_expense_receipts" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_expense_receipts" ON storage.objects;
DROP POLICY IF EXISTS "expense_receipts_select" ON storage.objects;
DROP POLICY IF EXISTS "expense_receipts_insert" ON storage.objects;
DROP POLICY IF EXISTS "expense_receipts_delete" ON storage.objects;

-- SELECT: users can only read files in their own company's folder
CREATE POLICY "expense_receipts_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (storage.foldername(name))[1] = profiles.company_id::text
    )
  );

-- INSERT: users can only upload to their own company's folder
CREATE POLICY "expense_receipts_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'expense-receipts'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (storage.foldername(name))[1] = profiles.company_id::text
    )
  );

-- DELETE: users can only delete their own company's files
CREATE POLICY "expense_receipts_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (storage.foldername(name))[1] = profiles.company_id::text
    )
  );
