---
agent: db-auditor
status: fail
findings: 12
---

# Database Layer Audit — TrussCTR CRM
**Date:** 2026-03-08  
**Auditor:** db-auditor agent  
**Scope:** `src/lib/database.ts`, `src/lib/authContext.tsx`, `supabase/`, `supabase-migrations/`, component-level DB access

---

## Summary

The database layer shows **mature architecture** with a proper `DatabaseService` class, `get_my_company_id()` SECURITY DEFINER helper, and thorough migration history. However, **6 newer tables added after the main RLS hardening migration reintroduced the recursive RLS bug** that was explicitly fixed in `20260305_fix_all_rls_recursion.sql`. Storage bucket policies leak cross-company data. Five high-traffic tables added in migration `20260306_missing_tables.sql` have **zero indexes**. Twelve component-side direct Supabase calls bypass the centralised `DatabaseService`.

**Risk level: HIGH** — two production-impacting paths (RLS recursion + storage data leak).

---

## Findings

---

### FINDING-01 — CRITICAL | 6 Tables Using Recursive RLS Pattern
**File:** `supabase/migrations/20260307_v2_pm_features.sql` (lines 41–184), `supabase/migrations/20260307_company_integrations.sql` (lines 25–56)  
**Tables affected:** `crew_schedules`, `change_orders`, `permits`, `equipment`, `equipment_assignments`, `company_integrations`

All 6 tables were added **after** `20260305_fix_all_rls_recursion.sql` and use the old banned recursive subquery pattern:

```sql
-- OLD / BROKEN pattern (re-introduced in v2_pm_features.sql)
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
)
```

The root-cause fix migration explicitly replaced this pattern with `public.get_my_company_id()` (SECURITY DEFINER, no recursion) for all existing tables. These six tables were created afterward and missed that update, meaning any query against them can trigger a PostgreSQL error `42P17` (infinite recursion) under load, exactly as the original bug did.

**Remediation:** Run a follow-up migration to drop and recreate all policies on these 6 tables using `get_my_company_id()`:

```sql
-- Example fix pattern (repeat for each affected table)
DROP POLICY IF EXISTS "company_members_crew_schedules" ON crew_schedules;
CREATE POLICY crew_schedules_tenant_select ON crew_schedules FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());
CREATE POLICY crew_schedules_tenant_insert ON crew_schedules FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());
CREATE POLICY crew_schedules_tenant_update ON crew_schedules FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());
CREATE POLICY crew_schedules_tenant_delete ON crew_schedules FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());
-- Repeat for: change_orders, permits, equipment, equipment_assignments, company_integrations
```

---

### FINDING-02 — HIGH | Storage Bucket: Cross-Company Expense Receipt Exposure
**File:** `supabase/migrations/20260308_expenses_table.sql` (lines 56–67)

The `expense-receipts` storage bucket policies check only `auth.uid() IS NOT NULL`, meaning **any authenticated user from any company** can read and insert expense receipts:

```sql
-- INSECURE
CREATE POLICY "expense_receipts_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'expense-receipts' AND auth.uid() IS NOT NULL);

CREATE POLICY "expense_receipts_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'expense-receipts' AND auth.uid() IS NOT NULL);
```

There is no company isolation on these storage objects. A user from Company A could read receipt files uploaded by Company B if they know/guess the storage path.

**Remediation:** Enforce a path-based tenant prefix (e.g., `{company_id}/receipts/`) and lock storage policies to that prefix:

```sql
DROP POLICY IF EXISTS "expense_receipts_select" ON storage.objects;
DROP POLICY IF EXISTS "expense_receipts_insert" ON storage.objects;
DROP POLICY IF EXISTS "expense_receipts_delete" ON storage.objects;

CREATE POLICY "expense_receipts_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'expense-receipts'
    AND (storage.foldername(name))[1] = public.get_my_company_id()::text
  );
CREATE POLICY "expense_receipts_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'expense-receipts'
    AND (storage.foldername(name))[1] = public.get_my_company_id()::text
  );
CREATE POLICY "expense_receipts_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'expense-receipts'
    AND (storage.foldername(name))[1] = public.get_my_company_id()::text
  );
```

