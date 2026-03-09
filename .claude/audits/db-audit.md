---
agent: db-auditor
status: fail
findings: 12
---

# TrussCTR CRM — Database Audit Report
**Date:** 2026-03-08  
**Scope:** supabase-migrations/, supabase/migrations/, src/lib/database.ts, api/stripe-webhook.mjs

---

## Executive Summary

The database layer has **2 critical bugs** that will directly affect paying customers on day one: the Stripe webhook writes to a table that doesn't exist (subscriptions are never activated), and there is no access control enforcement when trial periods expire or subscriptions lapse. Several lower-severity issues around RLS consistency, missing indexes, and cross-tenant query exposure also need attention.

---

## Findings

---

### FINDING 1 — CRITICAL: Stripe webhook writes to wrong table (`subscriptions` vs `companies`)

**Severity:** CRITICAL  
**File:** [api/stripe-webhook.mjs](../../api/stripe-webhook.mjs)  
**Location:** All `switch` cases in the event handler

**Description:**  
`stripe-webhook.mjs` performs all upsert/update operations against a table named `subscriptions`:

```js
await supabase.from('subscriptions').upsert({ email, stripe_customer_id, plan, status, ... })
await supabase.from('subscriptions').update({ status }).eq('stripe_subscription_id', sub.id)
```

No migration in either `supabase/migrations/` or `supabase-migrations/` creates a `subscriptions` table. The subscription fields (`subscription_plan`, `subscription_status`, `trial_ends_at`, `stripe_customer_id`, `stripe_subscription_id`) were added directly to the `companies` table via `supabase-migrations/add-subscription-plans.sql`.

**Impact:**  
- Every Stripe webhook event (`checkout.session.completed`, `customer.subscription.updated`, `invoice.payment_failed`, etc.) raises a `42P01 relation "subscriptions" does not exist` error.  
- When a customer pays, their company row in `companies` stays at `subscription_status = 'trialing'` indefinitely — they are never upgraded to `'active'`.  
- When a subscription lapses or payment fails, the company is never marked `'past_due'` or `'canceled'`.  
- Revenue recognition and access control are both broken.

**Remediation:**  
Either (a) update the webhook to target `companies` instead, using `stripe_customer_id` or `stripe_subscription_id` as the lookup key, or (b) create the `subscriptions` table and write a bridging function that propagates changes back to `companies`. Option (a) is simpler:

```js
// checkout.session.completed
await supabase
  .from('companies')
  .update({
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    subscription_status: 'active',
    subscription_plan: planId,
  })
  .eq('stripe_customer_id', customerId);

// customer.subscription.updated
await supabase
  .from('companies')
  .update({ subscription_status: sub.status, subscription_plan: planId })
  .eq('stripe_subscription_id', sub.id);
```

You also need to add an index: `CREATE INDEX ON companies (stripe_subscription_id)` and `CREATE INDEX ON companies (stripe_customer_id)` — neither exists today.

---

### FINDING 2 — CRITICAL: No paywall / access enforcement when trial expires or subscription cancels

**Severity:** CRITICAL  
**Files:** [src/components/AppLayout.tsx](../../src/components/AppLayout.tsx), [src/components/crm/SubscriptionView.tsx](../../src/components/crm/SubscriptionView.tsx)

**Description:**  
The only subscription gate in the UI is a dismissable banner shown to `trialing` users (AppLayout.tsx line 330). There is no code that:

- Locks out users when `trial_ends_at` is in the past and `subscription_status` remains `'trialing'`.  
- Restricts any features when `subscription_status` is `'canceled'` or `'past_due'`.  
- Redirects expired users to a billing/upgrade screen.

A full text search for `canceled`, `past_due`, `lockout`, `paywall`, `isExpired` in `src/**/*.tsx` finds only cosmetic label references (SubscriptionView.tsx), never enforcement logic.

**Impact:**  
- After the 14-day trial ends, every user can continue using the product indefinitely for free at full access, since `subscription_status` never changes without the webhook (see Finding 1), and even if it did, there is no gate.  
- Revenue leakage on every customer.

**Remediation:**  
Add a guard in `AppLayout.tsx` or a React context that:
1. Checks `company.subscription_status` and `company.trial_ends_at` on load.
2. If `status === 'trialing'` and `trial_ends_at < now()`, redirect to `/subscription` or show a full-screen upgrade required modal.
3. If `status === 'canceled'` or `status === 'past_due'`, restrict write operations and prompt re-subscribe.

