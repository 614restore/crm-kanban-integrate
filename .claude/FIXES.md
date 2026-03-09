---
agent: fix-planner
status: fail
findings: 47
date: 2026-03-08
sources: bug-audit.md, security-audit.md, ui-audit.md, db-audit.md, infra-audit.md
---

# TrussCTR — Prioritized Fix List

**Generated:** 2026-03-08  
**Total findings consolidated:** 47 (from 5 audit agents — 11 bugs, 12 security, 24 UI/UX, 12 DB, 14 infra)

---

## BLOCKER — Fix before the first paying customer

These issues directly break billing, expose customer data, or create security holes that cannot be deferred.

---

### B-01 — Stripe webhook writes to non-existent `subscriptions` table

| | |
|---|---|
| **Source** | bug-audit BUG-01, db-audit FINDING-1 |
| **Files** | `api/stripe-webhook.mjs` — all event handlers |
| **Complexity** | M |

Every Stripe webhook event (`checkout.session.completed`, `customer.subscription.updated`, `invoice.payment_failed`, `customer.subscription.deleted`) upserts/updates a table named `subscriptions` that does not exist. The schema puts subscription fields directly on `companies`. When a customer pays, their `companies.subscription_status` stays `'trialing'` forever — they are never activated.

**Change needed:**  
Replace all `supabase.from('subscriptions')` calls with updates to `companies`, using `stripe_customer_id` or `stripe_subscription_id` as the lookup key:

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

// customer.subscription.updated / invoice.payment_failed / customer.subscription.deleted
await supabase
  .from('companies')
  .update({ subscription_status: sub.status, subscription_plan: planId })
  .eq('stripe_subscription_id', sub.id);
```

---

### B-02 — No JWT authentication on any API endpoint (open relay + IDOR + AI abuse)

| | |
|---|---|
| **Source** | security-audit FINDING-01, FINDING-02, FINDING-03 |
| **Files** | `api/ai-draft.mjs`, `api/send-email.mjs`, `api/send-invite.mjs`, `api/stripe-checkout.mjs`, `api/stripe-portal.mjs`, `api/quickbooks-sync.mjs`, `api/sign-document.mjs` |
| **Complexity** | L |

Every serverless function is reachable unauthenticated via `curl`. Impact: anyone can burn your OpenAI quota, spam from `scopemgr@614restore.com`, or open any Stripe billing portal by guessing a customer ID.

**Change needed:**  
Create `api/auth-middleware.mjs`:

```js
import { createClient } from '@supabase/supabase-js';

export async function requireAuth(req, res) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) { res.status(401).json({ error: 'Invalid session' }); return null; }
  return user;
}
```

Add `const user = await requireAuth(req, res); if (!user) return;` at the top of each handler listed above. (`sign-document.mjs` and `sign-change-order.mjs` are intentionally public — skip those.)

---

### B-03 — Delete `debug-env.mjs` — publicly maps all secrets

| | |
|---|---|
| **Source** | security-audit FINDING-05, infra-audit INFRA-08 |
| **File** | `api/debug-env.mjs` |
| **Complexity** | S |

`GET /api/debug-env` reveals which secret keys are configured in Vercel (Stripe, Supabase service role, QuickBooks, Resend, OpenAI) and exposes `QBO_ENVIRONMENT` value in plaintext — all to unauthenticated callers.

**Change needed:** Delete the file. No replacement needed.

```bash
rm api/debug-env.mjs
```

---

### B-04 — XSS via `?plan=` URL parameter in `Index.tsx` checkout banner

| | |
|---|---|
| **Source** | security-audit FINDING-04 |
| **File** | `src/pages/Index.tsx` lines 11–27 |
| **Complexity** | S |

`banner.innerHTML` interpolates the `?plan=` query param directly, allowing `/?checkout=success&plan=<img src=x onerror=alert(document.cookie)>` to execute JS.

**Change needed:** Replace `innerHTML` with safe DOM construction:

```tsx
const strong = document.createElement('strong');
strong.textContent = `Welcome to TrussCTR${planName ? ` ${planName}` : ''}!`;
// Use appendChild() for all other banner elements — never innerHTML for user-controlled values
```

---

### B-05 — Stripe Customer Portal IDOR — any caller can open any billing portal

| | |
|---|---|
| **Source** | security-audit FINDING-03 |
| **File** | `api/stripe-portal.mjs` lines 24–28 |
| **Complexity** | M |

`customerId` is accepted from the request body with no validation. An attacker with any Stripe customer ID can cancel subscriptions, view invoices, or change payment methods for another company.

**Change needed:** After adding auth (B-02), look up `stripe_customer_id` server-side:

```js
const user = await requireAuth(req, res);
if (!user) return;
const { data: company } = await supabase
  .from('companies')
  .select('stripe_customer_id')
  .eq('id', user.user_metadata.company_id)
  .single();
