# FIXES.md — TrussCTR CRM Pre-Launch Fix Plan
Generated: 2026-03-19

---

## Summary Table

| Priority | Count | Category Breakdown |
|---|---|---|
| P0 — Fix Before Any Real Users | 25 | SECURITY: 13, DATA: 7, BUG: 5 |
| P1 — Fix Within First Week | 28 | SECURITY: 4, DATA: 5, BUG: 7, PERF: 3, UX: 5, INFRA: 4 |
| P2 — Fix Within First Month | 42 | DATA: 6, BUG: 8, PERF: 9, UX: 9, INFRA: 4, CODE: 6 |
| P3 — Nice to Have | 34 | UX: 8, CODE: 9, SEO: 6, DOCS: 6, DEPS: 5 |
| **Total** | **129** | |

---

## P0 — Fix Before Any Real Users (Blocks Launch)

Items that could cause data loss, security breaches, or complete feature failure.

---

### [SECURITY] AI API keys encrypted with Base64 — zero confidentiality
- **File**: `src/lib/aiConfigurationManager.ts` — `encryptApiKey()`
- **Issue**: API keys stored "encrypted" with `Buffer.from(key).toString('base64')` — any user who can SELECT from `ai_configurations` can trivially decode every stored key.
- **Fix**: Replace with AES-256-GCM using `libsodium-wrappers` server-side; make `decryptApiKey` private and server-side only.
- **Source**: security-audit.md

### [SECURITY] `decryptApiKey` is a public method — exploitable by XSS
- **File**: `src/lib/aiConfigurationManager.ts`
- **Issue**: `decryptApiKey` is exported publicly; any XSS payload can call it to decode every stored key.
- **Fix**: Mark the method `private`; ensure decryption never runs in the client bundle.
- **Source**: security-audit.md

### [SECURITY] EagleView webhook authentication is optional — unauthenticated writes allowed
- **File**: `api/eagleview-webhook.mjs`
- **Issue**: Webhook signature verification is guarded by `if (webhookSecret && signature)` — if `EAGLEVIEW_WEBHOOK_SECRET` is unset, any attacker can overwrite job records.
- **Fix**: Make verification mandatory; return 500 if the secret is absent, 401 if the signature is absent.
- **Source**: security-audit.md, api-audit.md, infra-audit.md

### [SECURITY] Document signing token skipped when `sign_token` is NULL — anyone can sign any estimate
- **File**: `api/sign-document.mjs` (line ~51)
- **Issue**: Token validation is inside `if (estimate.sign_token && ...)` — when `sign_token` is NULL (default for pre-existing estimates), the check is silently skipped and any caller can sign without a token.
- **Fix**: Flip the logic — require a token on every request AND require the estimate to have one set; block if either is absent.
- **Source**: security-audit-2.md, bug-audit-2.md

### [SECURITY] Cross-tenant data exposure via five views with no company filter
- **File**: `supabase-migrations/add-suppliers-orders-estimates.sql` (lines 481–545)
- **Issue**: Five views are granted `SELECT TO authenticated` with no company filter — any logged-in user from any tenant can read all other tenants' estimates, contacts, project budgets, and work order details.
- **Fix**: Recreate views with `WITH (security_invoker = true)` so underlying table RLS applies, and revoke the blanket grant until fixed.
- **Source**: db-audit.md

### [SECURITY] `ai_configurations` FK references `auth.users(id)` — tenant isolation broken
- **File**: `supabase-migrations/ai-configuration.sql` (lines 7–8)
- **Issue**: Both `ai_configurations.company_id` and `ai_access_approvals.company_id` reference a user ID, not a company ID — team-shared AI configs are broken and RLS references a `team_members` table that does not exist.
- **Fix**: Change FK to `REFERENCES companies(id)`; rewrite RLS policies to use `EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.company_id = ai_configurations.company_id)`.
- **Source**: db-audit.md

### [SECURITY] 10 database read methods have no `company_id` filter — cross-tenant data at risk
- **File**: `src/lib/database.ts` (lines 648, 741, 972, 1049, 1092, 1151, 1747, 1845, 1924, 1938)
- **Issue**: Methods like `getContact`, `getJobsByContact`, `getInvoiceWithItems` query by FK ID only — if RLS fails for any reason, these return cross-tenant data.
- **Fix**: Add `companyId` parameter to all methods and chain `.eq('company_id', companyId)`.
- **Source**: db-audit.md, db-audit-2.md

### [SECURITY] 12 update methods have no `company_id` filter — IDOR vulnerability
- **File**: `src/lib/database.ts` (lines 684, 766, 921, 1020, 1208, 1352, 1659, 1710, 1772, 1887, 1963, 2136)
- **Issue**: No update method includes `.eq('company_id', companyId)` — a valid user who guesses another tenant's record ID can update it if RLS permits.
- **Fix**: Add `companyId` param and `.eq('company_id', companyId)` to all update calls.
- **Source**: db-audit.md

### [SECURITY] 13 delete methods have no `company_id` filter and no soft-delete
- **File**: `src/lib/database.ts` — 13 delete methods
- **Issue**: No company_id filter on any delete; core CRM entities (contacts, estimates, invoices, projects) are hard-deleted with no recovery path.
- **Fix**: Add `.eq('company_id', companyId)` to all deletes; implement soft-delete (`deleted_at TIMESTAMPTZ`) for contacts, estimates, invoices, and projects.
- **Source**: db-audit.md

### [SECURITY] 6 tables use recursive RLS pattern that causes 42P17 errors under load
- **File**: `supabase/migrations/20260307_v2_pm_features.sql`, `supabase/migrations/20260307_company_integrations.sql`
- **Issue**: Tables `crew_schedules`, `change_orders`, `permits`, `equipment`, `equipment_assignments`, `company_integrations` use the banned recursive subquery RLS pattern that was explicitly fixed — these were added after the fix migration.
- **Fix**: Run a follow-up migration to drop and recreate all policies on these 6 tables using `get_my_company_id()`.
- **Source**: db-audit-2.md

### [SECURITY] Storage bucket `expense-receipts` has no tenant isolation
- **File**: `supabase/migrations/20260308_expenses_table.sql` (lines 56–67)
- **Issue**: Storage policies check only `auth.uid() IS NOT NULL` — any authenticated user from any company can read and insert expense receipts from other companies.
- **Fix**: Enforce a `{company_id}/receipts/` path-based tenant prefix in storage policies and upload paths.
- **Source**: db-audit-2.md

### [SECURITY] QuickBooks OAuth endpoints have no authentication
- **File**: `api/quickbooks-auth.mjs`, `api/quickbooks-sync.mjs`
- **Issue**: `GET /api/quickbooks-auth` and `POST /api/quickbooks-sync` have no `requireAuth` call — attackers can hijack any company's QuickBooks connection or exhaust their API quota.
- **Fix**: Add `requireAuth` from `_auth-middleware.mjs` to both endpoints; verify the authenticated user's `company_id` matches the requested `company_id`.
- **Source**: security-audit-2.md

### [SECURITY] `_disabled/quickbooks-sync.mjs` may still be deployed — hardcoded URL and wildcard CORS
- **File**: `api/_disabled/quickbooks-sync.mjs`
- **Issue**: Vercel may still deploy this file; it has wildcard CORS and the production Supabase URL hardcoded as a fallback, and no authentication.
- **Fix**: Move `_disabled/` outside of `api/`, or exclude it via `vercel.json`. Remove the hardcoded URL.
- **Source**: security-audit.md, api-audit.md