On the upload side, prefix the storage path with `${companyId}/receipts/filename`.

---

### FINDING-03 — HIGH | Missing Indexes on 5 Major Tables
**File:** `supabase/migrations/20260306_missing_tables.sql` (entire file has no `CREATE INDEX` statements)

Tables `estimates`, `projects`, `work_orders`, `suppliers`, and `material_orders` were created with zero explicit indexes beyond their primary keys. The `setup.sql` baseline creates indexes for the original tables, but this migration omitted them entirely.

| Table | Unindexed FK columns | Impact |
|-------|---------------------|--------|
| `estimates` | `contact_id`, `job_id`, `created_by` | Slow contact detail loads |
| `projects` | `contact_id`, `estimate_id`, `project_manager_id` | No index on FK joins |
| `work_orders` | `project_id`, `contact_id`, `created_by` | Full scan on project/contact lookup |
| `suppliers` | `company_id` | Seq scan on all tenant lookups |
| `material_orders` | `supplier_id`, `contact_id`, `project_id` | Slow order listings |
| `material_order_items` | `order_id` | Sequential scan on every items fetch |

**Remediation:**

```sql
-- estimates
CREATE INDEX IF NOT EXISTS idx_estimates_company   ON estimates (company_id);
CREATE INDEX IF NOT EXISTS idx_estimates_contact   ON estimates (contact_id);
CREATE INDEX IF NOT EXISTS idx_estimates_job       ON estimates (job_id);

-- projects
CREATE INDEX IF NOT EXISTS idx_projects_company    ON projects (company_id);
CREATE INDEX IF NOT EXISTS idx_projects_contact    ON projects (contact_id);
CREATE INDEX IF NOT EXISTS idx_projects_estimate   ON projects (estimate_id);

-- work_orders
CREATE INDEX IF NOT EXISTS idx_work_orders_company ON work_orders (company_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_project ON work_orders (project_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_contact ON work_orders (contact_id);

-- suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_company   ON suppliers (company_id);

-- material_orders
CREATE INDEX IF NOT EXISTS idx_material_orders_supplier ON material_orders (supplier_id);
CREATE INDEX IF NOT EXISTS idx_material_orders_contact  ON material_orders (contact_id);
CREATE INDEX IF NOT EXISTS idx_material_orders_project  ON material_orders (project_id);

-- material_order_items
CREATE INDEX IF NOT EXISTS idx_material_order_items_order ON material_order_items (order_id);
```

---

### FINDING-04 — HIGH | N+1 Pattern on Contact Detail Page
**File:** `src/lib/database.ts` (multiple methods)

The contact detail view triggers these separate database round-trips:

1. `getContact(id)` — 1 query
2. `getJobsByContact(id)` — 1 query  
3. `getCommunicationsByContact(id)` — 1 query
4. `getDocumentsByContact(id)` — 1 query
5. `getEstimatesByContact(id)` — 1 query
6. `getProjectsByContact(id)` — 1 query
7. `getWorkOrdersByContact(id)` — 1 query

That is **7 sequential queries** per contact open. Once pagination on the contacts list is removed or large lists are used, this pattern multiplies (classic N+1).

Similarly, `getKanbanBoardWithColumns()` and `getInvoiceWithItems()` each make 2 queries that could be collapsed to 1 using Supabase nested selects.

**Remediation:**

```typescript
// Replace 7 individual calls with a single composite fetch:
async getContactWithRelated(contactId: string) {
  const [contact, jobs, comms, docs, estimates, projects, workOrders] = await Promise.all([
    supabase.from('contacts').select('*').eq('id', contactId).single(),
    supabase.from('jobs').select('*').eq('contact_id', contactId),
    supabase.from('communications').select('*').eq('contact_id', contactId),
    supabase.from('documents').select('*').eq('contact_id', contactId),
    supabase.from('estimates').select('*').eq('contact_id', contactId),
    supabase.from('projects').select('*').eq('contact_id', contactId),
    supabase.from('work_orders').select('*').eq('contact_id', contactId),
  ]);
  // Handle errors and return composite object
}

// Or use Supabase PostgREST nested selects:
supabase.from('contacts')
  .select('*, jobs(*), estimates(*), projects(*)')
  .eq('id', contactId)
  .single()
```

