---
agent: security-auditor
status: fail
findings: 12
date: 2026-03-08
---

# Security Audit — TrussCTR CRM

## Executive Summary

The application has **three critical vulnerabilities** that require immediate remediation before serving real customers. Every serverless API function (except the Stripe webhook) is reachable by unauthenticated callers, creating an open email relay, an OpenAI API abuse vector, and an IDOR against the Stripe Customer Portal. A reflected XSS exists in the checkout success redirect. Two lower-severity issues round out the report.

**What is working well:**
- ✅ Stripe webhook signature is correctly verified before processing payment events
- ✅ OpenAI API key is server-side only (`process.env`, never a `VITE_` variable)
- ✅ QuickBooks OAuth uses HMAC-signed state with expiry (CSRF protection)
- ✅ QB tokens are encrypted with AES-256-GCM in the database
- ✅ RLS is enabled on all core tables and the main schema appears sound
- ✅ PKCE auth flow is used for Supabase authentication

---

## Findings

---

### FINDING-01 — CRITICAL | No Caller Authentication on Any API Endpoint

**OWASP:** A01 Broken Access Control / A07 Identification and Authentication Failures  
**Affected files:**
- [api/ai-draft.mjs](../../api/ai-draft.mjs)
- [api/send-email.mjs](../../api/send-email.mjs) (also covers send-invite.mjs)
- [api/stripe-checkout.mjs](../../api/stripe-checkout.mjs)
- [api/stripe-portal.mjs](../../api/stripe-portal.mjs)
- [api/quickbooks-sync.mjs](../../api/quickbooks-sync.mjs)
- [api/quickbooks-auth.mjs](../../api/quickbooks-auth.mjs)
- [api/sign-document.mjs](../../api/sign-document.mjs)
- [api/sign-change-order.mjs](../../api/sign-change-order.mjs)

**Description:**  
Not a single one of the above handlers verifies a Supabase JWT from the calling user. There is no `Authorization` header check, no `supabase.auth.getUser()` call, nothing. Any person on the internet — completely unauthenticated — can call any of these endpoints directly with `curl`.

Specific impact by endpoint:

| Endpoint | Unauthenticated Impact |
|---|---|
| `/api/ai-draft` | Burn your OpenAI quota/credits; cost-based DoS |
| `/api/send-email` | Use 614restore.com as an open spam/phishing relay |
| `/api/stripe-portal` | Open Stripe billing portal for any Customer ID |
| `/api/quickbooks-sync` | Dump contacts/invoices from any company to QB |
| `/api/stripe-checkout` | Create checkout sessions (low risk; caller pays) |

**Remediation:**  
Add a JWT verification helper and call it at the top of every handler that touches internal data. Supabase makes this straightforward:

```js
// auth-middleware.mjs — shared helper
import { createClient } from '@supabase/supabase-js';

export async function requireAuth(req, res) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return null;
  }
  return user;
}
```

Then in each handler:
```js
import { requireAuth } from './auth-middleware.mjs';

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return; // response already sent
  // ... rest of handler
}
```

`sign-document.mjs` and `sign-change-order.mjs` are intentionally public (customer-facing signing pages), but they already use `sign_token` to scope access — this is acceptable *only if* all other sensitive endpoints are protected.

---

### FINDING-02 — CRITICAL | Open Email Relay via `send-email.mjs`

**OWASP:** A01 Broken Access Control  
**Affected file:** [api/send-email.mjs](../../api/send-email.mjs) (lines 1–52)

**Description:**  
The handler accepts `to`, `subject`, `html`, and `from` from the request body with no authentication, no domain allowlist, and no content validation. CORS is set to `*`.

```js
// send-email.mjs – lines 1-4
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
```

```js
// line 18
const { to, subject, html, from } = req.body || {};
```

An attacker can send arbitrary HTML emails appearing to come from `scopemgr@614restore.com` (or any `from` address they specify) to any recipient. This can be used for phishing, spam, and will quickly destroy your Resend domain reputation and get the domain blacklisted.

**Remediation (three layers):**
1. **Auth:** Only authenticated users can call this endpoint (see FINDING-01).
2. **From-address lockdown:** Remove the `from` parameter entirely; always use the hardcoded `614 Restore <scopemgr@614restore.com>`.
3. **HTML sanitization:** Strip `<script>`, event handlers, and dangerous tags from the `html` body before sending (use a library like `sanitize-html`). Users shouldn't be able to send XSS payloads to customers via this route.