### [DATA] `past_due` subscriptions bypass the paywall entirely
- **File**: `src/components/AppLayout.tsx` (lines 910–918)
- **Issue**: Subscription gate only blocks `trialing` (expired) and `canceled` — a customer whose card is declined retains full app access indefinitely.
- **Fix**: Add `company.subscription_status === 'past_due'` to the blocked conditions.
- **Source**: bug-audit-2.md

### [DATA] Stripe `checkout.session.completed` never activates subscriptions when user count > 1000
- **File**: `api/stripe-webhook.mjs` (line ~87)
- **Issue**: `supabase.auth.admin.listUsers()` called without pagination — returns only 1,000 users max, so companies beyond that are never found and their subscription is never activated.
- **Fix**: Pass `client_reference_id: companyId` from `stripe-checkout.mjs`; use a targeted email query as fallback instead of listing all users.
- **Source**: bug-audit-2.md

### [DATA] Public URLs used for private financial documents — no auth or expiry
- **File**: `src/lib/database.ts:2169`, `src/lib/pdfService.ts:102`
- **Issue**: `getPublicUrl()` used for expense receipts and contract PDFs — these are permanently accessible to anyone with the URL.
- **Fix**: Replace with `createSignedUrl(path, 3600)`; store storage paths in DB and generate signed URLs at read time.
- **Source**: db-audit.md

### [DATA] Subscription check has a race window — full CRM accessible before paywall loads
- **File**: `src/components/AppLayout.tsx` (line 405)
- **Issue**: `subscriptionBlocked` initializes as `false` — on first render the app is always unblocked while the check is in-flight; CRM data can be visible for several seconds on slow connections.
- **Fix**: Initialize `subscriptionBlocked` as `null` (unknown) and show a loading state until the check resolves, or run the company check first in `loadData`.
- **Source**: bug-audit-2.md

### [DATA] Component-level direct Supabase calls bypass `DatabaseService` — no timeout, no demo guard
- **File**: `src/components/crm/TeamView.tsx:323`, `InsuranceTrackingView.tsx:216/235`, `SupplementTrackingView.tsx:209/228`, `EquipmentView.tsx:319`, `CrewScheduleView.tsx:160`, `PermitTracker.tsx:279`
- **Issue**: 12 direct `supabase.from()` calls bypass `DatabaseService`, losing timeout protection, demo-mode handling, and centralized error logging; can hang indefinitely.
- **Fix**: Add corresponding methods to `DatabaseService` and replace all direct calls.
- **Source**: db-audit.md, db-audit-2.md

### [DATA] Feature toggles saved to `localStorage` — trivially bypassable client-side privilege escalation
- **File**: `src/components/crm/FeatureToggles.tsx` and multiple components
- **Issue**: Team members, permissions, and feature flags stored in localStorage can be tampered with in DevTools to escalate client-side privileges; the code comment acknowledges this as a production TODO.
- **Fix**: Move all access-control state to Supabase; use localStorage only for non-sensitive UI preferences.
- **Source**: security-audit.md

### [DATA] RLS on `customer_surveys` uses old recursive subquery pattern
- **File**: `supabase-migrations/` — customer_surveys table
- **Issue**: RLS uses old subquery pattern instead of `get_my_company_id()`, which has known recursion risks.
- **Fix**: Update the three policies to `company_id = get_my_company_id()`.
- **Source**: security-audit.md

### [DATA] Missing indexes on 5 major tables — full table scans on every tenant query
- **File**: `supabase/migrations/20260306_missing_tables.sql`
- **Issue**: Tables `estimates`, `projects`, `work_orders`, `suppliers`, and `material_orders` have zero explicit indexes beyond primary keys — every company-scoped query does a full table scan.
- **Fix**: Add `CREATE INDEX` statements for all FK columns (`company_id`, `contact_id`, `project_id`, etc.) on all 5 tables.
- **Source**: db-audit-2.md

### [BUG] `effectiveCompanyId` declared after early-return — documents fail silently on initial render
- **File**: `src/components/crm/ContactDetail.tsx:443` (declared) vs lines 231/266 (used)
- **Issue**: `effectiveCompanyId` is computed after the null-check early return, so `useEffect` hooks at lines 231 and 266 close over `undefined` — documents and related data silently fail to load on initial renders.
- **Fix**: Move `const effectiveCompanyId = profile?.company_id || state.companyId || null;` above all hooks.
- **Source**: bug-audit.md

### [BUG] Invoice email silently marked "sent" even when delivery fails
- **File**: `src/components/crm/InvoiceModal.tsx:174`
- **Issue**: `sendEmail().catch(() => {})` — invoices are marked "sent" in Supabase even when the email never reaches the customer; no user feedback.
- **Fix**: Replace with `.catch((err) => { console.error(...); toast.warning('Invoice saved, but email delivery failed.'); })`.
- **Source**: bug-audit.md

### [BUG] QuickBooks OAuth redirect hardcoded to dead GitHub Pages URL
- **File**: `api/quickbooks-callback.mjs:13`
- **Issue**: After OAuth, all redirects go to `https://614restore.github.io/crm-kanban-integrate` — the app is on Vercel, so every QB connect/disconnect flow sends users to the wrong dead domain.
- **Fix**: Replace with `process.env.APP_URL || 'https://crm-kanban-integrate.vercel.app'`.
- **Source**: bug-audit-2.md, infra-audit-2.md

### [BUG] `handleUseTemplate` uses `state.contacts[0]` fallback — template variables filled with wrong customer's data
- **File**: `src/components/crm/CommunicationHub.tsx:270` and `~307`
- **Issue**: When no contact thread is selected, template variables are silently filled with a random first contact's data — can send PII to the wrong person.
- **Fix**: Remove the `state.contacts[0]` fallback; block with an error toast instead.
- **Source**: bug-audit-2.md

### [BUG] `progressionRules.ts` and `auditLogger.ts` import from non-existent `./supabaseClient` module
- **File**: `src/lib/progressionRules.ts:1`, `src/lib/auditLogger.ts:1`
- **Issue**: Both files import from `'./supabaseClient'` — a module that does not exist. Any code path triggering auto-board-progression or audit logging will throw a runtime module-not-found error.
- **Fix**: Change both imports to `import { supabase } from './supabase'`.
- **Source**: doc-audit.md

### [BUG] Vite base path defaults to GitHub Pages path on production — blank Vercel app
- **File**: `vite.config.ts:9`
- **Issue**: If `VITE_BASE_URL` is not set in Vercel env vars, every production build uses `/crm-kanban-integrate/` as the asset base — all JS, CSS, and images load from a path that does not exist on Vercel.
- **Fix**: Set `VITE_BASE_URL=/` in Vercel environment variables for Production, Preview, and Development.
- **Source**: infra-audit-2.md

---

## P1 — Fix Within First Week

High severity items that hurt users but don't block launch.

---

### [SECURITY] HTML injection in invite email — user-supplied fields not escaped
- **File**: `api/send-invite.mjs`
- **Issue**: `inviteUrl`, `companyName`, and `invitedByName` are interpolated raw into the HTML email template — an authenticated user can inject arbitrary HTML or `javascript:` hrefs.
- **Fix**: Validate `inviteUrl` starts with `APP_URL`; HTML-escape all user-supplied fields before template interpolation.
- **Source**: security-audit.md, api-audit.md