const customerId = company?.stripe_customer_id;
if (!customerId) return res.status(400).json({ error: 'No Stripe customer on file' });
```

Remove the `customerId` parameter from the request body entirely.

---

### B-06 — `detectSessionInUrl: false` breaks email confirmation and password reset on Vercel

| | |
|---|---|
| **Source** | infra-audit INFRA-03 |
| **File** | `src/lib/supabase.ts` line 47 |
| **Complexity** | S |

The flag was set to work around GitHub Pages hash routing, but Vercel uses real paths. With it `false`, Supabase never exchanges the PKCE code from confirmation/reset emails — users land on a page that appears to do nothing.

**Change needed:**

```ts
const isHashRouter = import.meta.env.VITE_HASH_ROUTING === 'true';
// In createClient auth options:
detectSessionInUrl: !isHashRouter,
```

Add to Vercel env vars: `VITE_HASH_ROUTING=false`. Add to GitHub Pages build: `VITE_HASH_ROUTING=true`.

---

### B-07 — `APP_URL` missing → Stripe redirects to GitHub Pages after payment

| | |
|---|---|
| **Source** | infra-audit INFRA-01 |
| **Files** | `api/stripe-checkout.mjs` line 30, `api/stripe-portal.mjs` line 31 |
| **Complexity** | S |

Both files fall back to `'https://614restore.github.io/crm-kanban-integrate'` when `APP_URL` is unset, routing paying customers off the live product.

**Change needed:**  
1. Add `APP_URL=https://crm-kanban-integrate.vercel.app` to Vercel env vars immediately.  
2. Replace the silent fallback with a hard fail in both files:

```js
const appUrl = process.env.APP_URL;
if (!appUrl) return res.status(500).json({ error: 'APP_URL is not configured' });
```

---

### B-08 — No paywall enforcement when trial expires or subscription lapses

| | |
|---|---|
| **Source** | db-audit FINDING-2 |
| **Files** | `src/components/AppLayout.tsx`, `src/lib/authContext.tsx` |
| **Complexity** | M |

There is zero code that locks out users when `trial_ends_at` is past or `subscription_status` is `'canceled'`/`'past_due'`. After the 14-day trial, users retain full access free indefinitely.

**Change needed:**  
In `AppLayout.tsx` (or `authContext.tsx`), add a subscription gate:

```tsx
const trialExpired = company?.subscription_status === 'trialing'
  && company?.trial_ends_at
  && new Date(company.trial_ends_at) < new Date();

const accessBlocked = trialExpired
  || company?.subscription_status === 'canceled'
  || company?.subscription_status === 'past_due';

if (accessBlocked) {
  return <SubscriptionRequiredModal />;
}
```

---

### B-09 — Hardcoded GitHub Pages paths in `AuthPage.tsx` — legal links 404 on Vercel

| | |
|---|---|
| **Source** | ui-audit FINDING-6 |
| **File** | `src/components/crm/AuthPage.tsx` line 545 (legal links) |
| **Complexity** | S |

Terms, EULA, and Privacy Policy links hardcode `/crm-kanban-integrate/terms` etc., which 404 on Vercel.

**Change needed:**

```tsx
// Replace all instances of:
href="/crm-kanban-integrate/terms"
// With:
href={`${import.meta.env.BASE_URL}terms`}
// Or simply:
href="/terms"
// (and ensure Vercel routes /terms → correct page)
```

---

## HIGH — Fix this week

Customer-facing bugs, significant UX issues, and data correctness problems.

---

### H-01 — Template injection with wrong contact's private insurance data

| | |
|---|---|
| **Source** | bug-audit BUG-04 |
| **File** | `src/components/crm/CommunicationHub.tsx` — `handleUseTemplate` |
| **Complexity** | S |

