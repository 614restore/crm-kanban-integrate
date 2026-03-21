# Database Audit — TrussCTR CRM (2026-03-19)

## Summary
3 critical · 7 high · 8 medium · 4 low — 22 total

---

## CRITICAL (3)

SEVERITY: critical
FILE: supabase-migrations/add-suppliers-orders-estimates.sql lines 481-545
FINDING: Five views (active_suppliers_with_stats, estimates_with_customer, pending_estimates, active_projects_with_stats, work_orders_with_details) are granted SELECT TO authenticated with no company filter. Any logged-in user from any tenant can read all other tenants' estimates, contacts, project budgets, and work order details.
FIX: Recreate views with WITH (security_invoker = true) so underlying table RLS applies, or add explicit WHERE company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()) filters. Revoke the blanket grant until fixed.

SEVERITY: critical
FILE: supabase-migrations/ai-configuration.sql lines 7-8
FINDING: Both ai_configurations.company_id and ai_access_approvals.company_id reference auth.users(id) (a user ID, not a company ID). The RLS policy checks auth.uid() = company_id — scoping config to an individual user, not a company. Team-shared AI configs are broken. Policies also reference a team_members table not seen in any other migration, causing silent RLS failures.
FIX: Change FK to REFERENCES companies(id). Rewrite RLS policies to use EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.company_id = ai_configurations.company_id).

SEVERITY: critical
FILE: src/lib/database.ts lines 648, 741, 972, 1049, 1092, 1151, 1747, 1845, 1924, 1938
FINDING: 10 methods (getContact, getJobsByContact, getInvoiceWithItems, etc.) query records using only a FK ID with no .eq('company_id', companyId) check. If RLS fails for any reason, these return cross-tenant data. Zero application-level defense-in-depth.
FIX: Add companyId parameter to all methods and chain .eq('company_id', companyId).

---

## HIGH (7)

SEVERITY: high
FILE: src/lib/database.ts — 12 update methods (lines 684, 766, 921, 1020, 1208, 1352, 1659, 1710, 1772, 1887, 1963, 2136)
FINDING: No update method includes .eq('company_id', companyId). A valid user who guesses another tenant's record ID can update it if RLS permits — IDOR vulnerability.
FIX: Add companyId param and .eq('company_id', companyId) to all update calls.

SEVERITY: high
FILE: PermitTracker.tsx:282, InsuranceTrackingView.tsx:216/235, SupplementTrackingView.tsx:228, EquipmentView.tsx:319, CrewScheduleView.tsx:169/176/351/358/379/519
FINDING: Direct supabase.from(...).delete().eq('id', ...) calls from component code with no company_id check, no demo-mode guard, no timeout handling, no audit logging.
FIX: Route all mutations through DatabaseService methods that include company_id filtering.

SEVERITY: high
FILE: src/lib/database.ts — 13 delete methods
FINDING: No company_id filter on any delete. All core CRM entities hard-deleted permanently — contacts, estimates, invoices, projects are unrecoverable on accidental or malicious deletion.
FIX: Add .eq('company_id', companyId). Implement soft-delete (deleted_at TIMESTAMPTZ) for contacts, estimates, invoices, and projects.

SEVERITY: high
FILE: supabase-migrations/add-suppliers-orders-estimates.sql lines 54-474
FINDING: Uses the recursive RLS pattern (company_id IN (SELECT company_id FROM profiles WHERE ...)) that caused 42P17 infinite recursion and required fix-recursive-rls-20260308.sql. On a fresh DB without the fix migration, these tables break.
FIX: Update the original migration to use the EXISTS (SELECT 1 FROM profiles WHERE ...) pattern.

SEVERITY: high
FILE: src/lib/database.ts lines 516-537, 588-617
FINDING: SECURITY DEFINER RPC fallbacks for get_my_company and update_my_company bypass RLS. Their implementations are not in this codebase. If they use a session variable rather than auth.uid(), it's an exploitable RLS bypass.
FIX: Audit the Supabase function definitions and confirm auth.uid() scoping. Remove SECURITY DEFINER fallback if direct queries work reliably.