### [SECURITY] `send-email.mjs` CORS header is empty string when `APP_URL` is unset — silently breaks email
- **File**: `api/send-email.mjs:6`
- **Issue**: `Access-Control-Allow-Origin` set to `process.env.APP_URL || ''` — empty string breaks all browser preflight requests silently.
- **Fix**: Fail closed: return 500 if `APP_URL` is absent rather than defaulting to empty string.
- **Source**: security-audit.md, api-audit.md, infra-audit.md, infra-audit-2.md, bug-audit-2.md

### [SECURITY] No role checks before equipment delete and invitation delete actions
- **File**: `src/components/crm/EquipmentView.tsx`, `TeamView.tsx`
- **Issue**: Delete on equipment and invitations has no client-side role check — any authenticated company member can perform these operations if RLS permits.
- **Fix**: Add `canManage`/`isAdmin` guards before delete actions in both components.
- **Source**: security-audit.md

### [SECURITY] Stripe price ID allowlist is vacuously bypassed when `VITE_STRIPE_*` vars are unset
- **File**: `api/stripe-checkout.mjs` (lines 13–20)
- **Issue**: `getAllowedPriceIds()` reads `VITE_STRIPE_*` vars that are undefined in the Vercel serverless runtime — the array returns empty and the guard passes, accepting any arbitrary Stripe price ID.
- **Fix**: Replace all 8 `VITE_STRIPE_*` references with non-prefixed server-only vars (e.g., `STRIPE_PRICE_STARTER_MONTHLY`).
- **Source**: infra-audit.md

### [DATA] Kanban realtime subscription broadcasts all tenants' events to every client
- **File**: `src/lib/database.ts` (lines 1595–1610)
- **Issue**: `subscribeToAll` listens on `kanban_columns` with no filter clause — all column change events from all tenants are broadcast to every subscribed client.
- **Fix**: Add `company_id` to `kanban_columns` and add `filter: \`company_id=eq.${companyId}\`` to the subscription; or subscribe to filtered `kanban_boards` changes instead.
- **Source**: db-audit.md, db-audit-2.md

### [DATA] EagleView OAuth tokens stored in plaintext
- **File**: `api/eagleview-callback.mjs:80–87`
- **Issue**: EagleView OAuth tokens are stored in plaintext; QuickBooks integration correctly encrypts tokens with AES-256-GCM.
- **Fix**: Apply `encrypt()` from `_crypto-utils.mjs` to EagleView tokens before writing to DB.
- **Source**: api-audit.md

### [DATA] SSRF risk — NOAA fallback URL built from unvalidated third-party API response field
- **File**: `api/eagleview.mjs:196–198`
- **Issue**: NOAA fallback constructs a fetch URL from the unvalidated `forecastZone` field in a third-party API response.
- **Fix**: Validate the URL matches `https://api.weather.gov/` before fetching.
- **Source**: api-audit.md

### [DATA] No rate limiting on email, AI, and signing endpoints — quota abuse and brute force
- **File**: `api/send-email.mjs`, `api/send-invite.mjs`, `api/ai-draft.mjs`, `api/sign-document.mjs`
- **Issue**: Zero rate limiting across all routes — AI and email endpoints can be abused with a valid JWT; signing endpoints are vulnerable to token brute-force.
- **Fix**: Add Vercel Edge Middleware or Upstash Redis rate limiting (e.g., 5 req/min per IP on signing endpoints, per-user limits on email/AI).
- **Source**: security-audit.md, api-audit.md, security-audit-2.md

### [DATA] `signatureData` and `signedBy` have no size limits — storage exhaustion and XSS
- **File**: `api/document-handler.mjs:86–99`, `api/sign-document.mjs`, `api/sign-change-order.mjs`
- **Issue**: No size limits on `signatureData` (SVG Base64) or `signedBy` (free-text) — multi-MB payloads accepted; `signedBy` stored unescaped and rendered in email HTML.
- **Fix**: Cap `signedBy` at 200 chars, `signatureData` at 500 KB; HTML-escape `signedBy`.
- **Source**: security-audit.md, api-audit.md, security-audit-2.md

### [BUG] `past_due` paywall fix also needs subscription gate to initialize as `null` (blocking)
- **File**: `src/components/AppLayout.tsx`
- **Issue**: Companion to the P0 `past_due` fix — the gate must block rendering until the check resolves to prevent the race window.
- **Fix**: Initialize `subscriptionBlocked` as `null`; render a loading spinner until it resolves.
- **Source**: bug-audit-2.md

### [BUG] Stripe webhook handler `listUsers()` called without pagination — subscription activation silently fails
- **File**: `api/stripe-webhook.mjs:87`
- **Issue**: Companion worker-side fix for the P0 Stripe webhook bug — must also pass `client_reference_id` from checkout.
- **Fix**: Add `client_reference_id: companyId` to `stripe-checkout.mjs` session params.
- **Source**: bug-audit-2.md

### [BUG] `sign-document.mjs` `estimateId` used in URL without UUID validation — PostgREST injection
- **File**: `api/sign-document.mjs`
- **Issue**: `estimateId` interpolated raw into a Supabase REST URL — a crafted value like `real-id&status=eq.sent` can inject additional PostgREST filters.
- **Fix**: Validate `estimateId` matches `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` before use.
- **Source**: security-audit-2.md

### [BUG] LLM prompt injection via unsanitized `context`, `contactName`, `projectType`, `tone` fields
- **File**: `api/ai-draft.mjs:30–33`
- **Issue**: All four fields are interpolated directly into the LLM prompt — an authenticated user can inject instructions to generate phishing content sent from the company's verified sender address.
- **Fix**: Add character limits (`contactName` ≤ 100, `context` ≤ 500); strip newlines from inline fields; wrap user input in XML-style delimiters.
- **Source**: api-audit.md, security-audit-2.md, bug-audit-2.md

### [BUG] Signed URLs needed for documents — `SignDocument.tsx` discloses estimate data without token validation
- **File**: `src/pages/SignDocument.tsx:25–42`
- **Issue**: Missing token validation before displaying estimate details (number, title, total, contact ID) — information disclosure to anyone with a valid `estimateId` and no token.
- **Fix**: Validate token before rendering any estimate data; return 403 if absent.
- **Source**: bug-audit.md

### [BUG] Sync engine race condition — reconnect silently skips sync; false "completed" messages
- **File**: `src/lib/syncEngine.ts:304–338`
- **Issue**: Stale `syncErrors` closure causes false success messages; `handleOnline` calls stale `startSync` before `setIsOnline(true)` propagates.
- **Fix**: Use a ref for `syncErrors` to avoid stale closures; defer `startSync` until after `setIsOnline(true)` propagates.
- **Source**: bug-audit.md

### [BUG] Camera tracks never stopped if `PhotoCapture` unmounts during async gap
- **File**: `src/components/mobile/PhotoCapture.tsx:125–149`
- **Issue**: No unmount guard after `getUserMedia` resolves — camera tracks never stopped if component unmounts during async gap.
- **Fix**: Add an unmounted flag or `AbortController` to stop tracks on cleanup.
- **Source**: bug-audit.md

### [BUG] Mobile Work Orders navigation broken — `view: 'work_orders'` should be `'work-orders'`
- **File**: `src/components/mobile/MobileNav.tsx` (line ~76)
- **Issue**: Mobile nav sets `view: 'work_orders'` (underscore) but the `ViewType` and router use `'work-orders'` (hyphen) — tapping "Work Orders" navigates to Dashboard instead.
- **Fix**: Change `view: 'work_orders'` → `view: 'work-orders'` in `MobileNav.tsx`.
- **Source**: ui-audit-2.md