`const contact = selectedCommData?.contact || state.contacts[0]` silently falls back to a random customer when no communication is selected. A user could send another customer's claim number, deductible, and adjuster name to the wrong recipient.

**Change needed:** Remove the silent fallback:

```js
if (!selectedCommData?.contact) {
  toast.error('Select a communication first to use a template');
  return;
}
const contact = selectedCommData.contact;
```

---

### H-02 — `trial_end` always `null` in webhook — trial dates never stored

| | |
|---|---|
| **Source** | bug-audit BUG-02 |
| **File** | `api/stripe-webhook.mjs` line ~72 |
| **Complexity** | S |

`trial_end: session.subscription ? null : null` — both branches are `null`. Trial end dates are silently lost.

**Change needed:** Let the `customer.subscription.updated` event (which includes `trial_end` on the subscription object) handle trial dates, and remove the dead field from the `checkout.session.completed` handler. In the `customer.subscription.updated` handler, add:

```js
trial_ends_at: sub.trial_end
  ? new Date(sub.trial_end * 1000).toISOString()
  : null,
```

---

### H-03 — User stuck with empty CRM after setup failure (no error, no recovery)

| | |
|---|---|
| **Source** | bug-audit BUG-03 |
| **File** | `src/lib/authContext.tsx` lines ~98–115 |
| **Complexity** | M |

When `setupNewUser` succeeds but retry finds no `company_id`, the user sees a blank CRM with no message and no recovery path.

**Change needed:** In `loadProfile`, after detecting `profile` exists but `company_id` is null:

```tsx
if (profile && !profile.company_id) {
  dispatch({ type: 'SET_ERROR', payload: 'Account setup incomplete. Please refresh or contact support.' });
  return;
}
```

Add a visible error state and a "Retry" button in the shell component.

---

### H-04 — RLS recursion bug reintroduced in 5 v2 PM tables

| | |
|---|---|
| **Source** | db-audit FINDING-4 |
| **Files** | New migration needed (fixes `supabase/migrations/20260307_v2_pm_features.sql`) |
| **Complexity** | M |

`crew_schedules`, `change_orders`, `permits`, `equipment`, `equipment_assignments` use the old recursive subquery pattern `company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())` which causes RLS hangs. The 20260305 fix migration doesn't cover tables created after it.

**Change needed:** Create `supabase/migrations/20260308_fix_v2_rls_recursion.sql` replacing all 5 sets of policies with `get_my_company_id()` pattern. See db-audit FINDING-4 for the exact SQL.

---

### H-05 — Expense receipt storage bucket allows cross-tenant reads

| | |
|---|---|
| **Source** | db-audit FINDING-5 |
| **Files** | New migration needed (fixes `supabase/migrations/20260308_expenses_table.sql`) |
| **Complexity** | M |

Storage policy for `expense-receipts` only checks `auth.uid() IS NOT NULL` — any authenticated user from any company can read any other company's receipts.

**Change needed:** Create a follow-up migration scoping by company folder:

```sql
DROP POLICY "expense_receipts_select" ON storage.objects;
CREATE POLICY "expense_receipts_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'expense-receipts'
    AND (storage.foldername(name))[1] = (get_my_company_id())::text
  );
```

Ensure application code stores receipts under `{company_id}/{filename}` paths.

---

### H-06 — `getContact`, `getJobsByContact`, etc. have no `company_id` defense-in-depth filter

| | |
|---|---|
| **Source** | db-audit FINDING-3, security-audit FINDING-08 |
| **File** | `src/lib/database.ts` |
| **Complexity** | S |

Four "get by ID" methods rely solely on RLS for tenant isolation. If RLS is ever misconfigured, these would expose cross-tenant data with no application-layer fallback.

**Change needed:** Add `.eq('company_id', companyId)` to `getContact`, `getJobsByContact`, `getCommunicationsByContact`, `getDocumentsByContact`, and update callers to pass `companyId`.

---

### H-07 — QuickBooks OAuth callback hardcoded to GitHub Pages URL

| | |
|---|---|
| **Source** | infra-audit INFRA-02 |
| **File** | `api/quickbooks-callback.mjs` line 12 |
| **Complexity** | S |

`const appBase = 'https://614restore.github.io/crm-kanban-integrate'` — always redirects to GitHub Pages after QBO auth, even on Vercel.

**Change needed:**

```js
const appBase = process.env.APP_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
if (!appBase) throw new Error('APP_URL not configured');
```