SEVERITY: high
FILE: src/lib/database.ts:2169, src/lib/pdfService.ts:102
FINDING: getPublicUrl() used for expense receipts and contract PDFs. These are financial/legal documents permanently accessible to anyone with the URL — no auth or expiry.
FIX: Replace with createSignedUrl(path, 3600). Store storage paths in DB, generate signed URLs at read time.

SEVERITY: high
FILE: src/lib/database.ts lines 1595-1610
FINDING: The subscribeToAll channel listens on kanban_columns with no filter clause. All column change events from all tenants are broadcast to every subscribed client.
FIX: Add company_id to kanban_columns table and add filter: `company_id=eq.${companyId}` to the subscription.

---

## MEDIUM (8)

SEVERITY: medium
FILE: src/lib/database.ts (29 occurrences)
FINDING: Pervasive .select('*') on list queries — over-fetches signature_data, items JSONB, checklist_items, attachments on every list render.
FIX: Replace with explicit column lists matching what each caller actually uses.

SEVERITY: medium
FILE: src/lib/database.ts — getInvoiceWithItems, getKanbanBoardWithColumns
FINDING: Each makes 2 sequential round-trip queries.
FIX: Use Supabase embedded selects: .select('*, invoice_items(*)') and .select('*, kanban_columns(*)')

SEVERITY: medium
FILE: src/lib/database.ts — createKanbanBoard, createInvoice
FINDING: Create parent then children in separate unguarded queries. If child insert fails, orphaned parent remains with no cleanup.
FIX: Wrap in a Supabase RPC transaction or handle cleanup in the error path.

SEVERITY: medium
FILE: src/lib/database.ts — createInvite
FINDING: Probes two table names (invitations, invites) on every call — 2 sequential network requests, first always fails if wrong table.
FIX: Determine the correct table name and remove the probe pattern.

SEVERITY: medium
FILE: supabase-migrations/
FINDING: work_orders.assigned_to UUID[] has no FK constraint — deleted profiles leave dangling UUIDs silently.
FIX: Add FK constraint or validate on read.

SEVERITY: medium
FILE: src/lib/database.ts — getUnreadNotifications
FINDING: No row limit — unbounded query on every component mount.
FIX: Add .limit(50) or paginate.

SEVERITY: medium
FILE: src/lib/database.ts — getAppointments
FINDING: Makes 2 sequential queries to probe schema variant (start_time vs date/time) on every appointments load. First always fails on legacy schema.
FIX: Standardize the schema and remove the probe pattern.

SEVERITY: medium
FILE: src/lib/database.ts — getDocuments, getSuppliers, getMaterialOrders, getEstimates, getProjects, getWorkOrders
FINDING: Several methods missing demo-mode guard — produce noisy network errors in demo mode.
FIX: Add demo-mode check matching the pattern used in other methods.

---

## LOW (4)

SEVERITY: low
FILE: localStorage company cache
FINDING: Stores stripe_customer_id, stripe_subscription_id, tax_id — not cleared on logout. Sensitive billing data persists on shared devices.
FIX: Clear company cache on sign-out.

SEVERITY: low
FILE: src/lib/database.ts:2169 — uploadExpenseReceipt
FINDING: Uses raw file.name in storage path — user-controlled filename can contain path separators or special characters.
FIX: Sanitize or replace filename with a UUID before using in storage path.

SEVERITY: low
FILE: supabase-migrations/
FINDING: 5+ identical update_<table>_updated_at() trigger functions.
FIX: Create one shared set_updated_at() function and reuse it.

SEVERITY: low
FILE: supabase-migrations/ (missing)
FINDING: expenses and permits table RLS could not be verified — their create migrations are not in the supabase-migrations/ directory.
FIX: Confirm RLS is enabled and policies follow the EXISTS profiles pattern in the Supabase dashboard.