---

### FINDING-05 — HIGH | 12 Direct Supabase Calls Bypassing DatabaseService
**Files:** Multiple component files

The following components call `supabase.from()` directly, bypassing `DatabaseService` and losing timeout protection, demo-mode handling, and centralised error logging:

| File | Operations |
|------|-----------|
| `src/components/crm/TeamView.tsx:323` | `invitations.delete` |
| `src/components/crm/InsuranceTrackingView.tsx:216,235` | `insurance_claims.insert`, `.delete` |
| `src/components/crm/SupplementTrackingView.tsx:209,228` | `supplements.insert`, `.delete` |
| `src/components/crm/EquipmentView.tsx:319` | `equipment.delete` |
| `src/components/crm/CrewScheduleView.tsx:160` | `crew_schedules.insert` |
| `src/components/crm/PermitTracker.tsx:279` | `permits.delete` |
| `src/components/crm/SettingsView.tsx:619,646,785,826` | RPCs (acceptable) |

These direct calls also **lack the `raceTimeout` wrapper**, so any of them can hang indefinitely.

**Remediation:** Add corresponding methods to `DatabaseService` for insurance_claims, supplements, equipment, crew_schedules, and permits. Replace all direct calls.

---

### FINDING-06 — MEDIUM | `getContact()` Has No Company Filter (Application Layer)
**File:** `src/lib/database.ts` (line ~637)

```typescript
async getContact(contactId: string): Promise<DbContact | null> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)   // ← no company_id filter
    .single();
```

This relies 100% on RLS for tenant isolation. RLS should protect it, but:
- If RLS is accidentally disabled on `contacts` during a migration, this returns data for any company.
- There is no application-layer check that the returned contact belongs to the calling user's company.

**Remediation:** Add `.eq('company_id', companyId)` as a defensive second filter (companyId should be passed as a parameter). Same applies to `getJobsByContact`, `getCommunicationsByContact`, `getDocumentsByContact`, `getEstimatesByContact`, `getProjectsByContact`, and `getWorkOrdersByContact`.

---

### FINDING-07 — MEDIUM | Inconsistent Error Handling in DatabaseService
**File:** `src/lib/database.ts`

Error handling is inconsistent across methods:

- `createContact()` — **throws** on error ✓
- `createJob()` — returns `null` (caller cannot distinguish DB error from empty result)
- `createMaterialOrder()` — returns `null`
- `getDocumentsByContact()` — **no `raceTimeout`** (can hang indefinitely)
- `getCommunicationsByContact()` — **no `raceTimeout`**
- `getDocuments()` — **no `raceTimeout`**
- `deleteDocument()` — **no `raceTimeout`**
- `deleteEstimate()` — **no `raceTimeout`**
- `getTeamMembers()` — **no `raceTimeout`** (can hang, blocks the team settings page)

**Remediation:** Apply `raceTimeout` consistently to all async DB operations. Standardise on a `{ data, error }` return type or always throw — don't mix both.

---

### FINDING-08 — MEDIUM | `company_integrations` Write Policy: FOR ALL with Recursive Pattern
**File:** `supabase/migrations/20260307_company_integrations.sql` (lines 38–56)

The write policy uses `FOR ALL` (covers SELECT + INSERT + UPDATE + DELETE) combined with a recursive subquery, AND the more-specific read policy (`company_members_read_integrations`) also uses the same recursive pattern. Additionally, using `FOR ALL` overrides the specific read policy for owners:

```sql
-- PROBLEM: Two overlapping policies + recursive pattern
CREATE POLICY "company_members_read_integrations" FOR SELECT ...
CREATE POLICY "company_admins_write_integrations" FOR ALL ...
```

With `FOR ALL` on the write policy, owners can also SELECT via the write policy path without needing the read policy, making the intent ambiguous and harder to audit.

**Remediation:** Split into explicit INSERT/UPDATE/DELETE policies, remove FOR ALL, and replace both subqueries with `get_my_company_id()`.

---

### FINDING-09 — LOW | `companies_insert` Policy in setup.sql is Permissive
**File:** `supabase/setup.sql` (around line 340)