---

### H-08 — Wildcard CORS on email and document-signing endpoints

| | |
|---|---|
| **Source** | infra-audit INFRA-09 |
| **Files** | `api/send-email.mjs`, `api/sign-document.mjs`, `api/sign-change-order.mjs` |
| **Complexity** | S |

`Access-Control-Allow-Origin: *` allows any external site to trigger email relay or submit signatures.

**Change needed:** Restrict to known origins in all three files:

```js
const ALLOWED_ORIGINS = [
  'https://crm-kanban-integrate.vercel.app',
  'https://614restore.github.io',
];
const origin = req.headers.origin || '';
res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
res.setHeader('Vary', 'Origin');
```

---

### H-09 — `send-email.mjs` accepts arbitrary `from` address (open phishing relay)

| | |
|---|---|
| **Source** | security-audit FINDING-02 |
| **File** | `api/send-email.mjs` |
| **Complexity** | S |

The `from` field comes directly from the request body with no validation, allowing any caller to send phishing emails appearing to come from `scopemgr@614restore.com`.

**Change needed:** Remove `from` from the destructured request body. Hardcode the sender:

```js
from: '614 Restore <scopemgr@614restore.com>', // never accept from caller
```

Also add HTML sanitization on the `html` body before passing to Resend.

---

### H-10 — `handleSaveCompose` silently does nothing when no contact selected

| | |
|---|---|
| **Source** | bug-audit BUG-05 |
| **File** | `src/components/crm/CommunicationHub.tsx` — `handleSaveCompose` |
| **Complexity** | S |

If the user types a message but hasn't selected a contact, clicking Save is a silent no-op — no error, no feedback.

**Change needed:**

```js
if (!composeContactId) {
  toast.error('Please select a contact before saving');
  return;
}
```

---

### H-11 — "Save" button has Send icon — misleads users about whether email is sent

| | |
|---|---|
| **Source** | ui-audit FINDING-11 |
| **File** | `src/components/crm/CommunicationHub.tsx` line 749 |
| **Complexity** | S |

A `<Send />` icon with "Save" label is contradictory and erodes trust.

**Change needed:** Use contextual labels by `composeType`:

```tsx
const actionLabel = ['note', 'call'].includes(composeType) ? 'Log' : 'Send';
const ActionIcon = ['note', 'call'].includes(composeType) ? Clipboard : Send;
```

---

### H-12 — Reply input is single-line `<input>` — inadequate for emails/notes

| | |
|---|---|
| **Source** | ui-audit FINDING-13 |
| **File** | `src/components/crm/CommunicationHub.tsx` line 570 |
| **Complexity** | S |

The reply field is `<input type="text">` — text overflows horizontally and there's no way to write multi-line content.

**Change needed:** Replace with:

```tsx
<textarea
  rows={3}
  className="... resize-none"
  value={replyText}
  onChange={(e) => setReplyText(e.target.value)}
  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSendReply(); }}
  placeholder="Type a reply... (Shift+Enter for new line)"
/>
```

---

### H-13 — Empty state copy blames user for empty data on a brand-new account

| | |
|---|---|
| **Source** | ui-audit FINDING-14 |
| **File** | `src/components/crm/CommunicationHub.tsx` line 450 |
| **Complexity** | S |

"Try adjusting your search or filter" shown to new users who have never added data.

**Change needed:** Branch on whether data exists vs is filtered (see ui-audit FINDING-14 for full code).

---

### H-14 — `BILLING_SETTINGS_VIEW` defined but never used — no "Go to Billing" link in banner

| | |
|---|---|
| **Source** | bug-audit BUG-11, ui-audit FINDING-10 |
| **File** | `src/components/AppLayout.tsx` line 317 |
| **Complexity** | S |

The trial banner tells users to go to Billing but provides no link to get there.

**Change needed:** Use the constant:

```tsx
<button
  onClick={() => dispatch({ type: 'SET_VIEW', payload: BILLING_SETTINGS_VIEW })}
  className="underline font-medium hover:no-underline ml-2"
>
  Subscribe now →
</button>
```

---

### H-15 — Urgency banner (≤7 days left) has no copy button for LAUNCH50

| | |
|---|---|
| **Source** | ui-audit FINDING-7 |
| **File** | `src/components/AppLayout.tsx` line 374 |
| **Complexity** | S |

