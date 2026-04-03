# Full Change Record — April 1–3, 2026
> Created before rollback. Restore this file after rollback to re-implement everything.

---

## ⚠️ CRITICAL: Read Before Rolling Back

**The April 1 SQL backup has BROKEN RLS policies.** Restoring it will immediately
break login ("Load Failed" / "Failed to fetch") for ALL users on BOTH web and mobile.
You must re-apply the RLS fix SQL (Section 5) immediately after any database restore.

**Mobile app impact:** The mobile app connects to the same ProjectCEO Supabase database.
Any database rollback affects mobile users instantly. Code changes only affect the web app.

---

## Section 1 — Database Changes Applied Directly to ProjectCEO
> These are NOT in any backup. Must be re-applied after restoring April 1 backup.

### 1a. RLS Recursion Fix (REQUIRED — without this, login fails for everyone)
```sql
-- Run this FIRST after any database restore

CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_my_company_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_company_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- Drop all existing profiles policies (recursive)
DO $$ DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename='profiles' AND schemaname='public'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname); END LOOP;
END $$;

CREATE POLICY profiles_select_safe ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR company_id = public.get_my_company_id());
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update_safe ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR company_id = public.get_my_company_id())
  WITH CHECK (id = auth.uid() OR company_id = public.get_my_company_id());

-- Fix companies policies
DO $$ DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='companies'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.companies', pol.policyname); END LOOP;
END $$;
CREATE POLICY companies_select_own ON public.companies FOR SELECT TO authenticated
  USING (id = public.get_my_company_id());
CREATE POLICY companies_update_own ON public.companies FOR UPDATE TO authenticated
  USING (id = public.get_my_company_id()) WITH CHECK (id = public.get_my_company_id());
CREATE POLICY companies_insert_new ON public.companies FOR INSERT TO authenticated
  WITH CHECK (public.get_my_company_id() IS NULL);

-- Rebuild all tenant-scoped tables
DO $$ DECLARE tbl RECORD; pol RECORD;
BEGIN
  FOR tbl IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name
    WHERE c.table_schema='public' AND c.column_name='company_id'
      AND t.table_type='BASE TABLE' AND c.table_name NOT IN ('companies','profiles')
  LOOP
    FOR pol IN SELECT p.policyname FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=tbl.table_name
    LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl.table_name); END LOOP;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (company_id=public.get_my_company_id())', tbl.table_name||'_select', tbl.table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (company_id=public.get_my_company_id())', tbl.table_name||'_insert', tbl.table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (company_id=public.get_my_company_id()) WITH CHECK (company_id=public.get_my_company_id())', tbl.table_name||'_update', tbl.table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (company_id=public.get_my_company_id())', tbl.table_name||'_delete', tbl.table_name);
  END LOOP;
END $$;

-- Kanban columns
DO $$ DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='kanban_columns'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.kanban_columns', pol.policyname); END LOOP;
END $$;
CREATE POLICY kc_select ON public.kanban_columns FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kanban_boards b WHERE b.id=board_id AND b.company_id=public.get_my_company_id()));
CREATE POLICY kc_insert ON public.kanban_columns FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.kanban_boards b WHERE b.id=board_id AND b.company_id=public.get_my_company_id()));
CREATE POLICY kc_update ON public.kanban_columns FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kanban_boards b WHERE b.id=board_id AND b.company_id=public.get_my_company_id()));
CREATE POLICY kc_delete ON public.kanban_columns FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kanban_boards b WHERE b.id=board_id AND b.company_id=public.get_my_company_id()));

SELECT 'RLS fix applied ✅' AS status;
```

### 1b. Storage RLS Fix (REQUIRED — without this, logo/avatar/document uploads fail)
```sql
DROP POLICY IF EXISTS "Allow public read for app buckets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated insert for app buckets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update for app buckets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete for app buckets" ON storage.objects;
DROP POLICY IF EXISTS "Public company-logos read" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated company-logos upload" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_public_select" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_company_insert" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_company_update" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_company_delete" ON storage.objects;
DROP POLICY IF EXISTS "avatars_public_select" ON storage.objects;
DROP POLICY IF EXISTS "avatars_company_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_company_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_company_delete" ON storage.objects;

CREATE POLICY "company_logos_public_select" ON storage.objects FOR SELECT USING (bucket_id='company-logos');
CREATE POLICY "company_logos_company_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='company-logos' AND (storage.foldername(name))[1]=(public.get_my_company_id())::text);
CREATE POLICY "company_logos_company_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='company-logos' AND (storage.foldername(name))[1]=(public.get_my_company_id())::text);
CREATE POLICY "company_logos_company_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='company-logos' AND (storage.foldername(name))[1]=(public.get_my_company_id())::text);
CREATE POLICY "avatars_public_select" ON storage.objects FOR SELECT USING (bucket_id='avatars');
CREATE POLICY "avatars_company_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='avatars' AND (storage.foldername(name))[1]=(public.get_my_company_id())::text);
CREATE POLICY "avatars_company_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='avatars' AND (storage.foldername(name))[1]=(public.get_my_company_id())::text);
CREATE POLICY "avatars_company_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='avatars' AND (storage.foldername(name))[1]=(public.get_my_company_id())::text);
CREATE POLICY "documents_company_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('documents','projectceo-documents','projectceo-photos','expense-receipts')
    AND (storage.foldername(name))[1]=(public.get_my_company_id())::text);
CREATE POLICY "documents_company_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('documents','projectceo-documents','projectceo-photos','expense-receipts')
    AND (storage.foldername(name))[1]=(public.get_my_company_id())::text);
CREATE POLICY "documents_company_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('documents','projectceo-documents','projectceo-photos','expense-receipts')
    AND (storage.foldername(name))[1]=(public.get_my_company_id())::text);
CREATE POLICY "documents_company_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('documents','projectceo-documents','projectceo-photos','expense-receipts')
    AND (storage.foldername(name))[1]=(public.get_my_company_id())::text);

SELECT 'Storage RLS fixed ✅' AS status;
```