```js
// Replace the from line:
from: '614 Restore <scopemgr@614restore.com>', // never accept from caller
```

---

### FINDING-03 — CRITICAL | IDOR on Stripe Customer Portal (`stripe-portal.mjs`)

**OWASP:** A01 Broken Access Control / IDOR  
**Affected file:** [api/stripe-portal.mjs](../../api/stripe-portal.mjs) (lines 24–28)

**Description:**  
The endpoint accepts an arbitrary `customerId` from the request body and opens the Stripe Customer Portal for that customer with no validation:

```js
// stripe-portal.mjs – lines 24-28
const { customerId } = req.body || {};

if (!customerId) {
  return res.status(400).json({ error: 'customerId is required...' });
}
```

There is a comment acknowledging this: *"For now, accept it from the request body or a session/auth token lookup"*. That "for now" is live in production.

An attacker who can enumerate or guess Stripe Customer IDs (`cus_xxxxx`) can:
- Cancel another company's subscription
- View another company's invoices
- Change payment methods

The `stripe-portal.mjs` code even acknowledges the missing auth in comments — this was intentional tech debt left unresolved.

**Remediation:**  
After adding auth (FINDING-01), look up the authenticated user's `stripe_customer_id` server-side from the `profiles` or `companies` table rather than accepting it from the client:

```js
const user = await requireAuth(req, res);
if (!user) return;

const { data: company } = await supabase
  .from('companies')
  .select('stripe_customer_id')
  .eq('id', user.user_metadata.company_id)
  .single();

const customerId = company?.stripe_customer_id;
if (!customerId) {
  return res.status(400).json({ error: 'No Stripe customer on file' });
}
```

---

### FINDING-04 — HIGH | Reflected XSS via `?plan=` URL Parameter

**OWASP:** A03 Injection (XSS)  
**Affected file:** [src/pages/Index.tsx](../../src/pages/Index.tsx) (lines 11–27)

**Description:**  
The `plan` query parameter is read from the URL and interpolated into `innerHTML` without escaping:

```tsx
// Index.tsx lines 11-22
const plan = params.get('plan');
const planName = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : '';

banner.innerHTML = `
  ...
  <strong>Welcome to TrussCTR${planName ? ` ${planName}` : ''}!</strong>
  ...
`;
```

A URL of `/?checkout=success&plan=<img src=x onerror=alert(document.cookie)>` executes JavaScript in the victim's browser. While Stripe redirects here with the plan name you configured, the parameter is user-controllable (any link can trigger this). Attackers can send a crafted link to users or embed it in a phishing email.

**Remediation:**  
Replace `innerHTML` with DOM APIs and text nodes, or escape the value:

```tsx
// Safe version — use textContent, never innerHTML for user-controlled data
const banner = document.createElement('div');
// build elements programmatically instead:
const strong = document.createElement('strong');
strong.textContent = `Welcome to TrussCTR${planName ? ` ${planName}` : ''}!`;
```

Or at minimum:
```tsx
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
const safePlanName = escapeHtml(planName);
```

---

### FINDING-05 — HIGH | Debug Endpoint Exposed in Production

**OWASP:** A05 Security Misconfiguration / A01 Broken Access Control  
**Affected file:** [api/debug-env.mjs](../../api/debug-env.mjs)

**Description:**  
The `/api/debug-env` endpoint is publicly accessible with no authentication and returns environment configuration reconnaissance:

```js
// debug-env.mjs – entire file
export default function handler(req, res) {
  res.json({
    has_supabase_service_role: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    has_supabase_anon_key: !!(process.env.VITE_SUPABASE_ANON_KEY || ...),
    has_qbo_client_id: !!process.env.QBO_CLIENT_ID,
    has_qbo_client_secret: !!process.env.QBO_CLIENT_SECRET,
    qbo_env: process.env.QBO_ENVIRONMENT || '(not set)',   // ← leaks actual value
    has_resend: !!process.env.RESEND_API_KEY,
    ...
  });
}
```

This tells an attacker exactly which integration services are active, whether you're in sandbox vs production for QuickBooks, and confirms which secrets are in place. A missing secret (`has_resend: false`) could guide them toward different attack vectors.

**Remediation:**  
Remove this file entirely, or protect it behind an auth check and restrict to admin roles only. This endpoint has no place in production.

---

### FINDING-06 — MEDIUM | `sign-document.mjs` — URL Parameter Injection via Unvalidated `estimateId`