### [PERF] `sortedContacts` recomputed inline on every render — blocks main thread on every toggle
- **File**: `src/components/crm/ContactList.tsx` (lines 59–84)
- **Issue**: Spreading, filtering, and sorting the entire contacts array runs on every local state change.
- **Fix**: Wrap in `useMemo([filteredContacts, sortField, sortDirection, showUnassigned])`.
- **Source**: perf-audit.md

### [PERF] Four selector hooks in `crmStore.ts` recompute full O(n) loops on every context dispatch
- **File**: `src/lib/crmStore.ts` — `usePipelineStats`, `useFinancialStats`, `useUpcomingAppointments`, `useFilteredContacts` (lines 592–701)
- **Issue**: Every trivial dispatch (like sidebar toggle) re-executes expensive iterations across all contacts/invoices/estimates.
- **Fix**: Wrap each hook body in `useMemo` keyed to the state slices it actually reads.
- **Source**: perf-audit.md

### [PERF] Full 14-collection Supabase reload on every `visibilitychange` and focus event — no debounce
- **File**: `src/components/AppLayout.tsx` (lines 706–721)
- **Issue**: Three separate `useEffect` hooks trigger a full data reload on laptop wake or frequent tab switches with no throttle.
- **Fix**: Add a minimum 60-second throttle guard between background reloads.
- **Source**: perf-audit.md

### [UX] Trial urgency banner missing promo code copy button — highest-conversion users have friction
- **File**: `src/components/AppLayout.tsx` (lines ~375–393)
- **Issue**: The day 8–14 urgency banner shows `LAUNCH50` as inline bold text with no copy button; the `handleCopy` function already exists but wasn't wired into this variant.
- **Fix**: Add the same copy `<button onClick={handleCopy}>` used in the discount phase to the urgency variant.
- **Source**: ui-audit-2.md

### [UX] Promo code not shown at point of purchase in `SubscriptionView`
- **File**: `src/components/crm/SubscriptionView.tsx`
- **Issue**: Users who navigate to the billing page see no mention of `LAUNCH50` — the trial banner disappears on navigation.
- **Fix**: Add a promo code reminder callout directly above the Stripe pricing table for `trialing` users.
- **Source**: ui-audit-2.md

### [UX] `BillingSettings.tsx` is unreachable dead code — users never see the full pricing page
- **File**: `src/components/settings/BillingSettings.tsx`, `src/components/settings/MainSettings.tsx`
- **Issue**: `MainSettings.tsx` has no consumers — the well-designed billing/upgrade page is never shown; Add-On buttons have no `onClick` handler.
- **Fix**: Either wire `BillingSettings` into `SettingsView.tsx`'s billing tab, or delete both dead components.
- **Source**: ui-audit-2.md

### [UX] No onboarding flow for new users — blank Dashboard with zero metrics
- **File**: `src/lib/authContext.tsx`, `src/lib/setupCompany.ts`, `src/components/crm/Dashboard.tsx`
- **Issue**: New users land on a Dashboard showing all-zero metrics with no checklist, guidance, sample data, or getting-started prompt; the greeting says "Welcome back" on first login.
- **Fix**: Add a first-run checklist panel that appears when `contacts.length === 0 && teamMembers.length <= 1`; change "Welcome back" to "Welcome" for new accounts.
- **Source**: ui-audit-2.md

### [UX] ContactList empty state shows wrong copy — "adjust search" when there are no contacts yet
- **File**: `src/components/crm/ContactList.tsx` (lines 519–528)
- **Issue**: Empty state always shows "Try adjusting your search or filter criteria" even when no contacts exist at all — no CTA to add a first contact.
- **Fix**: Distinguish the two cases: zero total contacts vs. search-filtered no results; add "Add First Contact" CTA for the zero-data case.
- **Source**: ui-audit-2.md

### [INFRA] Three frontend files hardcode the Vercel domain — breaks on preview and custom domains
- **File**: `src/pages/SignEstimate.tsx:5`, `src/pages/SignChangeOrder.tsx:5`, `src/components/crm/TeamView.tsx:161`
- **Issue**: API calls hardcode `https://crm-kanban-integrate.vercel.app` — will break on preview deployments and any custom domain.
- **Fix**: Replace with relative paths (`/api/sign-document`, `/api/send-email`).
- **Source**: infra-audit-2.md

### [INFRA] QuickBooks OAuth `redirectUri` and `fullUrl` hardcoded — breaks on any domain change
- **File**: `api/quickbooks-auth.mjs:27`, `api/quickbooks-callback.mjs:41/47`
- **Issue**: OAuth redirect URI and token exchange URL are hardcoded strings — QuickBooks OAuth requires an exact URI match; any domain change breaks the entire integration.
- **Fix**: Use `${process.env.APP_URL || 'https://crm-kanban-integrate.vercel.app'}/api/quickbooks-callback` everywhere.
- **Source**: infra-audit-2.md

### [INFRA] Supabase URL hardcoded in `quickbooks-callback.mjs` — silently breaks on project migration
- **File**: `api/quickbooks-callback.mjs:7`
- **Issue**: `const SUPABASE_URL = 'https://qgvuzrvpyyrrulhwlzma.supabase.co'` hardcoded — never reads from env vars; project migration would silently break DB writes after QuickBooks OAuth.
- **Fix**: `const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qgvuzrvpyyrrulhwlzma.supabase.co'`.
- **Source**: infra-audit-2.md

### [INFRA] `.env.example` missing all server-side variables — onboarding developers will fail
- **File**: `.env.example`
- **Issue**: Only `VITE_*` frontend variables are documented; `APP_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `QBO_CLIENT_ID/SECRET/ENVIRONMENT`, `QB_ENCRYPT_KEY`, `GROQ_API_KEY`, and all EagleView vars are completely absent.
- **Fix**: Add a `## Server-side (Vercel) Environment Variables` section to `.env.example` with all server-side vars plus a separate EagleView section.
- **Source**: infra-audit.md, infra-audit-2.md, doc-audit.md

---

## P2 — Fix Within First Month

Medium severity items — quality, performance, UX.

---

### [DATA] N+1 pattern — contact detail page fires 7 separate sequential queries
- **File**: `src/lib/database.ts`
- **Issue**: Opening a contact triggers 7 independent DB round-trips: `getContact`, `getJobsByContact`, `getCommunicationsByContact`, `getDocumentsByContact`, `getEstimatesByContact`, `getProjectsByContact`, `getWorkOrdersByContact`.
- **Fix**: Parallelize all 7 with `Promise.all`, or collapse into a single composite Supabase select with nested relations.
- **Source**: db-audit-2.md

### [DATA] Sequential queries in `getInvoiceWithItems` and `getKanbanBoardWithColumns`
- **File**: `src/lib/database.ts`
- **Issue**: Each makes 2 sequential round-trip queries that could be a single embedded select.
- **Fix**: Use Supabase embedded selects: `.select('*, invoice_items(*)')` and `.select('*, kanban_columns(*)')`.
- **Source**: db-audit.md

### [DATA] `createKanbanBoard` and `createInvoice` have no transaction — orphaned parents on child insert failure
- **File**: `src/lib/database.ts` — `createKanbanBoard`, `createInvoice`
- **Issue**: Parent is created, then children in separate unguarded queries — if child insert fails, an orphaned parent remains with no cleanup.
- **Fix**: Wrap in a Supabase RPC transaction or handle cleanup in the error path.
- **Source**: db-audit.md