### 1c. User Accounts Fixed (re-check after restore — these profiles may need re-linking)
- `jeffrey@614restore.com` — was missing company_id; created new "614 Restore LLC" company and linked as owner
- `jeff.nicki@yahoo.com` — was missing company_id; linked to 614 Restore LLC (jnewell572's company) as sales_rep
- `testprobe2@example.com` — test account, no company (safe to ignore or delete)

---

## Section 2 — Code Changes (Web App)

### 2a. Bug Fixes — IMPORTANT, re-implement these first

**`src/lib/exportUtils.ts`** — Replace `exceljs` (Node-only) with `xlsx` (browser-compatible)
- Problem: `import ExcelJS from 'exceljs'` crashed Pipeline, ContactList, Reports, WorkOrders, and 4 other views with "Module name does not resolve to a valid URL"
- Fix: Replace `import ExcelJS from 'exceljs'` with `import * as XLSX from 'xlsx'`
- Replace `new ExcelJS.Workbook()` → `XLSX.utils.book_new()`
- Replace `addSheet`: use `XLSX.utils.json_to_sheet(data)` + `XLSX.utils.book_append_sheet(wb, ws, name)`
- Replace `writeAndDownload`: use `XLSX.write(wb, {bookType:'xlsx', type:'array'})` → Blob download
- Remove `async` from all export functions (no longer needed)

**`src/lib/database.ts`** — Company cache bug (logo not showing in sidebar after upload)
- Problem: `updateCompany()` saved new logo_url to Supabase but never updated the 5-minute localStorage cache. Sidebar reloaded from stale cache, showing no logo.
- Fix: After successful update (both RPC path and direct query path), call `this.setCachedCompany(companyId, updatedData)`

**`src/components/ui/ImageCropDialog.tsx`** — Logo crop dialog showed blank image
- Problem: `effectiveAspect = 3/1` (very wide crop frame) + `initialZoom = 0.4` made the logo invisible in the dialog
- Fix: Change to `effectiveAspect = aspectRatio ?? 1` (square by default) and `initialZoom = 1`

**`src/pages/ContactDetail.tsx`** — Documents opening as raw HTML code
- Problem: `handleOpenDocument` called `window.open(signedUrl)` directly. HTML docs stored in Supabase showed raw source code in the browser.
- Fix: Detect `.html` file extension → fetch content → create Blob with `text/html` MIME type → open that URL

**`src/components/crm/DocumentCenter.tsx`** — Same raw HTML issue as ContactDetail

**`src/App.tsx`** — Session check on tab visibility causing unnecessary sign-outs
- Problem: `supabase.auth.getSession()` error on visibility change → signed user out
- Fix: Only sign out if `!data?.session && !error`; ignore errors (transient network)

**`src/components/AppLayout.tsx`** — Cached data wiped by timed-out Supabase fetch
- Problem: On mobile with slow connection, all Supabase queries timed out returning empty arrays, overwriting good cached data with empty state
- Fix: Guard: if loaded from cache and all Supabase results are empty arrays, keep the cached data

**`src/pages/DocumentSigner.tsx`** — Parse error blocking all CI
- Removed 2 orphan lines (`'application/pdf'` and `)`) left from a prior edit

**`src/pages/SmartInspection.tsx`** — Parse error blocking all CI
- Removed orphan line `.getPublicUrl(filePath)` left from a prior edit

### 2b. New Features — implement after bug fixes

**4-Board Pipeline System** (`src/lib/progressionRules.ts`, `src/components/crm/PipelineBoard.tsx`)
- Added `AUTO_ADVANCE_MAP`: maps status changes to cross-board moves
  - `signed` → Production Board (`ordering_material`)
  - `completed` → Billing Board (`invoicing`)
  - `paid` → archives from Billing
- `handleAutoProgression(contactId, newStatus, companyId)` — called after every status change

**Production Board** (`supabase/migrations/20260402000001_add_production_billing_boards.sql`)
- Columns: Ordering Materials, Materials Received, Scheduled, In Progress, Build Phase, Punch List, Completed
- Seeded for all existing companies via migration

**Billing Board** (same migration)
- Columns: Ready for Invoicing, Invoice Sent, Payment Pending, Paid, Collection
- Seeded for all existing companies via migration

**Contact Save Improvements** (`src/components/crm/ContactDetail.tsx`, auth context)
- Extended timeouts from 8s → 15s for mobile
- Retry logic: 3 attempts with exponential backoff
- Better error messages distinguishing auth failures from network failures
- Fixed: contact save hung forever on mobile with no spinner feedback

**Document PDF Generation** (`src/lib/pdfService.ts`, `src/components/crm/FullScreenDocumentEditor.tsx`, `src/components/crm/DocumentTemplates.tsx`, `src/components/crm/ContactTemplateModal.tsx`)
- New: `htmlStringToPdfBlob(html, filename)` — converts HTML string to PDF via html2pdf.js
- All three document creation paths now generate PDFs instead of HTML files
- Downloads changed from `.html` → `.pdf`

**Estimate Edit Restrictions** (`src/components/crm/EstimatesView.tsx`)
- Estimates lock for editing once signed
- Change order workflow required for modifications after signing

**Location-Aware Templates** (`src/lib/locationAwareTemplates.ts` — NEW FILE, 366 lines)
- State-specific legal language in document templates based on contact's state

**State Legal Requirements** (`src/lib/stateLegalRequirements.ts` — NEW FILE, 267 lines)
- Per-state contractor legal requirements database

---

## Section 3 — New Migration Files Added

These files exist in the repo but must be run manually in Supabase after rollback:

| File | Purpose |
|------|---------|
| `supabase/migrations/20260402000001_add_production_billing_boards.sql` | Seeds Production + Billing boards |
| `supabase/migrations/20260402000006_storage_rls_hardening.sql` | Storage bucket RLS policies |
| `supabase/migrations/20260402210000_fix_contacts_schema_mismatch.sql` | Adds phone1, phone2, deposit columns to contacts |
| `supabase-migrations/20260401000001_weather_history.sql` | Weather history table |
| `supabase-migrations/20260401000002_labor_entries.sql` | Labor entries table |
| `supabase-migrations/20260401000003_subcontractor_payment_tracking.sql` | Subcontractor payment tracking |
| `supabase-migrations/20260401000004_estimate_items_relational.sql` | Relational estimate items |

---

## Section 4 — Vercel Environment Variables Required

These must be set in Vercel → Settings → Environment Variables:

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | `https://qgvuzrvpyyrrulhwlzma.supabase.co` | ProjectCEO database |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFndnV6cnZweXlycnVsaHdsem1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzOTU0OTksImV4cCI6MjA4Njk3MTQ5OX0.kQVOflThF52iRCl-VApsGZFwzSMJXdvocIa-7y0NX8M` | ProjectCEO anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ProjectCEO service_role key (from Supabase → Settings → API) | API endpoints auth |
| `RESEND_API_KEY` | Resend API key | Invitation emails |

---

## Section 5 — Mobile App Impact

The mobile app (`614restore/TrussCTR-Mobile-1.0`) connects to the **same ProjectCEO Supabase database**.

**Database rollback → affects mobile immediately:**
- All users lose the RLS fix → mobile login breaks
- Must re-apply Section 1a and 1b SQL before mobile works again

**Code rollback (web only) → does NOT affect mobile:**
- Only `crm-kanban-integrate` (web) code reverts
- Mobile app code in its own repo is unchanged

**Mobile-specific issues that need fixing separately (not related to this rollback):**
- Contact save infinite spinner (partially fixed in this batch)
- Kanban drag-and-drop on touch screens
- Job status revert modal positioning

---

## Section 6 — Dependency Updates (npm)

Applied via Dependabot PRs #92 and #95:
- `lodash` — security fix (prototype pollution + code injection CVEs)
- 6 other packages updated (see PR #95 for full list)

After rollback, run `npm audit` to check for these vulnerabilities again.

---

## Section 7 — Re-Implementation Order After Rollback

If rolling back and re-implementing:

1. ✅ Apply Section 1a (RLS fix) — **do this before anything else or login is broken**
2. ✅ Apply Section 1b (Storage RLS) — fixes logo/avatar uploads
3. ✅ Re-link user accounts (Section 1c)
4. ✅ Fix `exceljs` → `xlsx` (Section 2a, first item) — fixes crash on 7 pages
5. ✅ Fix company cache bug (Section 2a) — fixes logo not showing in sidebar
6. ✅ Fix ImageCropDialog zoom/aspect (Section 2a) — fixes logo crop showing blank
7. ✅ Fix ContactDetail/DocumentCenter HTML documents (Section 2a)
8. ✅ Fix App.tsx visibility change sign-out (Section 2a)
9. ✅ Fix AppLayout.tsx cache overwrite (Section 2a)
10. ✅ Run migration files in Section 3
11. ✅ Implement new features from Section 2b
12. ✅ Set Vercel env vars from Section 4