The early trial banner (days 1–7) has a copy button; the urgency banner (days 8–14, when conversion peaks) shows the code as plain text only.

**Change needed:** Add the same `handleCopy` button pattern to the `showUrgency` banner variant.

---

### H-16 — Promo badge on signup page doesn't show the promo code

| | |
|---|---|
| **Source** | ui-audit FINDING-2 |
| **File** | `src/components/crm/AuthPage.tsx` line 271 |
| **Complexity** | S |

The signup header says "Subscribe within your trial — get 50% off your first 3 months" but omits the actual code `LAUNCH50`. The user has no idea what code to enter.

**Change needed:** Inline the code: `Use code **LAUNCH50** at checkout — 50% off your first 3 months.` Style it in `font-mono` with a small copy button.

---

### H-17 — `Manage Billing` button opens for trial users with no Stripe account

| | |
|---|---|
| **Source** | bug-audit BUG-09 |
| **File** | `src/components/crm/SubscriptionView.tsx` — `handleManageBilling` |
| **Complexity** | S |

Trial users who haven't paid have no Stripe customer record; the portal returns an error page.

**Change needed:**

```tsx
{company?.stripe_customer_id && (
  <button onClick={handleManageBilling}>Manage Billing</button>
)}
```

---

### H-18 — 11 server-side env vars missing from `.env.example`

| | |
|---|---|
| **Source** | infra-audit INFRA-06 |
| **File** | `.env.example` |
| **Complexity** | S |

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `RESEND_API_KEY`, `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_ENVIRONMENT`, `QB_ENCRYPT_KEY`, `OPENAI_API_KEY` are all required by Vercel functions but completely undocumented.

**Change needed:** Add a `# === SERVER-SIDE (Vercel env vars only) ===` section to `.env.example` documenting all 11 with comments on impact if missing.

---

### H-19 — Auth page email field has no `<label>` (accessibility + inconsistency)

| | |
|---|---|
| **Source** | ui-audit FINDING-1 |
| **File** | `src/components/crm/AuthPage.tsx` line 338 |
| **Complexity** | S |

Every other field has an explicit `<label>` except email, which only has a placeholder. Breaks screen readers.

**Change needed:** Add `<label className="block text-sm font-medium text-gray-700 mb-1">Email</label>` above the email input.

---

### H-20 — `VITE_BASE_URL` comment in `.env.example` is wrong — causes broken Vercel assets

| | |
|---|---|
| **Source** | infra-audit INFRA-07 |
| **File** | `.env.example` line 17 |
| **Complexity** | S |

Comment says "Automatically set by Vite config" — it is not. Devs won't set it to `/` for Vercel, breaking all asset references.

**Change needed:** Replace comment:

```
# Vercel deployment: set VITE_BASE_URL=/
# GitHub Pages: leave unset (Vite config applies /crm-kanban-integrate/ automatically)
VITE_BASE_URL=/
```

---

## MEDIUM — Fix before scaling

Performance, edge cases, and secondary UX issues.

---

### M-01 — Missing `company_id` indexes on 5 core tables

| | |
|---|---|
| **Source** | db-audit FINDING-6 |
| **Files** | New migration needed |
| **Complexity** | S |

`estimates`, `projects`, `work_orders`, `suppliers`, `material_orders` — all missing `company_id` index. Every list-page query and RLS evaluation does a full scan.

**Change needed:**

```sql
CREATE INDEX IF NOT EXISTS idx_estimates_company_id ON estimates (company_id);
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON projects (company_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_company_id ON work_orders (company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON suppliers (company_id);
CREATE INDEX IF NOT EXISTS idx_material_orders_company_id ON material_orders (company_id);
```

---

### M-02 — Missing Stripe indexes on `companies` table

| | |
|---|---|
| **Source** | db-audit FINDING-7 |
| **Files** | New migration needed |
| **Complexity** | S |

Once B-01 is fixed, every webhook event scans the entire `companies` table to find the row by `stripe_customer_id` or `stripe_subscription_id`.

**Change needed:**

```sql
CREATE INDEX IF NOT EXISTS idx_companies_stripe_customer_id ON companies (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_stripe_subscription_id ON companies (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
```

---

### M-03 — Trial banner dismissal not persisted — reappears on every page load