### [DATA] `createInvite` probes two table names on every call — double sequential network requests
- **File**: `src/lib/database.ts` — `createInvite`
- **Issue**: Probes `invitations` then `invites` on every call — 2 sequential requests where the first always fails.
- **Fix**: Determine the correct table name and remove the probe pattern.
- **Source**: db-audit.md

### [DATA] `getAppointments` probes schema variant on every load — always fails once
- **File**: `src/lib/database.ts` — `getAppointments`
- **Issue**: Makes 2 sequential queries to probe `start_time` vs `date/time` schema variant on every appointments load.
- **Fix**: Standardize the schema and remove the probe pattern; delete the fallback branch once legacy columns are confirmed removed.
- **Source**: db-audit.md, db-audit-2.md

### [DATA] `getUnreadNotifications` has no row limit — unbounded query on every component mount
- **File**: `src/lib/database.ts` — `getUnreadNotifications`
- **Issue**: No row limit on the query — can return thousands of rows on every mount.
- **Fix**: Add `.limit(50)` or implement pagination.
- **Source**: db-audit.md

### [DATA] `localStorage` company cache retains billing data after sign-out
- **File**: `localStorage` company cache
- **Issue**: Stores `stripe_customer_id`, `stripe_subscription_id`, `tax_id` — not cleared on logout, persisting sensitive billing data on shared devices.
- **Fix**: Clear company cache on sign-out.
- **Source**: db-audit.md

### [BUG] PipelineBoard — drag-and-drop has no optimistic update rollback
- **File**: `src/components/crm/PipelineBoard.tsx:82–112`
- **Issue**: Card appears to move during async gap but reverts on failure with no user feedback.
- **Fix**: Implement rollback to previous state in the error path with a toast notification.
- **Source**: bug-audit.md

### [BUG] CSV import blocks main thread with no file size limit
- **File**: `src/components/crm/ContactList.tsx:187`
- **Issue**: Uses `file.text()` with no file size limit — large files block the main thread.
- **Fix**: Add a 5MB file size limit check before reading; use chunked processing for large files.
- **Source**: bug-audit.md

### [BUG] Hardcoded 8.25% tax rate applied globally regardless of location or exempt status
- **File**: `src/components/crm/InvoiceModal.tsx:74`, `src/lib/workOrderHelpers.ts:37`
- **Issue**: Static tax rate ignores company location and tax-exempt customers.
- **Fix**: Read tax rate from company settings; apply `0` for tax-exempt contacts.
- **Source**: bug-audit.md

### [BUG] `FileReader` in `PhotoCapture` has no `onerror` handler — `uploading=true` stuck permanently on failure
- **File**: `src/components/mobile/PhotoCapture.tsx:222–228`
- **Issue**: `FileReader` has no `onerror` handler — hangs `uploading=true` permanently on read failure.
- **Fix**: Add `reader.onerror = () => { setUploading(false); toast.error('Failed to read photo file'); }`.
- **Source**: bug-audit.md

### [BUG] Auth context race — loading set to `false` before profile is stored, causing unauthenticated flash
- **File**: `src/lib/authContext.tsx:120`
- **Issue**: Both `onAuthStateChange` and `getSession().then()` independently call `loadProfile` and `setLoading(false)` — brief frame where `loading = false` but `profile = null`.
- **Fix**: Consolidate auth initialization to a single path; only call `setLoading(false)` after profile is definitively loaded.
- **Source**: bug-audit.md, bug-audit-2.md

### [BUG] Photos page `[toast]` in `useEffect` deps — can cause infinite reload loop on photo errors
- **File**: `src/pages/Photos.tsx:96–99`
- **Issue**: `toast` reference is unstable in the dependency array — can cause an infinite reload loop when photo errors appear.
- **Fix**: Remove `toast` from the dependency array; use `toast` from a stable ref.
- **Source**: bug-audit.md

### [BUG] Sync conflict resolution always makes local records win when `updated_at` is missing
- **File**: `src/lib/syncEngine.ts:192–193`
- **Issue**: Defaults local time to `Date.now()` when `updated_at` missing — always makes local records win over server data.
- **Fix**: Treat missing `updated_at` as "unknown" and prefer server data, or prompt the user.
- **Source**: bug-audit.md

### [BUG] Artificial sleep delays in auth, data load, and PDF export mask race conditions
- **File**: `src/lib/authContext.tsx:89/99/314/323`, `src/components/crm/OwnerPriorityBoard.tsx:62`, `src/components/crm/ReportsAnalytics.tsx:307`
- **Issue**: Multiple `await new Promise(r => setTimeout(r, 500|800))` sleeps in auth retry logic, data loading, and PDF export mask underlying race conditions.
- **Fix**: Replace auth sleeps with exponential backoff; remove `OwnerPriorityBoard` sleep entirely; use `requestAnimationFrame` or render-complete callback for PDF export.
- **Source**: code-audit.md

### [PERF] `getColumnContacts` called inline for every column on every render — up to 40,000 comparisons
- **File**: `src/components/crm/PipelineBoard.tsx` (lines 64–66, 334–338, 392–396)
- **Issue**: `state.contacts.filter()` runs inline in JSX for every column on every render; estimates also filtered per card — O(contacts × estimates).
- **Fix**: Pre-compute `const byStatus = useMemo(() => groupBy(state.contacts, c => c.status), [state.contacts])` and a `contactId → bestEstimate` map outside the render loop.
- **Source**: perf-audit.md

### [PERF] `Dashboard.tsx` — `recentActivity`, `urgentItems`, `topPerformers` computed inline without `useMemo`
- **File**: `src/components/crm/Dashboard.tsx` (lines 60–73)
- **Issue**: All three computed inline on every render — spread + sort/filter for every parent re-render.
- **Fix**: Wrap all three in `useMemo`.
- **Source**: perf-audit.md

### [PERF] `teamMembers.find()` called inside render loops — 2,000 comparisons per render at 100 contacts
- **File**: `src/components/crm/PipelineBoard.tsx`, `ContactList.tsx`, `Dashboard.tsx`
- **Issue**: `state.teamMembers.find(tm => tm.id === contact.assignedTo)` called for every contact card in render loops.
- **Fix**: Pre-compute `const teamById = useMemo(() => Object.fromEntries(state.teamMembers.map(m => [m.id, m])), [state.teamMembers])`.
- **Source**: perf-audit.md

### [PERF] CSV import creates contacts serially — 500-row import = 500 sequential DB round-trips
- **File**: `src/components/crm/ContactList.tsx:186`
- **Issue**: Sequential `await db.createContact()` in a for-loop for CSV imports.
- **Fix**: Use `supabase.from('contacts').insert(batchOfRows)` or `Promise.all(rows.map(...))`.
- **Source**: perf-audit.md

### [PERF] `QueryClient` has no `staleTime`, `gcTime`, or `retry` config — conflicts with manual loadData
- **File**: `src/App.tsx:21`
- **Issue**: Default aggressive refetch-on-focus conflicts with the app's custom manual `loadData` callback.
- **Fix**: `new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } } })`.
- **Source**: perf-audit.md

### [PERF] `html2pdf.js` loaded from external CDN — version mismatch with `package.json`
- **File**: `src/lib/pdfService.ts` (lines 27–48)
- **Issue**: CDN-pinned version (0.10.2) doesn't match package.json (^0.14.0); creates a network dependency for PDF generation.
- **Fix**: Import the locally installed package via `dynamic import('html2pdf.js')` instead of CDN script injection.
- **Source**: perf-audit.md