```sql
CREATE POLICY "Users can insert companies"
  ON companies FOR INSERT
  WITH CHECK (true);  -- ← any authenticated user can create a company
```

This allows any logged-in user to create unlimited companies. The hardening migration in `20260225173000` replaces this with `companies_insert_authenticated` which checks `get_my_company_id() IS NULL`, but `setup.sql` is the "fresh install" reference and could mislead future developers or be accidentally re-run.

**Remediation:** Update `setup.sql` to mirror the hardened policy.

---

### FINDING-10 — LOW | Realtime Channel Not Filtered for `kanban_columns`
**File:** `src/lib/database.ts` (line ~1541)

```typescript
channel.on(
  'postgres_changes',
  { event: '*', schema: 'public', table: 'kanban_columns' },  // ← no filter
  callbacks.onBoardChange
);
```

`kanban_columns` has no `company_id` column (scoped via `board_id`), so no server-side filter can be applied here. This means the realtime subscription receives column change events for ALL companies' kanban boards. RLS applies to the initial data fetch but **not to realtime payload content** in Supabase's postgres_changes events.

**Remediation:** Subscribe to `kanban_boards` changes (which are filtered by `company_id`) and re-fetch columns on board change, rather than subscribing directly to unfiltered `kanban_columns` events.

---

### FINDING-11 — LOW | Appointment Schema Dual-Mode Increases Query Overhead
**File:** `src/lib/database.ts` (`getAppointments`, lines ~795–840)

The code handles both legacy (`date`/`time`/`duration`) and new (`start_time`/`end_time`) schemas with a fallback:

```typescript
const tryFetch = async (orderBy: 'date' | 'start_time') => ...
const startTimeResult = await tryFetch('start_time');
if (startTimeResult.error) {
  const dateResult = await tryFetch('date');  // ← second query on every production load if schema is found
}
```

If `start_time` column exists but `date` does not, this works as two queries on error path. But if `date` column was dropped, the fallback query will always error silently, doubling latency.

**Remediation:** Once the `date`/`time` legacy columns are confirmed removed from production, delete the fallback branch.

---

### FINDING-12 — LOW | `invoice_items` and `material_order_items` Use FK-Join RLS (Performance)
**File:** `supabase/migrations/20260305_fix_all_rls_recursion.sql` (lines 228–234), `supabase/migrations/20260306_missing_tables.sql`

Both `invoice_items` and `material_order_items` scope access via a subquery JOIN to the parent table:

```sql
-- Runs on EVERY row access
USING (EXISTS (
  SELECT 1 FROM public.invoices i
  WHERE i.id = invoice_items.invoice_id
    AND i.company_id = public.get_my_company_id()
))
```

This is functionally correct but adds a correlated subquery to every row check. With indexes on `invoices(id, company_id)` and `material_orders(id, company_id)` this is manageable, but note that `invoices` currently only has an index on `contact_id`, not a composite on `(id, company_id)`.

**Remediation:** Add composite indexes:
```sql
CREATE INDEX IF NOT EXISTS idx_invoices_id_company ON invoices (id, company_id);
CREATE INDEX IF NOT EXISTS idx_material_orders_id_company ON material_orders (id, company_id);
```

---

## RLS Coverage Map

