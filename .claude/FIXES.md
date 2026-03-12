---
agent: fix-planner
status: fail
findings: 43
date: 2026-03-08
sources: bug-audit-2.md, ui-audit-2.md, security-audit-2.md, db-audit-2.md, infra-audit-2.md
previously-fixed: auth-middleware, stripe-webhook validation, stripe-portal IDOR, XSS, debug-env, detectSessionInUrl, APP_URL hard-fail, paywall gate (base), legal links, FIX-H02 (template safety)
---

# FIXES.md — TrussCTR CRM (Round 2)
**Date:** 2026-03-08
**New findings only** — previously resolved issues excluded per scope.

---

## Summary

| Severity | Count |
|----------|-------|
| BLOCKER  | 8     |
| HIGH     | 14    |
| MEDIUM   | 14    |
| LOW      | 7     |
| **Total**| **43**|

---

## BLOCKER — Fix Before Next Production Deploy

---

### FIX-B01 — Recursive RLS on 6 tables causes 500 errors under load
**Severity:** BLOCKER
**Files:** `supabase/migrations/20260307_v2_pm_features.sql`, `supabase/migrations/20260307_company_integrations.sql`
**Tables:** `crew_schedules`, `change_orders`, `permits`, `equipment`, `equipment_assignments`, `company_integrations`

These 6 tables were added *after* the RLS recursion fix migration and reintroduce the banned `SELECT company_id FROM profiles WHERE id = auth.uid()` pattern. Under real load this triggers PostgreSQL error `42P17` (infinite recursion) — all queries against these tables fail with 500s.

**Fix:** New migration dropping and recreating all policies using `public.get_my_company_id()`:

```sql
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

**Effort:** S (1 migration, ~30 min)

---

### FIX-B02 — Expense receipt storage bucket has no company isolation
**Severity:** BLOCKER (cross-company data leak)
**File:** `supabase/migrations/20260308_expenses_table.sql`

Storage policies on `expense-receipts` only check `auth.uid() IS NOT NULL`. Any authenticated user from any company can read or insert another company's receipts — zero tenant isolation.

**Fix:** Re-create storage policies enforcing a company-scoped path prefix. Upload path must be prefixed `${companyId}/receipts/`.

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

Also update the frontend upload call to prefix path with `${companyId}/receipts/filename`.
**Effort:** S (1 migration + 1 frontend upload path change)

---

### FIX-B03 — `sign-document.mjs` token check skipped when `sign_token` is NULL
**Severity:** BLOCKER (broken access control — OWASP A01)
**File:** `api/sign-document.mjs`

When `sign_token` is NULL (default for all pre-existing estimate rows), the guard `if (estimate.sign_token && token !== estimate.sign_token)` is entirely skipped. Anyone who knows an estimate UUID can sign it with no token. Signed documents are legally binding.

**Fix:** Require a non-null stored token AND enforce it matches; add `token` to upfront required-field check:

```js
if (!estimateId || !signedBy || !signatureData || !token) {
  return res.status(400).json({ error: 'Missing required fields' });
}
if (!estimate.sign_token || token !== estimate.sign_token) {
  return res.status(403).json({ error: 'Invalid signing token' });
}
```

**Effort:** S (single file, ~10 min)

---

### FIX-B04 — `quickbooks-auth.mjs` has no authentication — QB account hijack possible
**Severity:** BLOCKER (OWASP A01/A07)
**File:** `api/quickbooks-auth.mjs`

`GET /api/quickbooks-auth?company_id=<uuid>` has no `requireAuth`. Any anonymous caller can initiate OAuth for an arbitrary `company_id`, linking a victim company's DB row to the attacker's QuickBooks account.

**Fix:**

```js
import { requireAuth } from './_auth-middleware.mjs';
export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  // Verify user's company_id matches the requested company_id via profiles lookup
}
```

**Effort:** S (< 30 min)

---

### FIX-B05 — `quickbooks-sync.mjs` has no authentication — cross-company data sync
**Severity:** BLOCKER (OWASP A01)
**File:** `api/quickbooks-sync.mjs`

`POST /api/quickbooks-sync` accepts `company_id` from the request body with zero auth. Any caller knowing a valid company UUID can read that company's data from Supabase and push it to QuickBooks.

**Fix:** Add `requireAuth` and verify company membership (same pattern as B04).
**Effort:** S (< 30 min)

---

### FIX-B06 — `past_due` subscriptions bypass the paywall
**Severity:** BLOCKER (payment bypass)
**File:** `src/components/AppLayout.tsx` (lines ~910-918)

Subscription gate only blocks `trialing-expired` and `canceled`. Stripe sets `past_due` when a card is declined. Customers with failed payments retain full app access indefinitely.

**Fix:**

```js
const blocked =
  trialExpired ||
  company.subscription_status === 'canceled' ||
  company.subscription_status === 'past_due';