### [PERF] All communications embedded in every contact object in global state — double memory usage
- **File**: `src/components/AppLayout.tsx` (lines 531–547)
- **Issue**: Communications exist in memory both embedded in contacts and as a raw fetch result.
- **Fix**: Store communications as a separate state slice indexed by `contactId`, loaded on-demand when a contact is selected.
- **Source**: perf-audit.md

### [PERF] `recharts` not isolated in its own Vite chunk — large bundle for routes that don't use it
- **File**: `src/components/crm/ReportsAnalytics.tsx` (lines 1–21)
- **Issue**: All of recharts (~350 KB minified) imported without a separate chunk.
- **Fix**: Add `build.rollupOptions.output.manualChunks: { recharts: ['recharts'] }` in `vite.config.ts`.
- **Source**: perf-audit.md

### [UX] 39 form files have visually-associated but programmatically disconnected labels
- **File**: `src/components/crm/AuthPage.tsx`, `PipelineBoard.tsx`, `WorkOrdersView.tsx`, `EstimatesView.tsx`, `QuickAddModal.tsx` + 34 more
- **Issue**: Only 3 of 39 label-bearing files use `htmlFor` — 36 files have floating labels disconnected from their inputs; screen readers cannot associate labels with controls.
- **Fix**: Add matching `htmlFor="field-id"` on every `<label>` and `id="field-id"` on every `<input>`, `<select>`, `<textarea>`.
- **Source**: ui-audit.md

### [UX] `AuthPage.tsx` email input has no label at all — completely unlabeled for screen readers
- **File**: `src/components/crm/AuthPage.tsx` (lines 390–404)
- **Issue**: The email input has only a decorative icon, no `<label>` element.
- **Fix**: Add `<label htmlFor="auth-email" className="sr-only">Email address</label>` and `id="auth-email"` on the input.
- **Source**: ui-audit.md

### [UX] Kanban cards are `<div>` with no keyboard accessibility — keyboard-only users cannot reach cards
- **File**: `src/components/crm/PipelineBoard.tsx` (lines 362–380, 430–470)
- **Issue**: Cards have `draggable` and `onClick` but no `tabIndex`, `role="button"`, or `onKeyDown`.
- **Fix**: Add `tabIndex={0}`, `role="button"`, `onKeyDown` (Enter/Space activates, arrow keys move between columns), and `aria-label` to every card div.
- **Source**: ui-audit.md

### [UX] Custom `<div>` overlay modals throughout — no focus trapping, no `Escape` key, no `role="dialog"`
- **File**: ~20 files with modal overlays
- **Issue**: Custom div modals instead of `src/components/ui/dialog.tsx` — lack focus trapping, `role="dialog"`, `aria-labelledby`, and Escape-key dismissal.
- **Fix**: Migrate to the existing Radix `Dialog`/`DialogContent` components.
- **Source**: ui-audit.md

### [UX] Notification dropdown panels are plain `<div>` elements — not accessible to keyboard/screen readers
- **File**: `src/components/crm/TopBar.tsx` (lines 241–302), `Sidebar.tsx` (lines 196–246)
- **Issue**: Bell button lacks `aria-expanded` and `aria-haspopup`; notification items are non-focusable `<div onClick>`.
- **Fix**: Add `role="dialog"` + `aria-label` to panel divs; `aria-expanded`/`aria-haspopup="dialog"` to Bell buttons; convert notification items to `<button>` elements.
- **Source**: ui-audit.md

### [UX] Icon-only buttons throughout most-used components have no accessible names
- **File**: `src/components/crm/ContactList.tsx` (lines 360–393), `Sidebar.tsx` (lines 167/282), `TopBar.tsx` (lines 137–140)
- **Issue**: List/grid toggle, select-all, sidebar collapse, search clear, and sign-out buttons use `title` which is not reliably announced by all screen reader + browser pairs.
- **Fix**: Replace `title` with `aria-label` on all icon-only buttons.
- **Source**: ui-audit.md

### [UX] Plan names and prices inconsistent between `SubscriptionView` and `BillingSettings`
- **File**: `src/components/crm/SubscriptionView.tsx`, `src/components/settings/BillingSettings.tsx`
- **Issue**: `SubscriptionView` shows Starter ($49) / Professional ($99) / Enterprise ($199); `BillingSettings` shows Starter ($29) / Pro ($59) / Business ($99) / Enterprise ($179) — contradictory prices erode trust.
- **Fix**: Create a shared `src/lib/planConfig.ts` constants file and import it in both components; verify prices match live Stripe pricing table.
- **Source**: ui-audit-2.md

### [INFRA] `vercel.json` function timeout not set — 3 routes will time out at 10s under normal load
- **File**: `vercel.json`
- **Issue**: No `functions` block means default 10s timeout applies to `stripe-webhook.mjs`, `eagleview-order.mjs`, and `document-handler.mjs` — all can exceed 10s under normal load.
- **Fix**: Add `{ "functions": { "api/stripe-webhook.mjs": { "maxDuration": 30 }, ... } }` to `vercel.json`.
- **Source**: infra-audit.md

### [INFRA] Both `deploy.yml` (GitHub Pages) and `deploy-vercel.yml` trigger on every `main` push
- **File**: `.github/workflows/`
- **Issue**: Ambiguous production target — both workflows run on every push to main.
- **Fix**: Disable or remove `deploy.yml` now that Vercel is the production deployment target.
- **Source**: infra-audit.md

### [INFRA] `quality-gate.yml` CI build passes no env vars — builds against undefined Supabase config
- **File**: `.github/workflows/quality-gate.yml`
- **Issue**: Build step runs without required env vars, so CI results don't reflect actual production behavior.
- **Fix**: Add required env vars to the workflow using GitHub Secrets.
- **Source**: infra-audit.md

### [INFRA] `stripe-webhook.mjs` uses Next.js body-parser config syntax — no-op on Vercel serverless
- **File**: `api/stripe-webhook.mjs:22`
- **Issue**: `export const config = { api: { bodyParser: false } }` is Next.js syntax with no effect in Vercel's plain serverless runtime — Stripe webhook signature verification will fail.
- **Fix**: Remove the export and use proper raw body reading for Vercel functions.
- **Source**: infra-audit.md

### [CODE] `ContactDetail.tsx` is a 3,542-line god component — unmaintainable
- **File**: `src/components/crm/ContactDetail.tsx`
- **Issue**: Manages 41 `useState`/`useEffect` calls and 15 distinct concerns in one file.
- **Fix**: Extract each tab into its own component (`ContactOverviewTab`, `ContactDocumentsTab`, etc.) and move data-loading into custom hooks.
- **Source**: code-audit.md

### [CODE] `DocumentTemplates.tsx` is a 3,319-line god component with embedded raw HTML strings
- **File**: `src/components/crm/DocumentTemplates.tsx`
- **Issue**: Contains hundreds of lines of embedded HTML template strings, folder management, preview rendering, and a variable substitution engine all in one file.
- **Fix**: Extract HTML content to `src/lib/documentTemplateContent.ts`, substitution engine to `src/lib/templateVariableSubstitution.ts`, and split folder/preview into sub-components.
- **Source**: code-audit.md