| Table | RLS Enabled | Policy Pattern | Status |
|-------|-------------|---------------|--------|
| `companies` | ✅ | `get_my_company_id()` | ✅ Safe |
| `profiles` | ✅ | `get_my_company_id()` | ✅ Safe |
| `contacts` | ✅ | `get_my_company_id()` | ✅ Safe |
| `jobs` | ✅ | `get_my_company_id()` | ✅ Safe |
| `appointments` | ✅ | `get_my_company_id()` | ✅ Safe |
| `invoices` | ✅ | `get_my_company_id()` | ✅ Safe |
| `invoice_items` | ✅ | FK JOIN via `get_my_company_id()` | ✅ Safe |
| `communications` | ✅ | `get_my_company_id()` | ✅ Safe |
| `documents` | ✅ | `get_my_company_id()` | ✅ Safe |
| `kanban_boards` | ✅ | `get_my_company_id()` | ✅ Safe |
| `kanban_columns` | ✅ | EXISTS join | ✅ Safe |
| `lead_sources` | ✅ | `get_my_company_id()` | ✅ Safe |
| `automations` | ✅ | `get_my_company_id()` | ✅ Safe |
| `activities` | ✅ | `get_my_company_id()` | ✅ Safe |
| `estimates` | ✅ | `get_my_company_id()` | ✅ Safe |
| `projects` | ✅ | `get_my_company_id()` | ✅ Safe |
| `work_orders` | ✅ | `get_my_company_id()` | ✅ Safe |
| `suppliers` | ✅ | `get_my_company_id()` | ✅ Safe |
| `material_orders` | ✅ | `get_my_company_id()` | ✅ Safe |
| `material_order_items` | ✅ | FK JOIN | ✅ Safe |
| `expenses` | ✅ | `get_my_company_id()` | ✅ Safe |
| `notifications` | ✅ | `get_my_company_id()` | ✅ Safe |
| `insurance_claims` | ✅ | `get_my_company_id()` | ✅ Safe |
| `supplements` | ✅ | `get_my_company_id()` | ✅ Safe |
| `crew_schedules` | ✅ | **RECURSIVE SUBQUERY** | ❌ Bug |
| `change_orders` | ✅ | **RECURSIVE SUBQUERY** | ❌ Bug |
| `permits` | ✅ | **RECURSIVE SUBQUERY** | ❌ Bug |
| `equipment` | ✅ | **RECURSIVE SUBQUERY** | ❌ Bug |
| `equipment_assignments` | ✅ | **RECURSIVE SUBQUERY** | ❌ Bug |
| `company_integrations` | ✅ | **RECURSIVE SUBQUERY** | ❌ Bug |
| `invitations`/`invites` | ✅ (enabled) | Policies via tenant hardening | ⚠️ Verify in production |
| `storage.objects` (expense-receipts) | N/A | `auth.uid() IS NOT NULL` | ❌ No tenant isolation |

---

## Prioritised Remediation Checklist

| Priority | Finding | Effort | Risk if Unaddressed |
|----------|---------|--------|-------------------|
| 🔴 P0 | FINDING-01: Fix recursive RLS on 6 tables | Low (1 migration) | Application 500 errors under normal load |
| 🔴 P0 | FINDING-02: Storage receipt isolation | Low (1 migration + upload path prefix) | Cross-company data leak |
| 🟠 P1 | FINDING-03: Add missing indexes (5 tables) | Low (1 migration) | Degraded performance at scale |
| 🟠 P1 | FINDING-04: N+1 contact detail queries | Medium (refactor) | Slow UX at 100+ contacts |
| 🟠 P1 | FINDING-05: Direct Supabase calls in components | Medium (move to DatabaseService) | No timeout protection, no demo mode |
| 🟡 P2 | FINDING-06: Add company_id filter to getContact() | Low | Defense-in-depth gap |
| 🟡 P2 | FINDING-07: Inconsistent error handling / missing raceTimeout | Medium | Silent hangs, mixed error contracts |
| 🟡 P2 | FINDING-08: company_integrations FOR ALL policy | Low | Policy overlap / audit confusion |
| 🟢 P3 | FINDING-09: setup.sql permissive insert | Low | Developer footgun |
| 🟢 P3 | FINDING-10: Unfiltered realtime on kanban_columns | Low | Potential data leakage via realtime |
| 🟢 P3 | FINDING-11: Appointment dual-schema fallback | Low | Extra query latency |
| 🟢 P3 | FINDING-12: Composite indexes for FK-join RLS | Low | Minor query overhead |

---

## Metrics

- **Total tables audited:** 31
- **Tables with RLS enabled:** 31/31 (100%)
- **Tables with correct tenant-safe RLS:** 25/31 (81%)
- **Tables with recursive/insecure RLS:** 6/31 (19%)
- **Storage buckets with proper isolation:** 0/1 for expense-receipts
- **Missing index groups:** 6 tables
- **Direct component DB calls (bypassing DatabaseService):** ~12
- **Methods missing raceTimeout:** ~8