This should be enforced at the RLS level too (a DB-level row-level policy that checks the owning company's subscription status), but at minimum the application layer must block access.

---

### FINDING 3 — HIGH: `getContact`, `getJobsByContact`, `getCommunicationsByContact`, `getDocumentsByContact` have no `company_id` filter

**Severity:** HIGH  
**File:** [src/lib/database.ts](../../src/lib/database.ts)

**Description:**  
The following methods query by a child record ID only, with no `company_id` filter as a safety belt:

| Method | Table | Filter |
|---|---|---|
| `getContact(contactId)` | contacts | `.eq('id', contactId)` only |
| `getJobsByContact(contactId)` | jobs | `.eq('contact_id', contactId)` only |
| `getCommunicationsByContact(contactId)` | communications | `.eq('contact_id', contactId)` only |
| `getDocumentsByContact(contactId)` | documents | `.eq('contact_id', contactId)` only |

RLS policies do enforce `company_id = get_my_company_id()` on these tables, so in normal operation cross-tenant reads are blocked. However if `get_my_company_id()` returns `NULL` (during the window between account creation and profile insertion, or after account deletion), the RLS condition `company_id = NULL` evaluates to false for all rows, silently returning empty data rather than raising an error. **The dangerous case is the inverse:** if Supabase RLS is ever misconfigured, disabled accidentally, or the service role key leaks into client code, these queries would expose cross-tenant data with no additional guard in the application layer.

**Remediation:**  
Add an explicit `company_id` filter to all four methods, matching the pattern used in `getContacts`, `getJobs`, etc.:

```ts
async getContact(contactId: string, companyId: string): Promise<DbContact | null> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .eq('company_id', companyId)  // defense-in-depth
    .single();
  ...
}
```

---

### FINDING 4 — HIGH: v2 PM tables use old recursive RLS pattern instead of `get_my_company_id()`

**Severity:** HIGH  
**File:** [supabase/migrations/20260307_v2_pm_features.sql](../../supabase/migrations/20260307_v2_pm_features.sql)

**Description:**  
The tables created in the v2 PM migration (`crew_schedules`, `change_orders`, `permits`, `equipment`, `equipment_assignments`) all use the old subquery RLS pattern that was identified as causing recursion hangs:

```sql
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
```

The `20260305_fix_all_rls_recursion.sql` migration was created specifically to eliminate this pattern across all tables and replace it with `get_my_company_id()` (a SECURITY DEFINER function). However, the 20260307 migration was applied **after** the fix migration and reintroduces the broken pattern for these 5 tables.

The dynamic rebuilder in the fix migration only runs at the time it is applied; it does not retroactively protect tables created afterward.

**Impact:**  
- Users of crew scheduling, change orders, permits, and equipment features may experience RLS hangs or timeouts.  
- If the subquery on `profiles` hits the recursive policy, all of these features return errors or time out.

**Remediation:**  
Apply a follow-up migration replacing all 5 policies with `get_my_company_id()`:

```sql
-- Example for crew_schedules (repeat for change_orders, permits, equipment, equipment_assignments)
DROP POLICY IF EXISTS "company_members_crew_schedules" ON crew_schedules;
CREATE POLICY "crew_schedules_tenant_select" ON crew_schedules FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());
CREATE POLICY "crew_schedules_tenant_insert" ON crew_schedules FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "crew_schedules_tenant_update" ON crew_schedules FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id()) WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "crew_schedules_tenant_delete" ON crew_schedules FOR DELETE TO authenticated
  USING (company_id = get_my_company_id());
```

---

### FINDING 5 — HIGH: Expense receipt storage bucket allows any authenticated user to read any receipt

**Severity:** HIGH  
**File:** [supabase/migrations/20260308_expenses_table.sql](../../supabase/migrations/20260308_expenses_table.sql)

**Description:**  
The storage policies for `expense-receipts` bucket use only `auth.uid() IS NOT NULL` as the access check:

```sql
CREATE POLICY "expense_receipts_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'expense-receipts' AND auth.uid() IS NOT NULL);
```

Any authenticated user from **any company** can read any other company's expense receipts if they know (or can enumerate) the object path.

**Impact:**  
Potential exposure of financial data (receipts) across tenants — a multi-tenant confidentiality violation.

**Remediation:**  
Scope storage policies with the company folder prefix convention:

```sql
DROP POLICY "expense_receipts_select" ON storage.objects;
CREATE POLICY "expense_receipts_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'expense-receipts'
    AND (storage.foldername(name))[1] = (get_my_company_id())::text
  );
-- Apply same pattern to INSERT and DELETE
```

Ensure receipts are stored under `{company_id}/{filename}` paths in application code.

---

### FINDING 6 — MEDIUM: Missing indexes on `company_id` for 5 core tables

**Severity:** MEDIUM  
**File:** [supabase/migrations/20260306_missing_tables.sql](../../supabase/migrations/20260306_missing_tables.sql)

**Description:**  
The following tables were created without a `company_id` index, which is the primary filter for all tenant-scoped reads and RLS policy evaluation:

| Table | Missing Index |
|---|---|
| `estimates` | `idx_estimates_company_id` |
| `projects` | `idx_projects_company_id` |
| `work_orders` | `idx_work_orders_company_id` |
| `suppliers` | `idx_suppliers_company_id` |
| `material_orders` | `idx_material_orders_company_id` |

By comparison, `insurance_claims`, `supplements`, `expenses`, and `notifications` all correctly create these indexes.

**Impact:**  
As data grows (hundreds of estimates, projects, etc. per company), every list page query and every RLS policy evaluation performs a full table scan on `company_id`. This will slow down predictably with scale.

**Remediation:**

```sql
CREATE INDEX IF NOT EXISTS idx_estimates_company_id ON estimates (company_id);
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON projects (company_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_company_id ON work_orders (company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON suppliers (company_id);
CREATE INDEX IF NOT EXISTS idx_material_orders_company_id ON material_orders (company_id);
```

---

### FINDING 7 — MEDIUM: Missing indexes on `companies.stripe_subscription_id` and `companies.stripe_customer_id`

**Severity:** MEDIUM  
**File:** [supabase-migrations/add-subscription-plans.sql](../../supabase-migrations/add-subscription-plans.sql)

**Description:**  
The `add-subscription-plans.sql` migration adds `stripe_subscription_id` and `stripe_customer_id` columns to `companies` but creates no indexes on them. Once the webhook is fixed (Finding 1) to update `companies` directly, every webhook event will perform a full scan of the `companies` table.

**Remediation:**

```sql
CREATE INDEX IF NOT EXISTS idx_companies_stripe_subscription_id ON companies (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_stripe_customer_id ON companies (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
```

---

### FINDING 8 — MEDIUM: `update_my_company` RPC is missing subscription and branding fields

**Severity:** MEDIUM  
**File:** [supabase/migrations/20260306_fix_company_access.sql](../../supabase/migrations/20260306_fix_company_access.sql)

**Description:**  
The `update_my_company` RPC (used as the primary update path in `database.ts`) only accepts 9 parameters: `name`, `phone`, `email`, `website`, `address`, `city`, `state`, `zip`, `logo_url`. The `database.ts` `updateCompany` method passes 14 fields to the RPC including `tagline`, `contractor_license`, `tax_id`, `from_email`, `from_name` — these are silently dropped by the RPC. The subscription fields (`subscription_plan`, `subscription_status`, etc.) are also not writable via this RPC.

**Impact:**  
- Company branding updates (tagline, license, tax ID, from-name/email) are silently discarded when the RPC succeeds (it falls back to a direct table update, so this currently works, but the RPC path loses data).  
- No admin/webhook path to update subscription status via RPC.

**Remediation:**  
Expand the `update_my_company` RPC signature to include the missing columns, or add a separate `set_my_company_subscription` SECURITY DEFINER function for webhook use.

---

### FINDING 9 — MEDIUM: `handle_new_user` trigger has conflicting definitions across migrations

**Severity:** MEDIUM  
**Files:** [supabase/migrations/20260228183000_roles_rls_and_owner_backfill.sql](../../supabase/migrations/20260228183000_roles_rls_and_owner_backfill.sql), [supabase/migrations/20260306_fix_company_access.sql](../../supabase/migrations/20260306_fix_company_access.sql)

**Description:**  
Two migrations define `handle_new_user()` with conflicting behavior:

- **20260228**: Creates trigger that auto-creates a company + profile.  
- **20260306**: Replaces trigger to create only a profile (no company) — "app handles company creation to avoid duplicates."

The final state (20260306 wins since it is `CREATE OR REPLACE`) is the one in production. However, the behavior difference means: if the 20260306 migration was somehow missed, new signups would get a company auto-created without the subscription defaults from `add-subscription-plans.sql` (since `subscription_plan` defaults to `'trial'` at the column level, this is recoverable, but `trial_ends_at` would be set at INSERT time — correct).

The real risk is the 20260306 version creates a profile with **no `company_id`**, meaning `get_my_company_id()` returns NULL until the app completes its own company setup. During that window, all RLS policies silently deny all reads/writes.

**Remediation:**  
Document the expected sequence in a comment. Consider setting a `company_id = NULL` explicit placeholder that the app then fills in, and ensure the app's company creation path is atomic (or uses a transaction/RPC) to minimize the NULL window.

---

### FINDING 10 — LOW: N+1 patterns in `getInvoiceWithItems` and `getKanbanBoardWithColumns`

**Severity:** LOW  
**File:** [src/lib/database.ts](../../src/lib/database.ts)

**Description:**  
Two methods execute two separate sequential queries where a single JOIN query would suffice:

- `getInvoiceWithItems`: fetches invoice, then items separately.
- `getKanbanBoardWithColumns`: fetches board, then columns separately.

This is a classic N+1 pattern (1 invoice fetch + 1 items fetch = 2 round trips per invoice view).

**Remediation:**  
Supabase supports nested select syntax:

```ts
const { data } = await supabase
  .from('invoices')
  .select('*, invoice_items(*)')
  .eq('id', invoiceId)
  .single();
```

This collapses to one query. Same pattern for `kanban_boards` + `kanban_columns`.

---

### FINDING 11 — LOW: `material_order_items` RLS uses subquery that returns empty on NULL `get_my_company_id()`

**Severity:** LOW  
**File:** [supabase/migrations/20260306_missing_tables.sql](../../supabase/migrations/20260306_missing_tables.sql)

**Description:**  
```sql
CREATE POLICY "material_order_items_select" ON material_order_items
  FOR SELECT USING (
    order_id IN (SELECT id FROM material_orders WHERE company_id = get_my_company_id())
  );
```

When `get_my_company_id()` returns NULL (see Finding 9), the subquery returns an empty set, causing this policy to silently deny all reads. This is safe from a security standpoint but will cause confusing "no data" results for new users completing setup.

**Remediation:**  
This is acceptable as-is once Finding 9 is resolved. Alternatively, add a direct `company_id` column to `material_order_items` for a simpler policy.

---

### FINDING 12 — LOW: `subscription_plan` defaults to `'trial'` but new signups need `trial_ends_at` set correctly

**Severity:** LOW  
**File:** [supabase-migrations/add-subscription-plans.sql](../../supabase-migrations/add-subscription-plans.sql)

**Description:**  
The column default `trial_ends_at DEFAULT (NOW() + INTERVAL '14 days')` is set at the **column definition** level. This applies correctly when a new company row is inserted. However, if `handle_new_user` creates the company row and later the app updates subscription fields, the `trial_ends_at` gets re-evaluated at insert time — which is correct. No issue with new signups.

The potential issue is for **pre-existing companies** in the database before this migration was applied: `add-subscription-plans.sql` uses `ADD COLUMN IF NOT EXISTS ... DEFAULT ...`. PostgreSQL fills existing rows with the default at the time of the `ALTER TABLE` — meaning all pre-existing companies got `trial_ends_at = migration_run_time + 14 days`. This may or may not be intentional (it means all current beta users have the same trial expiry date rather than 14 days from their own signup).

**Remediation:**  
If current beta users should each have their own 14-day trial from when they signed up:

```sql
UPDATE companies
SET trial_ends_at = created_at + INTERVAL '14 days'
WHERE trial_ends_at IS NOT NULL
  AND subscription_status = 'trialing';
```

---

## Answers to Key Questions

| Question | Answer |
|---|---|
| **Multi-tenant isolation at DB level (RLS)?** | Yes — `get_my_company_id()` SECURITY DEFINER function is used consistently across most tables. Exceptions: 5 v2 PM tables still use recursive subquery (Finding 4). |
| **insurance_claims and supplements properly secured?** | Yes — both tables have correct RLS with `get_my_company_id()`, proper indexes, and `company_id` NOT NULL constraint. |
| **subscription_status default for new signups?** | Column default is `'trialing'` ✓. Column default for `trial_ends_at` is `NOW() + 14 days` ✓. But webhook never updates this (Finding 1). |
| **Migrations not applied that would break features?** | `supabase-migrations/add-subscription-plans.sql` must be applied (just done). All `supabase/migrations/` files up to `20260308` must also be applied. No verification tooling exists to confirm which have run. |
| **What happens when trial expires?** | User sees a banner only. **No lockout occurs.** They retain full access indefinitely (Finding 2). |
| **Does Stripe webhook properly update companies table?** | **No** — writes to non-existent `subscriptions` table (Finding 1, CRITICAL). |

---

## Metrics

| Category | Count |
|---|---|
| Critical findings | 2 |
| High findings | 3 |
| Medium findings | 4 |
| Low findings | 3 |
| Tables reviewed | 22 |
| Tables with RLS enabled | 22 (all) |
| Tables using correct `get_my_company_id()` pattern | 17 |
| Tables using old recursive subquery pattern | 5 (crew_schedules, change_orders, permits, equipment, equipment_assignments) |
| Tables missing `company_id` index | 5 |
| Webhook events silently failing | 6 (all events) |