**OWASP:** A03 Injection  
**Affected file:** [api/sign-document.mjs](../../api/sign-document.mjs) (lines 36, 59)

**Description:**  
The `estimateId` from the request body is interpolated directly into a Supabase REST API URL without UUID validation:

```js
// sign-document.mjs line 36
const fetchRes = await fetch(
  `${SUPABASE_URL}/rest/v1/estimates?id=eq.${estimateId}&select=id,status,sign_token`,
  { headers: { apikey: SUPABASE_SERVICE_KEY, ... } }
);
```

A crafted value like `00000000-0000-0000-0000-000000000000&status=eq.sent` could inject additional query parameters into the Supabase REST call. Because this uses the `service role key` which bypasses RLS, there is no row-level safety net. The attacker could potentially manipulate the filter to match unintended records or alter the query semantics.

**Remediation:**  
Validate `estimateId` as a UUID before use:

```js
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(estimateId)) {
  return res.status(400).json({ error: 'Invalid estimateId format' });
}
```

Same fix should be applied to anywhere an ID from user input is used in a raw URL or query.

---

### FINDING-07 — MEDIUM | No Rate Limiting on Cost-Incurring Endpoints

**OWASP:** A04 Insecure Design  
**Affected files:**
- [api/ai-draft.mjs](../../api/ai-draft.mjs)
- [api/send-email.mjs](../../api/send-email.mjs)

**Description:**  
Neither the AI draft endpoint nor the email endpoint has any rate limiting. Even after adding authentication (FINDING-01), a single authenticated user could loop-call `/api/ai-draft` thousands of times per minute, generating outsized OpenAI charges. Similarly, there is no per-account email send limit.