### [CODE] `SettingsView.tsx` is a 2,310-line god component — tab sub-components already exist but are unused
- **File**: `src/components/crm/SettingsView.tsx`
- **Issue**: 10 settings tabs all inlined; `src/components/settings/` directory already contains partial tab components that are unused.
- **Fix**: Delegate each tab to the corresponding sub-component in `src/components/settings/`.
- **Source**: code-audit.md

### [CODE] Duplicate `IntegrationManager` class in two files — 566 and 673 lines, near-identical logic
- **File**: `src/lib/integrations/integrationManager.ts`, `src/lib/integrations/manager.ts`
- **Issue**: Two implementations of `IntegrationManager` with near-identical `initializeIntegrations`, `loadSavedIntegrations`, `testConnection`, and `handleWebhook`.
- **Fix**: Delete `integrationManager.ts`; update all imports to use the canonical export via `src/lib/integrations/index.ts`.
- **Source**: code-audit.md

### [CODE] DB-to-app mapper functions duplicated across 3+ files with untyped `any` parameters
- **File**: `src/components/AppLayout.tsx`, `EstimatesView.tsx`, `ProjectsView.tsx`
- **Issue**: `dbContactToAppContact`, `mapDbEstimateToApp`, and 8-field project mapping block copy-pasted verbatim across files, all with `any`-typed parameters.
- **Fix**: Move all mappers to a shared `src/lib/mappers.ts` with typed parameters.
- **Source**: code-audit.md

### [CODE] `console.log` calls in production code expose contact IDs, company IDs, and email addresses
- **File**: `src/lib/automationEngine.ts` (5 calls), `src/lib/staleLeadDetection.ts` (9 calls), `src/lib/authDebug.ts`, `src/components/AppLayout.tsx` (13 calls)
- **Issue**: Production business-logic files log PII to the browser console with no dev guard.
- **Fix**: Guard all with `if (import.meta.env.DEV)` or remove; configure `esbuild: { drop: ['console'] }` in `vite.config.ts`.
- **Source**: code-audit.md, perf-audit.md

---

## P3 — Nice to Have

Low severity, polish, documentation.

---

### [UX] Sidebar: 23 flat ungrouped navigation items — cognitive overload
- **File**: `src/components/crm/Sidebar.tsx` (lines 40–63)
- **Issue**: No section headers, dividers, or grouping across all 23 nav items.
- **Fix**: Introduce section labels (Overview, Leads & CRM, Sales, Projects, Insurance, Tools, Admin) as small uppercase headers between groups.
- **Source**: ui-audit-2.md

### [UX] PipelineBoard empty columns have no CTA — dead end for new users
- **File**: `src/components/crm/PipelineBoard.tsx` (lines 494–498)
- **Issue**: Empty columns show only "No contacts" with no icon, link, or button.
- **Fix**: Add an "Add Contact" link/button or link to the Contacts view in the empty column state.
- **Source**: ui-audit.md, ui-audit-2.md

### [UX] Dashboard shows all zeros for new users with no context
- **File**: `src/components/crm/Dashboard.tsx`
- **Issue**: KPI cards and activity feed render as empty/zero with no explanation — looks like a broken state.
- **Fix**: Add a "Getting Started" card that appears when `contacts.length === 0`.
- **Source**: ui-audit-2.md

### [UX] Data load failure shows empty app with no error message or retry button
- **File**: `src/components/AppLayout.tsx` (lines ~733–751)
- **Issue**: `loadData` catch block dispatches empty arrays silently — users on Supabase outage or with invalid sessions see an empty app with no feedback.
- **Fix**: Add a toast error and a `loadError` state with an inline retry button in the main content area.
- **Source**: ui-audit-2.md

### [UX] Mobile header hardcodes "TrussCTR" — white-label tenants see wrong brand
- **File**: `src/components/mobile/ResponsiveLayout.tsx` (line ~152)
- **Issue**: Mobile sticky header displays `<span>TrussCTR</span>` even though `companyLogoUrl` is already loaded; desktop sidebar shows the dynamic company name.
- **Fix**: Add a `companyName` state alongside `companyLogoUrl` in `ResponsiveLayout.tsx`, mirroring the pattern in `Sidebar.tsx`.
- **Source**: ui-audit-2.md

### [UX] Zero use of `src/components/ui/skeleton.tsx` — data views flash from nothing to content
- **File**: 30 files with loading states
- **Issue**: No loading placeholder is shown while data loads; no `aria-busy` announcement.
- **Fix**: Use `<Skeleton>` for loading rows/cards and `aria-busy="true"` on containers while loading.
- **Source**: ui-audit.md

### [UX] `outline-none` on focus rings with insufficient contrast — WCAG 2.1 SC 2.4.11 violation
- **File**: 35 CRM component files
- **Issue**: `focus:ring-blue-500/20` (20% opacity) is below WCAG 3:1 minimum against white.
- **Fix**: Replace with `focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`.
- **Source**: ui-audit.md

### [UX] Legal footer links in sidebar have 3.4:1 contrast ratio — below WCAG AA (4.5:1) for small text
- **File**: `src/components/crm/Sidebar.tsx` (lines 251–259)
- **Issue**: `text-slate-500` on `bg-slate-900` at `text-xs` is below WCAG AA.
- **Fix**: Change to `text-slate-400` or increase to `text-sm`.
- **Source**: ui-audit.md

### [CODE] 16 `eslint-disable-next-line react-hooks/exhaustive-deps` suppressions hiding stale data bugs
- **File**: `src/components/crm/EstimatesView.tsx` + 7 other files
- **Issue**: 16 suppressed lint warnings hide missing hook dependencies that can cause stale data bugs.
- **Fix**: Audit each suppression — add missing dependencies or wrap stable callbacks in `useCallback`.
- **Source**: code-audit.md

### [CODE] Feature toggle save handler is a no-op — UI appears to work but changes are never persisted
- **File**: `src/components/crm/FeatureToggles.tsx:239`
- **Issue**: `// TODO: Save to database` — the save handler does nothing.
- **Fix**: Implement the DB save or disable the UI controls and add a "coming soon" indicator.
- **Source**: code-audit.md

### [CODE] Admin notification for AI config changes is unimplemented — no audit trail
- **File**: `src/lib/aiConfigurationManager.ts:329`
- **Issue**: `// TODO: notify admins via Edge Function` — security-relevant AI configuration mutations have no audit trail.
- **Fix**: Implement notification via Edge Function or create a tracked issue.
- **Source**: code-audit.md

### [CODE] Role resolution pattern copy-pasted in 4 components, each casting to `any`
- **File**: `src/components/crm/Sidebar.tsx`, `SettingsView.tsx`, `PipelineBoard.tsx`, `PipelineBoardEnhanced.tsx`
- **Issue**: `(state.currentUser?.role || profile?.role || 'owner') as any` defeats the `UserRole` union type.
- **Fix**: Extract `resolveUserRole(state, profile): UserRole` into `crmStore.ts`.
- **Source**: code-audit.md

### [CODE] `MobileNav.tsx` polls Supabase every 5 seconds for photo count badge — unnecessary DB load
- **File**: `src/components/mobile/MobileNav.tsx:62`
- **Issue**: `setInterval(loadPhotoCount, 5000)` unnecessarily queries DB every 5s.
- **Fix**: Replace with a Supabase realtime subscription to the photos table.
- **Source**: code-audit.md