| | |
|---|---|
| **Source** | ui-audit FINDING-8 |
| **File** | `src/components/AppLayout.tsx` line 322 |
| **Complexity** | S |

`dismissed` is component-local state — resets on every navigation.

**Change needed:**

```tsx
const [dismissed, setDismissed] = useState(
  () => localStorage.getItem('trial_banner_dismissed') === '1'
);
// in dismiss handler:
localStorage.setItem('trial_banner_dismissed', '1');
setDismissed(true);
```

---

### M-04 — Clipboard errors swallowed silently in trial banner copy button

| | |
|---|---|
| **Source** | bug-audit BUG-06 |
| **File** | `src/components/AppLayout.tsx` — `handleCopy` |
| **Complexity** | S |

`navigator.clipboard` rejects in HTTP dev contexts; no `.catch()` means the button appears broken.

**Change needed:**

```js
navigator.clipboard.writeText(LAUNCH_PROMO_CODE)
  .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
  .catch(() => toast.error(`Copy failed — code is: ${LAUNCH_PROMO_CODE}`));
```

---

### M-05 — AI Draft produces `"Subject: \n\n..."` when subject is empty

| | |
|---|---|
| **Source** | bug-audit BUG-07 |
| **File** | `src/components/crm/CommunicationHub.tsx` — `handleAIDraft` |
| **Complexity** | S |

Empty subject from OpenAI produces a malformed artifact at the top of the compose field.

**Change needed:**

```js
if (data.subject && data.body) {
  setComposeText(`Subject: ${data.subject}\n\n${data.body}`);
} else if (data.body) {
  setComposeText(data.body);
} else {
  toast.error('AI returned an empty draft — please try again');
}
```

---

### M-06 — Contact avatar crashes on null `firstName`/`lastName`

| | |
|---|---|
| **Source** | bug-audit BUG-08 |
| **Files** | `src/components/crm/CommunicationHub.tsx`, `src/lib/database.ts` — `dbContactToAppContact` |
| **Complexity** | S |

`dbContactToAppContact` maps `firstName: dbContact.first_name` with no null guard. Null `first_name` renders blank initials; future `.toUpperCase()` calls would throw.

**Change needed:** In `dbContactToAppContact`:

```js
firstName: dbContact.first_name || '',
lastName: dbContact.last_name || '',
```

And in avatar JSX use optional chaining: `firstName?.[0] || '?'`.

---

### M-07 — URL parameter injection in `sign-document.mjs` via unvalidated `estimateId`

| | |
|---|---|
| **Source** | security-audit FINDING-06 |
| **File** | `api/sign-document.mjs` lines 36, 59 |
| **Complexity** | S |

`estimateId` is interpolated into a Supabase REST URL without UUID validation, allowing query parameter injection using the service role key (bypasses RLS).

**Change needed:**

```js
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(estimateId)) {
  return res.status(400).json({ error: 'Invalid estimateId format' });
}
```

Apply same validation to `sign-change-order.mjs` and any other handler using IDs in raw URLs.

---

### M-08 — Rate limiting missing on cost-incurring endpoints

| | |
|---|---|
| **Source** | security-audit FINDING-07 |
| **Files** | `api/ai-draft.mjs`, `api/send-email.mjs` |
| **Complexity** | L |

Even after adding auth (B-02), a single authenticated user can loop-call these endpoints causing runaway OpenAI charges or Resend quota exhaustion.

**Change needed:** Add Upstash Redis rate limiting (see security-audit FINDING-07 for full implementation). Also cap AI input size:

```js
const MAX_CONTEXT_CHARS = 2000;
if (context?.length > MAX_CONTEXT_CHARS) {
  return res.status(400).json({ error: 'context too long' });
}
```

---

### M-09 — Supabase URL hardcoded in `sign-change-order.mjs` and `quickbooks-callback.mjs`

| | |
|---|---|
| **Source** | infra-audit INFRA-05 |
| **Files** | `api/sign-change-order.mjs` line 11, `api/quickbooks-callback.mjs` line 7 |
| **Complexity** | S |

Project URL hardcoded in source — silently connects to wrong database if URL changes or staging is needed.

**Change needed:** Remove all hardcoded URLs. Replace with:

```js
const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl) throw new Error('SUPABASE_URL not configured');
```

---

### M-10 — Service worker non-functional on Vercel (hardcoded GitHub Pages path prefix)