**Remediation:**  
Add rate limiting using an in-memory store (for Vercel's stateless nature, use Vercel KV or Upstash Redis):

```js
// Basic IP-based rate limit example using Upstash
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, '1 m'), // 20 req/min per IP
});
```

For the AI endpoint, also add a hard cap on input sizes:
```js
const MAX_CONTEXT_CHARS = 2000;
if (context && context.length > MAX_CONTEXT_CHARS) {
  return res.status(400).json({ error: 'context too long' });
}
```

---

### FINDING-08 — LOW | Single-Record DB Fetches Rely Solely on RLS for Tenant Isolation

**OWASP:** A01 Broken Access Control (Defense-in-Depth gap)  
**Affected file:** [src/lib/database.ts](../../src/lib/database.ts) (lines 642–655 and similarly for invoices, jobs)

**Description:**  
Several "fetch by ID" methods query by primary key only, with no additional `company_id` filter:

```ts
// database.ts line 642-651
async getContact(contactId: string): Promise<DbContact | null> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)  // ← no .eq('company_id', ...) check
    .single();
```

The application relies entirely on Supabase RLS to prevent cross-company data access. This is architecturally correct (RLS is the right place to enforce this), but it creates a single point of failure. If any RLS policy is inadvertently dropped, disabled, or bypassed via a misconfigured RPC, these queries return data across company boundaries with no application-layer fallback.

**Remediation:**  
Add `company_id` as a second filter wherever the caller's company context is known, as a defense-in-depth measure:

```ts
async getContact(contactId: string, companyId: string): Promise<DbContact | null> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .eq('company_id', companyId) // belt-and-suspenders
    .single();
```

---

### FINDING-09 — LOW | `supabase.ts` Exports the Anon Key to the Client Bundle

**OWASP:** A02 Cryptographic Failures (informational)  
**Affected file:** [src/lib/supabase.ts](../../src/lib/supabase.ts) (line 63)

**Description:**  
```ts
export { supabase, supabaseUrl, supabaseKey };
```

The Supabase anon key (`VITE_SUPABASE_ANON_KEY`) is exported and will appear in the client-side bundle. This is by Supabase's design — the anon key is meant to be public, and RLS is the enforcement mechanism. However, exporting raw key values unnecessarily widens the surface area and could cause confusion. More importantly, if RLS policies are missing or misconfigured (see FINDING-08), the anon key could be used to directly query the API.

**Remediation:**  
Remove `supabaseKey` from the named export — it's not needed by any consumer. The `supabase` client instance is sufficient.

```ts
export { supabase, supabaseUrl }; // drop supabaseKey
```

Ensure RLS is enforced correctly on all tables (especially `subscriptions` and `invitations` — no RLS was found in the migrations for these tables).

---

### FINDING-10 — LOW | `subscriptions` and `invitations` Tables — No RLS Policies Found

**OWASP:** A01 Broken Access Control  
**Affected files:**
- [supabase/setup.sql](../../supabase/setup.sql)
- [supabase-migrations/add-subscription-plans.sql](../../supabase-migrations/add-subscription-plans.sql)

**Description:**  
A search across all migration SQL files found no `ENABLE ROW LEVEL SECURITY` or `CREATE POLICY` statements for the `subscriptions` or `invitations` tables. The `stripe-webhook.mjs` writes subscription data to a `subscriptions` table using the service role key (which bypasses RLS), but if that table is readable via the anon key without policies, any authenticated user could potentially read other companies' subscription records (including `stripe_customer_id`, `stripe_subscription_id`, billing email).

**Note:** It's possible these tables were created directly in the Supabase dashboard and are not captured in the migration files. This should be verified.

**Remediation:**  
Verify that RLS is enabled on `subscriptions` and `invitations` via the Supabase dashboard. Add policies:

```sql
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own company subscription"
ON public.subscriptions FOR SELECT
USING (
  email = auth.email()
  OR EXISTS (
    SELECT 1 FROM public.companies c
    JOIN public.profiles p ON p.company_id = c.id
    WHERE c.stripe_customer_id = subscriptions.stripe_customer_id
      AND p.id = auth.uid()
  )
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
-- Allow reading your own invite by token (used in AuthPage.tsx)
CREATE POLICY "Allow invite lookup by token"
ON public.invitations FOR SELECT
USING (true); -- public read is OK since token is the secret

CREATE POLICY "Company admins can manage invitations"
ON public.invitations FOR ALL
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);
```

---

### FINDING-11 — PASS | Stripe Webhook Signature Verification ✅

**Affected file:** [api/stripe-webhook.mjs](../../api/stripe-webhook.mjs) (lines 20–53)

`bodyParser: false` is correctly set so the raw body is preserved. The Stripe signature is verified with `stripe.webhooks.constructEvent()` before any event processing occurs. A failed signature returns `400` immediately. This is correctly implemented.

---

### FINDING-12 — PASS | OpenAI Key is Server-Side Only ✅

The `OPENAI_API_KEY` is accessed only via `process.env.OPENAI_API_KEY` inside `api/ai-draft.mjs`. It is not referenced under any `VITE_` prefix, is not imported into any client-side module, and will not appear in the browser bundle.

---

## Risk Summary

| # | Severity | Title | File |
|---|---|---|---|
| 01 | 🔴 CRITICAL | No caller auth on any API endpoint | api/*.mjs |
| 02 | 🔴 CRITICAL | Open email relay | api/send-email.mjs |
| 03 | 🔴 CRITICAL | IDOR — Stripe Portal any customer | api/stripe-portal.mjs |
| 04 | 🟠 HIGH | Reflected XSS via `?plan=` | src/pages/Index.tsx |
| 05 | 🟠 HIGH | Debug endpoint exposed in production | api/debug-env.mjs |
| 06 | 🟡 MEDIUM | URL param injection via unvalidated estimateId | api/sign-document.mjs |
| 07 | 🟡 MEDIUM | No rate limiting on cost-incurring endpoints | api/ai-draft.mjs, send-email.mjs |
| 08 | 🔵 LOW | Single-record fetches rely solely on RLS | src/lib/database.ts |
| 09 | 🔵 LOW | Anon key exported from supabase.ts | src/lib/supabase.ts |
| 10 | 🔵 LOW | No RLS policies confirmed for subscriptions/invitations | supabase/ |

## Remediation Priority

**Do immediately (before any real customer data):**
1. **FINDING-01** — Add JWT auth middleware to all API handlers
2. **FINDING-02** — Lock `from` address hardcoded; add auth to send-email
3. **FINDING-03** — Server-side lookup of `stripe_customer_id`; never accept from client
4. **FINDING-05** — Delete or protect `api/debug-env.mjs`

**Do this week:**
5. **FINDING-04** — Fix XSS in Index.tsx checkout banner
6. **FINDING-06** — UUID-validate all ID params in sign-document.mjs

**Do before scale:**
7. **FINDING-07** — Add Upstash rate limiting to AI and email endpoints
8. **FINDING-10** — Confirm RLS policies on subscriptions/invitations tables

**Ongoing:**
9. **FINDING-08** — Add company_id dual-filter as defense-in-depth
10. **FINDING-09** — Remove supabaseKey from exports