### [CODE] Empty `useEffect` body in `src/App.tsx` — dead code
- **File**: `src/App.tsx` (lines 40–42)
- **Issue**: `useEffect(() => { /* comment */ }, [updateAvailable])` — the effect body is just a comment.
- **Fix**: Delete the empty effect entirely.
- **Source**: code-audit.md

### [CODE] Magic number time constants scattered with no named constants
- **File**: `src/App.tsx`, `src/components/crm/StormAlertAutomation.tsx`
- **Issue**: `1000 * 60 * 5` and `60 * 60 * 1000` scattered with no explanation.
- **Fix**: Define `FIVE_MINUTES_MS`, `ONE_HOUR_MS` etc. in `src/lib/constants.ts`.
- **Source**: code-audit.md

### [SEO] `og:image` and `twitter:image` reference `/og.jpg` which does not exist
- **File**: `public/` (missing file), `index.html`
- **Issue**: Social sharing previews on Twitter/X, LinkedIn, Slack, and Facebook will show a broken image.
- **Fix**: Create a 1200×630px branded image at `public/og.jpg`.
- **Source**: seo-audit.md

### [SEO] No canonical link tag — app reachable on multiple domains, SEO penalty risk
- **File**: `index.html`
- **Issue**: No `<link rel="canonical">` — app reachable on Vercel preview URLs, custom domain, and GitHub Pages.
- **Fix**: Add `<link rel="canonical" href="https://app.trussctr.com/" />` to `<head>`.
- **Source**: seo-audit.md

### [SEO] Missing `og:url`, `og:site_name`, `twitter:title`, `twitter:description`
- **File**: `index.html`
- **Issue**: Incomplete Open Graph and Twitter Card meta — social previews will render without key metadata.
- **Fix**: Add `og:url`, `og:site_name`, `twitter:title`, and `twitter:description` to `<head>`.
- **Source**: seo-audit.md

### [SEO] No `sitemap.xml` and `robots.txt` missing `Sitemap:` directive
- **File**: `public/` (missing), `public/robots.txt`
- **Issue**: Public routes may be slow or missed by crawlers; authenticated-only routes are crawlable wasting crawl budget.
- **Fix**: Create `public/sitemap.xml`; add `Sitemap:` directive to `robots.txt`; add `Disallow:` rules for `/photos`, `/sign`, `/sign-estimate`, `/sign-change-order`, `/reset-password`.
- **Source**: seo-audit.md

### [SEO] Duplicate `<meta name="viewport">` tag — second includes `user-scalable=no` (WCAG 1.4.4 violation)
- **File**: `index.html`
- **Issue**: Duplicate viewport tag; `user-scalable=no` prevents zoom for low-vision users.
- **Fix**: Remove the duplicate; consider removing `user-scalable=no`.
- **Source**: seo-audit.md

### [SEO] All routes render with the same document title
- **File**: `src/App.tsx` + all `src/pages/*.tsx`
- **Issue**: Zero per-route `document.title` updates — all routes show the generic title from `index.html`.
- **Fix**: Add `useEffect(() => { document.title = 'Page Name — TrussCTR'; }, [])` in each page component.
- **Source**: seo-audit.md

### [SEO] PWA manifest shortcuts reference icon files that do not exist
- **File**: `public/manifest.json`
- **Issue**: Shortcuts reference `contact-shortcut.png` and `pipeline-shortcut.png` which do not exist in `public/icons/` — only `camera-shortcut.png` is present.
- **Fix**: Create the two missing 96×96px icon files, or remove the broken shortcut entries.
- **Source**: seo-audit.md

### [DOCS] `api/` has 14 active routes with no documentation
- **File**: `api/` (no route manifest)
- **Issue**: No index, no README, no OpenAPI spec for any of the 14 API routes.
- **Fix**: Create `api/README.md` listing each route, method, request shape, required env vars, and auth requirement.
- **Source**: doc-audit.md

### [DOCS] `syncEngine.ts` — 200+ lines of complex offline-sync logic with no JSDoc
- **File**: `src/lib/syncEngine.ts`
- **Issue**: Public interface has no documented parameters, return values, or side effects.
- **Fix**: Add JSDoc to `SyncEngine`, `startSync()`, and `setCallbacks()` covering the sync lifecycle and queue schema.
- **Source**: doc-audit.md

### [DOCS] `progressionRules.ts` — business-critical state machine undocumented; `moveToBoard` silently no-ops
- **File**: `src/lib/progressionRules.ts`
- **Issue**: `handleAutoProgression` and `checkDownPaymentGate` encode critical business rules with no workflow documentation; `moveToBoard` silently no-ops when a board is not found.
- **Fix**: Add a block comment describing the full status progression state machine; log or throw on silent no-op in `moveToBoard`.
- **Source**: doc-audit.md

### [DOCS] README Setup section documents only 2 of 10+ required env vars
- **File**: `README.md`
- **Issue**: Setup section only mentions 2 env vars; at least 8 more are required for production.
- **Fix**: Add a "Required Environment Variables" reference table to README pointing to `.env.example`.
- **Source**: doc-audit.md

### [DOCS] README project structure diagram is stale — omits `api/` directory and 20+ new files
- **File**: `README.md`
- **Issue**: Structure diagram was not updated when `api/` and many `src/lib/` files were added.
- **Fix**: Update diagram to include `api/` with per-route descriptions and update `src/lib/` to match current inventory.
- **Source**: doc-audit.md

### [DOCS] README Deployment section describes GitHub Pages/Netlify — `api/` is incompatible with both
- **File**: `README.md`
- **Issue**: No warning that Vercel functions in `api/` are incompatible with GitHub Pages or Netlify.
- **Fix**: Add a callout in the Deployment section linking to `DEPLOY-VERCEL.md`.
- **Source**: doc-audit.md

### [DEPS] `react-beautiful-dnd` unused — adds ~30KB to bundle
- **File**: `package.json`
- **Issue**: Zero imports in entire codebase; `PipelineBoard.tsx` uses native HTML drag events.
- **Fix**: `npm uninstall react-beautiful-dnd @types/react-beautiful-dnd`
- **Source**: dep-audit.md

### [DEPS] `zustand` and `react-is` unused and `react-is` conflicts with React 18
- **File**: `package.json`
- **Issue**: Zero imports of `zustand` in `src/`; `react-is@^19.2.4` conflicts with React 18 target.
- **Fix**: `npm uninstall zustand react-is`
- **Source**: dep-audit.md

### [DEPS] `react-day-picker` used but not listed in `package.json`
- **File**: `src/components/ui/calendar.tsx`
- **Issue**: `DayPicker` imported from `"react-day-picker"` but the package is not in `package.json` — works only as a hidden transitive dep; fragile.
- **Fix**: `npm install react-day-picker`
- **Source**: dep-audit.md

### [DEPS] `stripe` server SDK in root `dependencies` — risks client-side bundling
- **File**: `package.json`
- **Issue**: Node.js `stripe` SDK listed in root production dependencies but only used in `api/` — Vite may accidentally bundle it client-side.
- **Fix**: Create `api/package.json` with `stripe` as its own dependency, separate from the Vite frontend build.
- **Source**: dep-audit.md

### [DEPS] `@types/*` packages in `dependencies` instead of `devDependencies` — bloats production deploys
- **File**: `package.json`
- **Issue**: `@types/dexie`, `@types/uuid`, `@types/xlsx` are in `dependencies` — TypeScript declaration packages have zero runtime value.
- **Fix**: Move all three to `devDependencies`.
- **Source**: infra-audit-2.md

---

*verified by vibecheck*