```

**Effort:** S (1 line, ~5 min)

---

### FIX-B07 — QuickBooks callback redirects users to GitHub Pages after OAuth
**Severity:** BLOCKER (broken integration — dead redirect)
**File:** `api/quickbooks-callback.mjs` (lines 13, ~47)

`const appBase = 'https://614restore.github.io/crm-kanban-integrate'` — all KB OAuth redirects send users to the dead old domain. The entire QB integration is non-functional in production.

**Fix:**

```js
const appBase = process.env.APP_URL || 'https://crm-kanban-integrate.vercel.app';
const fullUrl = `${process.env.APP_URL || 'https://crm-kanban-integrate.vercel.app'}${req.url}`;
```

**Effort:** S (2 line changes)

---

### FIX-B08 — Vite base path defaults to GitHub Pages path — breaks Vercel builds
**Severity:** BLOCKER (production broken if env var missing)
**File:** `vite.config.ts` (line 9)

`const base = process.env.VITE_BASE_URL ?? (mode === "production" ? "/crm-kanban-integrate/" : "/")` — if `VITE_BASE_URL` is not set in Vercel, every production build serves assets from a non-existent path. Completely white/broken app.

**Fix:**
1. Set `VITE_BASE_URL=/` in all three Vercel environment tiers (Production, Preview, Development).
2. Flip the code default: `const base = process.env.VITE_BASE_URL ?? "/";`

**Effort:** S (env var + 1-line code change)

---

## HIGH — Fix This Sprint

---

### FIX-H01 — `stripe-webhook.mjs` calls `listUsers()` without pagination
**Severity:** HIGH
**Files:** `api/stripe-webhook.mjs` (line ~87), `api/stripe-checkout.mjs`

`client_reference_id` is never set in `stripe-checkout.mjs`, so the webhook always falls back to `listUsers()` with no `perPage` (Supabase caps at 1,000). Companies with >1,000 users never get their subscription activated — they stay `trialing` permanently.

**Fix (two-part):**
1. Pass `client_reference_id: companyId` from the frontend into checkout session params.
2. If fallback still needed, use a targeted email filter instead of listing all users.

**Effort:** M (frontend + backend)

---

### ✅ FIX-H02 — `handleUseTemplate` / `handleCompose` template safety [FIXED]
**Severity:** HIGH (wrong customer data sent)
**File:** `src/components/crm/CommunicationHub.tsx`
**Status:** ✅ COMPLETE (2026-03-08)
**Documentation:** `.claude/TEMPLATE_IMPROVEMENTS.md`

**Original Issue:** When no thread was selected, template variables were silently filled with a random contact's name/claim/adjuster data. Users could unknowingly send messages to the wrong person with wrong information.

**Fix Applied:**
1. ✅ Added validation checks requiring selected thread before template usage
2. ✅ Disabled "Templates" and "Compose" buttons when no thread selected
3. ✅ Added helpful tooltips explaining why buttons are disabled
4. ✅ Enhanced template modal with professional design and real-time preview
5. ✅ Upgraded all 8 templates to professional, customer-ready content
6. ✅ Improved reply interface with multi-line textarea and keyboard shortcuts
7. ✅ Added comprehensive empty states and user guidance
8. ✅ Subject line variable replacement for email templates

**Testing:** See `.claude/TEMPLATE_IMPROVEMENTS.md` for 24-point testing checklist

---

### FIX-H03 — Subscription gate race window — app visible briefly before block resolves
**Severity:** HIGH
**File:** `src/components/AppLayout.tsx` (line ~405)

`subscriptionBlocked` initialises as `false`. On slow connections the full CRM renders for several seconds before being blocked — a `past_due` user could read/copy data during this window.

**Fix:** Initialise `subscriptionBlocked` as `null` and show a loading state until the check resolves, OR move the company/subscription check as the first step in `loadData` before dispatching `INITIALIZE_DATA`.
**Effort:** M

---

### FIX-H04 — Missing indexes on 5 major tables
**Severity:** HIGH (sequential scans on every tenant query)
**File:** `supabase/migrations/20260306_missing_tables.sql`

`estimates`, `projects`, `work_orders`, `suppliers`, `material_orders`, and `material_order_items` have zero indexes beyond their PKs.

**Fix:** New migration:

```sql
CREATE INDEX IF NOT EXISTS idx_estimates_company        ON estimates (company_id);
CREATE INDEX IF NOT EXISTS idx_estimates_contact        ON estimates (contact_id);
CREATE INDEX IF NOT EXISTS idx_projects_company         ON projects (company_id);
CREATE INDEX IF NOT EXISTS idx_projects_contact         ON projects (contact_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_company      ON work_orders (company_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_project      ON work_orders (project_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company        ON suppliers (company_id);
CREATE INDEX IF NOT EXISTS idx_material_orders_supplier ON material_orders (supplier_id);
CREATE INDEX IF NOT EXISTS idx_material_orders_project  ON material_orders (project_id);
CREATE INDEX IF NOT EXISTS idx_material_order_items_order ON material_order_items (order_id);
```

**Effort:** S (1 migration)

---

### FIX-H05 — 12 direct Supabase calls in components bypass `DatabaseService`
**Severity:** HIGH (no timeout protection — components can hang indefinitely)
**Files:** `TeamView.tsx`, `InsuranceTrackingView.tsx`, `SupplementTrackingView.tsx`, `EquipmentView.tsx`, `CrewScheduleView.tsx`, `PermitTracker.tsx`

Direct `supabase.from()` calls bypass `DatabaseService`, losing `raceTimeout` protection, demo-mode handling, and centralised error logging.

**Fix:** Add CRUD methods for `insurance_claims`, `supplements`, `equipment`, `crew_schedules`, and `permits` to `src/lib/database.ts`. Replace all direct component-level calls.
**Effort:** M (6 files, ~2 hrs)

---

### FIX-H06 — `ai-draft.mjs` — prompt injection via unsanitized user fields
**Severity:** HIGH (OWASP A03 — LLM prompt injection)
**File:** `api/ai-draft.mjs` (line ~38)

`contactName`, `projectType`, `tone`, and `context` interpolated directly into the Groq prompt with no length caps or control-character stripping. A user can inject instructions to generate phishing content sent from the company's verified sender address.

**Fix:**

```js
const userPrompt = `Write a professional email.
<contact_name>${contactName.slice(0, 100).replace(/[\n\r]/g, ' ')}</contact_name>
<project_type>${(projectType || 'roofing/restoration').slice(0, 100)}</project_type>
<tone>${(tone || 'professional').slice(0, 50)}</tone>
${context ? `<context>${context.slice(0, 500)}</context>` : ''}
Reply ONLY with JSON: { "subject": "...", "body": "..." }`;
```

**Effort:** S (single file, ~20 min)

---

### FIX-H07 — `sign-document.mjs` — `estimateId` not validated as UUID
**Severity:** HIGH (OWASP A03 — PostgREST injection)
**File:** `api/sign-document.mjs`

`estimateId` used raw in Supabase REST URL query strings. A crafted value like `real-id&status=eq.sent` injects additional PostgREST filter parameters.

**Fix:**

```js
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(estimateId)) {
  return res.status(400).json({ error: 'Invalid estimateId' });
}
```

**Effort:** S (~10 min)

---

### FIX-H08 — 3 hardcoded Vercel domain URLs in frontend source
**Severity:** HIGH (breaks preview deploys and any custom domain)
**Files:** `src/pages/SignEstimate.tsx` (line 5), `src/pages/SignChangeOrder.tsx` (line 5), `src/components/crm/TeamView.tsx` (line 161)

**Fix:** Use relative paths — API functions share origin with the frontend on Vercel:

```ts
const API_BASE = "/api/sign-document";
await fetch('/api/send-email', ...
```

**Effort:** S (3 files, ~10 min)

---

### FIX-H09 — QuickBooks auth/callback hardcode `redirectUri` and token exchange URL
**Severity:** HIGH (OAuth breaks on any domain change)
**Files:** `api/quickbooks-auth.mjs` (line 27), `api/quickbooks-callback.mjs` (line ~41)

**Fix:**

```js
redirectUri: `${process.env.APP_URL || 'https://crm-kanban-integrate.vercel.app'}/api/quickbooks-callback`,
```

**Effort:** S (2 files, ~10 min)

---

### FIX-H10 — `SUPABASE_URL` hardcoded as constant in `quickbooks-callback.mjs`
**Severity:** HIGH
**File:** `api/quickbooks-callback.mjs` (line 7)

Never reads from `process.env`. Silent breakage if the Supabase project is migrated.

**Fix:**

```js
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qgvuzrvpyyrrulhwlzma.supabase.co';
```

**Effort:** S (1 line)

---

### FIX-H11 — `.env.example` missing all server-side and several frontend env vars
**Severity:** HIGH (ops/recovery risk)
**File:** `.env.example`

**Missing server-side:** `APP_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_ENVIRONMENT`, `QB_ENCRYPT_KEY`, `GROQ_API_KEY`
**Missing frontend:** `VITE_API_BASE_URL`, `VITE_API_URL`, `VITE_DEMO_MODE`, `VITE_HASH_ROUTING`, `VITE_DISABLE_REALTIME`, `VITE_BASE_URL`

**Fix:** Add a `## Server-side (Vercel) Environment Variables` section to `.env.example` with descriptions and example values for all of the above.
**Effort:** S (~20 min)

---

### FIX-H12 — `xlsx` package at vulnerable/controversial version
**Severity:** HIGH
**File:** `package.json` — `"xlsx": "^0.18.5"`

SheetJS 0.18.5 has reported telemetry issues, multiple security advisories, and is 2+ years stale.

**Fix:** Replace with `exceljs` (actively maintained). If only CSV is needed, use `papaparse`.
**Effort:** M (package evaluation + replacement)

---

### FIX-H13 — `BillingSettings.tsx` is dead code — pricing page never shown to users
**Severity:** HIGH (feature gap — conversion impact)
**Files:** `src/components/settings/BillingSettings.tsx`, `src/components/settings/MainSettings.tsx`

`MainSettings.tsx` has no consumers. The billing/upgrade page with pricing table is never rendered. Add-On buttons in `BillingSettings.tsx` also have no `onClick` handlers.

**Fix:** Wire `BillingSettings` into `SettingsView.tsx` billing tab and add `onClick` handlers — OR delete both files as confirmed dead code.
**Effort:** M

---

### FIX-H14 — Trial urgency banner (days 8-14) has no copy button for LAUNCH50
**Severity:** HIGH (conversion loss — 5-minute fix)
**File:** `src/components/AppLayout.tsx` (lines ~375-393)

Day 8-14 urgency banner shows the promo code as plain bold text only. The `handleCopy` function already exists — it just wasn't threaded into the urgency variant.

**Fix:** Add `<button onClick={handleCopy}>` to the urgency banner (same pattern as the discount variant).
**Effort:** S (~5 min)

---

### FIX-H15 — LAUNCH50 promo code not visible at the point of purchase
**Severity:** HIGH (conversion gap)
**File:** `src/components/crm/SubscriptionView.tsx`

Neither `SubscriptionView` nor the billing tab shows LAUNCH50. Users who navigate to pricing from the banner lose sight of the code before completing checkout.

**Fix:** Add a promo callout above the Stripe pricing table in `SubscriptionView`, visible during trial:

```tsx
{company?.subscription_status === 'trialing' && (
  <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 text-sm text-indigo-800 flex items-center gap-2 mb-4">
    <Tag className="w-4 h-4" />
    Use code <strong className="font-mono">LAUNCH50</strong> at checkout — 50% off 3 months (monthly plans).
  </div>
)}
```

**Effort:** S (~10 min)

---

## MEDIUM — Fix This Sprint or Next

---

### FIX-M01 — N+1 queries on contact detail page (7 sequential round-trips)
**Severity:** MEDIUM
**File:** `src/lib/database.ts`

Opening a contact triggers 7 individual sequential DB queries. Degrades noticeably at 100+ contacts.

**Fix:** Consolidate into `Promise.all` (all 7 queries run in parallel).
**Effort:** M (~2 hrs)

---

### FIX-M02 — `getContact()` has no `company_id` filter at the application layer
**Severity:** MEDIUM (defence-in-depth)
**File:** `src/lib/database.ts` (line ~637)

Only filters by `id`. If RLS is accidentally disabled, any contact UUID returns cross-company data.

**Fix:** Add `.eq('company_id', companyId)` as a second filter. Apply same hardening to `getJobsByContact`, `getCommunicationsByContact`, `getDocumentsByContact`, `getEstimatesByContact`, `getProjectsByContact`, and `getWorkOrdersByContact`.
**Effort:** S

---

### FIX-M03 — Inconsistent error handling and missing `raceTimeout` across `DatabaseService`
**Severity:** MEDIUM
**File:** `src/lib/database.ts`

Several methods (`getDocumentsByContact`, `getCommunicationsByContact`, `getDocuments`, `deleteDocument`, `deleteEstimate`, `getTeamMembers`) lack `raceTimeout` wrappers and can hang indefinitely. `createJob()` and `createMaterialOrder()` silently return `null` on error while `createContact()` throws — inconsistent contract.

**Fix:** Apply `raceTimeout` to all async DB ops. Standardise on throw-on-error or `{ data, error }`.
**Effort:** M (~2 hrs)

---

### FIX-M04 — Auth context race: dual `loadProfile` calls cause unauthenticated flash
**Severity:** MEDIUM
**File:** `src/lib/authContext.tsx` (line ~120)

Both `onAuthStateChange` (INITIAL_SESSION) and `getSession().then()` call `loadProfile` independently. Second path can set `loading = false` before profile is stored — one-frame flash of the unauthenticated view.

**Fix:** Consolidate auth initialisation to a single code path. Only call `setLoading(false)` after profile is definitively set.
**Effort:** M

---

### FIX-M05 — `send-email.mjs` CORS header is empty string if `APP_URL` unset
**Severity:** MEDIUM
**File:** `api/send-email.mjs` (line 9)

`res.setHeader('Access-Control-Allow-Origin', process.env.APP_URL || '')` — empty CORS header is invalid; browsers silently block all requests. Email feature breaks without any server-side error.

**Fix:**

```js
const allowedOrigin = process.env.APP_URL;
if (!allowedOrigin) console.error('[send-email] APP_URL not set — CORS blocked');
res.setHeader('Access-Control-Allow-Origin', allowedOrigin || 'https://crm-kanban-integrate.vercel.app');
```

Also tighten QB endpoints' `'*'` CORS to `process.env.APP_URL` after adding auth (B04/B05).
**Effort:** S (3 files)

---

### FIX-M06 — `stripe-checkout.mjs` allows unauthenticated coupon enumeration
**Severity:** MEDIUM (OWASP A01)
**File:** `api/stripe-checkout.mjs`

No auth. `couponId` from the request body passed directly to Stripe — allows probe-based enumeration of valid codes.

**Fix:** Add a server-side coupon allowlist:

```js
const ALLOWED_COUPONS = (process.env.ALLOWED_COUPONS || 'LAUNCH50').split(',');
if (couponId && !ALLOWED_COUPONS.includes(couponId)) {
  return res.status(400).json({ error: 'Invalid coupon' });
}
```

**Effort:** S (~30 min)

---

### FIX-M07 — No rate limiting on high-value endpoints
**Severity:** MEDIUM (OWASP A05)
**Files:** `api/sign-document.mjs`, `api/sign-change-order.mjs`, `api/send-email.mjs`, `api/ai-draft.mjs`, `api/stripe-checkout.mjs`

Signing endpoints allow token-guessing brute force. Email/AI endpoints allow cost abuse. Checkout allows session flooding.

**Fix:** Add Vercel Edge Middleware with `@upstash/ratelimit`. Minimums: 5 req/min/IP on signing; 20 req/min/user on send-email and ai-draft.
**Effort:** M (~3 hrs, shared middleware)

---

### FIX-M08 — MobileNav "Work Orders" uses wrong view ID
**Severity:** MEDIUM (mobile navigation broken)
**File:** `src/components/mobile/MobileNav.tsx` (line ~76)

`view: 'work_orders'` (underscore) — `ViewType` uses `'work-orders'` (hyphen). Tapping "Work Orders" on mobile navigates to Dashboard instead.

**Fix:** `view: 'work_orders'` → `view: 'work-orders'`
**Effort:** S (1 character)

---

### FIX-M09 — ContactList empty state doesn't distinguish no-data vs. no-search-results
**Severity:** MEDIUM
**File:** `src/components/crm/ContactList.tsx` (lines 519-528)

New users see a Search icon and "Try adjusting your filter criteria" when they have no contacts at all. No CTA to add a first contact.

**Fix:** Check `state.contacts.length === 0` for the zero-data case and render a different empty state with an "Add First Contact" button.
**Effort:** S (~30 min)

---

### FIX-M10 — No onboarding / first-run experience for new users
**Severity:** MEDIUM (activation risk)
**Files:** `src/components/crm/Dashboard.tsx`, `src/lib/setupCompany.ts`

New users land on all-zero metrics with "Welcome back, {name}!" and no guidance whatsoever.

**Fix:** Show a first-run checklist panel when all data is empty. Steps: Add first contact → Create an estimate → Invite a team member → Connect email. Change "Welcome back" to "Welcome" on first login.
**Effort:** L (new component)

---

### FIX-M11 — Sidebar has 23 flat ungrouped navigation items
**Severity:** MEDIUM
**File:** `src/components/crm/Sidebar.tsx` (lines 40-63)

23 items in a flat list with no section headers, dividers, or grouping — cognitive overload.

**Fix:** Add uppercase section labels between logical groups: **Overview** | **Leads & CRM** | **Sales** | **Projects** | **Insurance** | **Tools** | **Admin**.
**Effort:** S (~1 hr)

---

### FIX-M12 — Data load failure silently shows empty app — no error, no retry
**Severity:** MEDIUM
**File:** `src/components/AppLayout.tsx` (lines ~733-751)

Any Supabase outage or expired session causes `loadData` to silently dispatch empty arrays. Users see an empty CRM with no indication of a problem.

**Fix:**

```tsx
} catch (error) {
  console.error('Error loading CRM data:', error);
  toast.error('Failed to load your data. Please refresh to try again.');
}
```

**Effort:** S (~30 min)

---

### FIX-M13 — `QBO_ENVIRONMENT` defaults to `sandbox` — real customers hit test data
**Severity:** MEDIUM
**Files:** `api/quickbooks-auth.mjs` (line 20), `api/quickbooks-callback.mjs` (line 39)

If `QBO_ENVIRONMENT` is not set in Vercel Production, real customers connect to QuickBooks sandbox data.

**Fix:** Set `QBO_ENVIRONMENT=production` in Vercel Production environment variables. Document in `.env.example`.
**Effort:** S (env var + docs)

---

### FIX-M14 — Plan names and prices inconsistent between `SubscriptionView` and `BillingSettings`
**Severity:** MEDIUM (trust / credibility)
**Files:** `src/components/crm/SubscriptionView.tsx`, `src/components/settings/BillingSettings.tsx`

`SubscriptionView`: Starter ($49), Professional ($99), Enterprise ($199).
`BillingSettings`: Starter ($29), Pro ($59), Business ($99), Enterprise ($179).
Different names, different prices for the same product.

**Fix:** Create `src/lib/planConfig.ts` with a single `PLANS` constant. Import in both components. Verify against the live Stripe pricing table.
**Effort:** S (~1 hr)

---

## LOW — Address When Capacity Allows

---

### FIX-L01 — TrialBanner discount/urgency cutoff hardcodes 7-day split
**Severity:** LOW
**File:** `src/components/AppLayout.tsx` (line ~339)

`showDiscount = daysLeft > 7` assumes exactly 14-day trials. Breaks for 7-day or 30-day trials.

**Fix:** Derive the midpoint from actual trial duration (`created_at` vs. `trial_ends_at`).
**Effort:** S

---

### FIX-L02 — Unfiltered realtime subscription on `kanban_columns`
**Severity:** LOW
**File:** `src/lib/database.ts` (line ~1541)

`kanban_columns` has no `company_id` so no server-side realtime filter can be applied — events from all companies arrive.

**Fix:** Subscribe to `kanban_boards` changes (filtered) and re-fetch columns on board change instead.
**Effort:** S

---

### FIX-L03 — `setup.sql` has permissive `WITH CHECK (true)` companies insert policy
**Severity:** LOW
**File:** `supabase/setup.sql` (~line 340)

Fresh-install reference file still has the open policy that was hardened in migration `20260225173000`. Could mislead future developers.

**Fix:** Update `setup.sql` to mirror the hardened `companies_insert_authenticated` policy.
**Effort:** S

---

### FIX-L04 — Mobile header hardcodes "TrussCTR" instead of company name
**Severity:** LOW
**File:** `src/components/mobile/ResponsiveLayout.tsx` (line ~152)

Desktop sidebar shows the real company name dynamically. Mobile header always shows "TrussCTR".

**Fix:** Load `companyName` alongside `companyLogoUrl` in `ResponsiveLayout.tsx`, mirroring `Sidebar.tsx`.
**Effort:** S

---

### FIX-L05 — Unbounded `signatureData` payload in signing endpoints
**Severity:** LOW (OWASP A05 — storage exhaustion)
**Files:** `api/sign-document.mjs`, `api/sign-change-order.mjs`

No cap on base64 signature payload. Retina blobs can be 1-2 MB; enables storage bloat and DoS.

**Fix:**

```js
if (signatureData && signatureData.length > 500_000) {
  return res.status(413).json({ error: 'Signature data too large' });
}
```

**Effort:** S (2 files, ~10 min)

---

### FIX-L06 — `@types/*` packages in `dependencies` instead of `devDependencies`
**Severity:** LOW
**File:** `package.json`

`@types/dexie`, `@types/uuid`, `@types/xlsx` in `dependencies` — zero runtime value, adds to production serverless bundle.

**Fix:** Move all three to `devDependencies`.
**Effort:** S (1 min)

---

### FIX-L07 — `package.json` deploy script and `homepage` field point to GitHub Pages
**Severity:** LOW
**File:** `package.json`

`"deploy"` script pushes to GH Pages; `"homepage"` field points to the old domain. Confuses tooling and developers.

**Fix:** Rename to `deploy:gh-pages`. Update `homepage` to Vercel production URL. Add a comment noting GH Pages is legacy.
**Effort:** S (5 min)

---

## Remediation Order — Top 15 Quick Wins and Blockers

| # | ID | Title | Effort |
|---|----|-------|--------|
| 1 | B06 | Add `past_due` to paywall block | S |
| 2 | B03 | Fix sign-document token bypass | S |
| 3 | B07 | Fix QB callback GitHub Pages redirect | S |
| 4 | H14 | Add copy button to urgency trial banner | S |
| 5 | H15 | Add LAUNCH50 reminder above pricing table | S |
| 6 | H08 | Replace 3 hardcoded Vercel URLs with relative paths | S |
| 7 | H07 | UUID-validate estimateId in sign-document | S |
| 8 | B04 | Add requireAuth to quickbooks-auth | S |
| 9 | B05 | Add requireAuth to quickbooks-sync | S |
| 10 | M08 | Fix MobileNav work_orders -> work-orders | S |
| 11 | B01 | Fix recursive RLS on 6 tables (migration) | S |
| 12 | B02 | Fix expense receipt storage isolation (migration) | S |
| 13 | H04 | Add missing indexes — 5 tables (migration) | S |
| 14 | H06 | Sanitize ai-draft prompt injection fields | S |
| 15 | H11 | Expand .env.example with all server-side vars | S |