| | |
|---|---|
| **Source** | infra-audit INFRA-04 |
| **File** | `public/sw.js` |
| **Complexity** | M |

`urlsToCache` and the fetch handler are hardcoded to `/crm-kanban-integrate/`. On Vercel (`/`), every fetch hits an early `return` and the SW does nothing — no caching, no offline mode, PWA is broken.

**Change needed:**

```js
const BASE = self.registration.scope;
const urlsToCache = [BASE, `${BASE}index.html`, `${BASE}manifest.json`];
// In fetch handler:
if (!url.pathname.startsWith(new URL(BASE).pathname)) return;
// fallback:
caches.match(`${BASE}index.html`)
```

---

### M-11 — `vercel.json` has no function timeout configuration

| | |
|---|---|
| **Source** | infra-audit INFRA-10 |
| **File** | `vercel.json` |
| **Complexity** | S |

Default 10s timeout is inadequate for `stripe-webhook.mjs` (DB writes + Stripe API) and `quickbooks-sync.mjs` (full accounting sync).

**Change needed:**

```json
{
  "functions": {
    "api/stripe-webhook.mjs": { "maxDuration": 30 },
    "api/quickbooks-sync.mjs": { "maxDuration": 60 },
    "api/quickbooks-callback.mjs": { "maxDuration": 30 }
  }
}
```

---

### M-12 — `update_my_company` RPC silently drops 5 company fields

| | |
|---|---|
| **Source** | db-audit FINDING-8 |
| **Files** | `supabase/migrations/20260306_fix_company_access.sql`, `src/lib/database.ts` |
| **Complexity** | M |

The RPC only accepts 9 parameters; `database.ts` passes 14. Fields `tagline`, `contractor_license`, `tax_id`, `from_email`, `from_name` are silently discarded when the RPC runs.

**Change needed:** Add the missing parameters to the RPC signature, or rely exclusively on the direct table-update fallback path already in `database.ts` (audited and confirm it works).

---

### M-13 — Role selector shown as disabled on invite flow — confusing UI

| | |
|---|---|
| **Source** | ui-audit FINDING-5 |
| **File** | `src/components/crm/AuthPage.tsx` line 465 |
| **Complexity** | S |

When accepting an invite, a disabled `<select>` for Role appears with no explanation.

**Change needed:** When `inviteToken` is set, hide the role selector and show read-only text: "Role assigned by your team admin."

---

### M-14 — AI Draft button disappears silently when switching communication types

| | |
|---|---|
| **Source** | ui-audit FINDING-12 |
| **File** | `src/components/crm/CommunicationHub.tsx` line 724 |
| **Complexity** | S |

AI Draft button only renders for `composeType === 'email'` and vanishes for SMS/note without explanation.

**Change needed:** Render for all types but disable with a tooltip for non-email: "AI drafting available for email only."

---

### M-15 — Beta users' `trial_ends_at` all point to the migration run date

| | |
|---|---|
| **Source** | db-audit FINDING-12 |
| **Files** | One-time SQL update |
| **Complexity** | S |

When `add-subscription-plans.sql` added the `trial_ends_at` column, PostgreSQL filled all existing rows with `ALTER TABLE` time + 14 days, giving every beta user the same expiry instead of 14 days from their own signup.

**Change needed:**

```sql
UPDATE companies
SET trial_ends_at = created_at + INTERVAL '14 days'
WHERE subscription_status = 'trialing'
  AND trial_ends_at IS NOT NULL;
```

Run once in Supabase SQL editor.

---

## LOW — Nice to have

---

### L-01 — Stripe pricing table renders with empty `customer-email` during profile load

| | |
|---|---|
| **Source** | bug-audit BUG-10 |
| **File** | `src/components/crm/SubscriptionView.tsx` |
| **Complexity** | S |

Brief flash of `customer-email=""` during load may cause Stripe pre-fill to fail.

**Change needed:** Conditionally render: `{profile?.email && <stripe-pricing-table ... customer-email={profile.email} />}`

---

### L-02 — N+1 queries in `getInvoiceWithItems` and `getKanbanBoardWithColumns`

| | |
|---|---|
| **Source** | db-audit FINDING-10 |
| **File** | `src/lib/database.ts` |
| **Complexity** | S |

Two separate sequential queries where a single nested select would suffice.

**Change needed:** Use Supabase nested select:

```ts
await supabase.from('invoices').select('*, invoice_items(*)').eq('id', invoiceId).single();
await supabase.from('kanban_boards').select('*, kanban_columns(*)').eq('id', boardId).single();
```

---

### L-03 — Trial banner copy button has no clipboard icon — low discoverability

| | |
|---|---|
| **Source** | ui-audit FINDING-9 |
| **File** | `src/components/AppLayout.tsx` line 355 |
| **Complexity** | S |

Button looks like a code chip, not a button. Add `<ClipboardCopy size={12} />` icon to the left of `LAUNCH50`.

---

### L-04 — Template card has `cursor-pointer` but no `onClick` — false affordance

| | |
|---|---|
| **Source** | ui-audit FINDING-15 |
| **File** | `src/components/crm/CommunicationHub.tsx` line 607 |
| **Complexity** | S |

Either add `onClick={() => handleUseTemplate(template)}` to the card `<div>`, or remove `cursor-pointer` from the wrapper.

---

### L-05 — `npm run deploy` deploys to GitHub Pages, not Vercel — confusing for new devs

| | |
|---|---|
| **Source** | infra-audit INFRA-11 |
| **File** | `package.json` line 11 |
| **Complexity** | S |

Rename scripts:

```json
"deploy:ghpages": "npm run build && gh-pages -d dist",
"deploy:vercel": "vercel --prod"
```

---

### L-06 — `supabaseKey` exported unnecessarily from `supabase.ts`

| | |
|---|---|
| **Source** | security-audit FINDING-09 |
| **File** | `src/lib/supabase.ts` line 63 |
| **Complexity** | S |

Change `export { supabase, supabaseUrl, supabaseKey }` → `export { supabase, supabaseUrl }`. No consumer needs the raw key string.

---

### L-07 — `handle_new_user` trigger has two conflicting definitions across migrations

| | |
|---|---|
| **Source** | db-audit FINDING-9 |
| **Files** | `supabase/migrations/20260228183000_roles_rls_and_owner_backfill.sql`, `supabase/migrations/20260306_fix_company_access.sql` |
| **Complexity** | M |

Two migrations redefine the trigger with different behavior. Final state is correct (20260306 wins), but the intent is undocumented and the NULL `company_id` window after signup is unguarded.

**Change needed:** Add explanatory comments to 20260306 migration. Consider wrapping company creation in an RPC to make the NULL window atomic (see db-audit FINDING-9).

---

### L-08 — No password strength indicator on signup

| | |
|---|---|
| **Source** | ui-audit FINDING-3 |
| **File** | `src/components/crm/AuthPage.tsx` line 130 |
| **Complexity** | S |

Only a 6-character minimum enforced post-submit. Add a real-time strength meter (regex-based or `zxcvbn`) below the password field during signup.

---

## Summary

| Priority | Count | Blocking Concern |
|---|---|---|
| **BLOCKER** | 9 | Billing never activates, auth bypass, data exposure |
| **HIGH** | 20 | Revenue, privacy, customer-facing UX |
| **MEDIUM** | 15 | Scale, edge cases, secondary UX |
| **LOW** | 8 | Polish, DX, defense-in-depth |
| **Total** | **52** | |

> Note: Some original audit findings are consolidated here (e.g. B-02 covers SEC FINDING-01 + FINDING-02 together; B-01 covers BUG-01 + DB FINDING-1). Total fix count (52) exceeds raw finding count (47) in some cases due to splitting compound issues.

## Recommended Fix Order (BLOCKER sprint)

```
Day 1:  B-03 (delete debug-env.mjs)          — 15 min
        B-07 (set APP_URL in Vercel)           — 10 min
        B-04 (fix XSS in Index.tsx)            — 30 min
        B-09 (fix AuthPage legal link paths)   — 30 min
Day 2:  B-01 (fix stripe-webhook table)        — 2–3 hrs
        H-02 (fix trial_end always null)        — 30 min
Day 3:  B-06 (fix detectSessionInUrl)          — 1 hr
        B-02 (add auth middleware)             — 3–4 hrs
        B-05 (fix Stripe IDOR)                 — 1 hr
        H-09 (lock send-email from address)    — 30 min
Day 4:  B-08 (add paywall enforcement)         — 2–3 hrs
        H-18 (update .env.example)             — 30 min
        H-01 (fix template injection)          — 30 min
```
