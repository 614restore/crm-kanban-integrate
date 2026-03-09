---
agent: infra-auditor
status: fail
findings: 14
date: 2026-03-08
---

# Infrastructure Audit — TrussCTR CRM

## Summary

The codebase is deployed to both **Vercel** (primary, SPA + API) and **GitHub Pages** (static
fallback). Three critical bugs will break real-customer flows the moment `APP_URL` is unset in
Vercel: Stripe post-checkout/portal redirects and the QuickBooks OAuth callback all fall back to
hardcoded GitHub Pages URLs. A second critical issue is that `detectSessionInUrl: false` in the
Supabase client will silently prevent email-confirmation and password-reset links from working on
Vercel. The service worker is entirely non-functional on the Vercel deployment because it is
hardcoded to the GitHub Pages path prefix. Several server-side env vars required by API functions
are absent from `.env.example`, creating an invisible misconfiguration trap.

---

## Findings

### CRITICAL

---

#### INFRA-01 — Stripe redirects fall back to GitHub Pages URL when `APP_URL` is unset

**Severity:** Critical  
**Files:**
- [api/stripe-checkout.mjs](../../api/stripe-checkout.mjs#L30)
- [api/stripe-portal.mjs](../../api/stripe-portal.mjs#L31)

**Description:**  
Both files fall back to the GitHub Pages URL when `APP_URL` is missing:

```js
const appUrl = process.env.APP_URL || 'https://614restore.github.io/crm-kanban-integrate';
```

If `APP_URL` is not set as a Vercel env var, customers who complete (or cancel) a Stripe checkout
session will be redirected to GitHub Pages instead of the Vercel app. The `success_url` and
`cancel_url` will route customers off the live product after paying.

**Remediation:**

1. Add `APP_URL=https://crm-kanban-integrate.vercel.app` to Vercel env vars immediately.
2. Add `APP_URL` to `.env.example` as a required server-side variable.
3. Add a startup guard in both files:

```js
const appUrl = process.env.APP_URL;
if (!appUrl) {
  return res.status(500).json({ error: 'APP_URL is not configured. Set it in Vercel env vars.' });
}
```

---

#### INFRA-02 — QuickBooks OAuth callback hardcoded to GitHub Pages (no env var)

**Severity:** Critical  
**File:** [api/quickbooks-callback.mjs](../../api/quickbooks-callback.mjs#L12)

**Description:**  
The callback redirect is fully hardcoded with no env var option:

```js
const appBase = 'https://614restore.github.io/crm-kanban-integrate';
```

After completing QuickBooks OAuth, users are *always* redirected to GitHub Pages — even when the
app is served from Vercel. This is a complete breakage of the QBO integration flow in production.

**Remediation:**

```js
const appBase = process.env.APP_URL || process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'https://crm-kanban-integrate.vercel.app';
```

---

#### INFRA-03 — `detectSessionInUrl: false` breaks Supabase email confirmation and password reset on Vercel

**Severity:** Critical  
**File:** [src/lib/supabase.ts](../../src/lib/supabase.ts#L47)

**Description:**

```js
detectSessionInUrl: false, // hash routing on GH Pages conflicts with URL session detection
```

The comment explains the GitHub Pages reason, but on Vercel routes are real paths (not hash
routes). With this set to `false`, the Supabase client will **not** automatically exchange the
PKCE code from the URL after:
- Email confirmation (`?code=...&type=signup`)
- Password reset (`?code=...&type=recovery`)
- Magic links

The `supabase.auth.onAuthStateChange()` callback will never fire after these links because the
client never reads the URL token. The manual `sessionStorage` check only handles `type=recovery`,
not signup confirmation. Real customer signup emails will land on a page that appears to do nothing.

**Remediation:**  
On Vercel (non-hash routing), this must be `true`. The fix requires detecting the deployment:

```ts
// On Vercel: real paths, detectSessionInUrl must be true
// On GitHub Pages: hash routing, must be false
const isHashRouter = import.meta.env.VITE_BASE_URL?.includes('crm-kanban-integrate');
const supabase = createClient(url, key, {
  auth: {
    detectSessionInUrl: !isHashRouter,
    flowType: 'pkce',
    // ...
  }
});
```

Or add a dedicated env var: `VITE_HASH_ROUTING=false` (set to `false` in Vercel, `true` for GH
Pages builds).

---

### HIGH

---

#### INFRA-04 — Service worker is non-functional on Vercel (hardcoded GitHub Pages path)

**Severity:** High  
**File:** [public/sw.js](../../public/sw.js)

**Description:**  
The service worker `CACHE_NAME`, `urlsToCache`, and the entire fetch handler are hardcoded to
the `/crm-kanban-integrate/` path prefix:

```js
const urlsToCache = [
  '/crm-kanban-integrate/',
  '/crm-kanban-integrate/index.html',
  ...
];

// Only handle requests from our app
if (!url.pathname.startsWith('/crm-kanban-integrate/')) {
  return; // <— exits for ALL requests on Vercel
}
```

On Vercel (base path `/`), every fetch event hits the early `return` and the SW does nothing.
The app shell is never cached, offline mode never works, and the PWA install manifest is
effectively broken. Additionally, the fallback references
`caches.match('/crm-kanban-integrate/index.html')` which will always fail.

**Remediation:**  
The SW needs to be environment-aware. The cleanest fix is to inject the base path at build time
using a Vite plugin or by registering the SW with a scope parameter, then using a relative path:

```js
const BASE = self.registration.scope; // e.g. "/" on Vercel
const urlsToCache = [BASE, `${BASE}index.html`, `${BASE}manifest.json`];

// In fetch handler
if (!url.pathname.startsWith(new URL(BASE).pathname)) return;
```

---

#### INFRA-05 — Supabase URL hardcoded in `sign-change-order.mjs` and `quickbooks-callback.mjs`

**Severity:** High  
**Files:**
- [api/sign-change-order.mjs](../../api/sign-change-order.mjs#L11)
- [api/quickbooks-callback.mjs](../../api/quickbooks-callback.mjs#L7)

**Description:**

```js
// sign-change-order.mjs
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  || 'https://qgvuzrvpyyrrulhwlzma.supabase.co';  // ← hardcoded

// quickbooks-callback.mjs
const SUPABASE_URL = 'https://qgvuzrvpyyrrulhwlzma.supabase.co';  // ← no env var at all
```

Hardcoding infrastructure URLs in source code is a security and portability risk. If the Supabase
project changes or a staging environment is needed, this silently connects to the wrong database.
`quickbooks-callback.mjs` has zero env var support.

**Remediation:**  
Remove all hardcoded URLs. Throw if env vars are missing:

```js
// quickbooks-callback.mjs
const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) throw new Error('SUPABASE_URL not configured');
```

---

#### INFRA-06 — 11 server-side env vars required by API functions are missing from `.env.example`

**Severity:** High  
**File:** [.env.example](../../.env.example)

**Description:**  
The `.env.example` only documents frontend `VITE_*` vars. The following **server-side** env vars
are required by Vercel API functions and are completely undocumented:

| Variable | Used By | Impact if missing |
|---|---|---|
| `STRIPE_SECRET_KEY` | stripe-checkout, stripe-portal, stripe-webhook | Payments broken |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook | Subscriptions never activate |
| `SUPABASE_URL` | stripe-webhook, sign-document, sign-change-order | Signatures/billing broken |
| `SUPABASE_SERVICE_ROLE_KEY` | stripe-webhook, sign-document, sign-change-order, quickbooks-callback | Admin DB writes fail |
| `APP_URL` | stripe-checkout, stripe-portal | Redirects to wrong domain (INFRA-01) |
| `RESEND_API_KEY` | send-email, send-invite | All emails silently fail |
| `QBO_CLIENT_ID` | quickbooks-auth | QBO integration broken |
| `QBO_CLIENT_SECRET` | quickbooks-auth | QBO integration broken |
| `QBO_ENVIRONMENT` | quickbooks-auth | Defaults to `sandbox` in production |
| `QB_ENCRYPT_KEY` | crypto-utils (used by quickbooks-auth/callback) | QBO crashes on startup |
| `OPENAI_API_KEY` | ai-draft | AI drafting returns 503 (silent if not used) |
| `VITE_DEMO_MODE` | src/lib/supabase.ts | App runs in demo mode with fake data |

**Remediation:**  
Add a `# === SERVER-SIDE (Vercel env vars only — never prefix with VITE_) ===` section to
`.env.example` with all the above variables documented.

---

#### INFRA-07 — `VITE_BASE_URL` comment in `.env.example` is misleading

**Severity:** High  
**File:** [.env.example](../../.env.example#L17)

**Description:**

```
# GitHub Pages Deployment Base Path
# Automatically set by Vite config for production builds
# VITE_BASE_URL=/crm-kanban-integrate/
```

The comment says "automatically set by Vite config" — but this is wrong. `VITE_BASE_URL` must be
**manually set** to `/` in Vercel's environment variables. If a developer reads this and assumes
it's handled automatically, they won't set it, and Vite will apply the GitHub Pages path prefix
(`/crm-kanban-integrate/`) to all asset URLs on Vercel, breaking every JS/CSS bundle reference.

**Remediation:**

```
# Vercel deployment: set this to /
# GitHub Pages: leave unset (Vite config auto-applies /crm-kanban-integrate/)
VITE_BASE_URL=/
```

---

### MEDIUM

---

#### INFRA-08 — `debug-env.mjs` is publicly accessible with no authentication

**Severity:** Medium  
**File:** [api/debug-env.mjs](../../api/debug-env.mjs)

**Description:**  
`GET /api/debug-env` returns the presence/absence of every secret env var configured in Vercel:

```js
res.json({
  has_supabase_service_role: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  has_qbo_client_id: !!process.env.QBO_CLIENT_ID,
  has_resend: !!process.env.RESEND_API_KEY,
  ...
});
```

This is an unauthenticated endpoint that maps out your entire secret configuration. An attacker
can use this to know exactly which services are configured and target attacks accordingly.

**Remediation:**  
Either delete this endpoint before going live, or protect it:

```js
const debugToken = process.env.DEBUG_SECRET;
if (!debugToken || req.headers['x-debug-token'] !== debugToken) {
  return res.status(403).json({ error: 'Forbidden' });
}
```

---

#### INFRA-09 — Wildcard CORS (`*`) on email and document-signing endpoints

**Severity:** Medium  
**Files:**
- [api/send-email.mjs](../../api/send-email.mjs#L3)
- [api/sign-document.mjs](../../api/sign-document.mjs#L3)
- [api/sign-change-order.mjs](../../api/sign-change-order.mjs#L5)

**Description:**

```js
res.setHeader('Access-Control-Allow-Origin', '*');
```

`Access-Control-Allow-Origin: *` allows any website to invoke these endpoints. For `send-email`,
this means any third-party site could use your Resend API key to send emails through
`scopemgr@614restore.com` (open relay). For signing endpoints, external origins can POST
signatures.

**Remediation:**  
Restrict to your known origins:

```js
const ALLOWED_ORIGINS = [
  'https://crm-kanban-integrate.vercel.app',
  'https://614restore.github.io',
];
const origin = req.headers.origin || '';
const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
res.setHeader('Access-Control-Allow-Origin', allowed);
res.setHeader('Vary', 'Origin');
```

---

#### INFRA-10 — `vercel.json` lacks function configuration (timeout/memory)

**Severity:** Medium  
**File:** [vercel.json](../../vercel.json)

**Description:**  
The `vercel.json` has only a SPA rewrite rule. There is no `functions` block, so all API
functions use Vercel defaults: 10s timeout, 1024 MB memory. This is inadequate for:
- `api/stripe-webhook.mjs` — processes Stripe webhook events, may need >10s for slow DB writes
- `api/quickbooks-sync.mjs` — syncs accounting data, likely slow
- `api/sign-document.mjs` / `api/sign-change-order.mjs` — could chain Supabase queries

**Remediation:**

```json
{
  "version": 2,
  "functions": {
    "api/stripe-webhook.mjs": { "maxDuration": 30 },
    "api/quickbooks-sync.mjs": { "maxDuration": 60 },
    "api/quickbooks-callback.mjs": { "maxDuration": 30 }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

### LOW

---

#### INFRA-11 — `npm run deploy` deploys to GitHub Pages, not Vercel

**Severity:** Low  
**File:** [package.json](../../package.json#L11)

**Description:**

```json
"deploy": "npm run build && gh-pages -d dist"
```

The `deploy` script pushes to GitHub Pages via `gh-pages`. For Vercel, deployment happens
automatically on `git push`. A developer unfamiliar with the setup might run `npm run deploy`
thinking it deploys to Vercel, which would instead push a stale GitHub Pages release, potentially
with incorrect `VITE_BASE_URL` for the Vercel domain.

**Remediation:**  
Rename and clarify:

```json
"deploy:ghpages": "npm run build && gh-pages -d dist",
"deploy:vercel": "vercel --prod"
```

---

#### INFRA-12 — `vite-env.d.ts` is missing type declarations for build-time vars

**Severity:** Low  
**File:** [src/vite-env.d.ts](../../src/vite-env.d.ts)

**Description:**  
The following env vars used at build/runtime are not declared in the type interface:

```ts
// Missing from ImportMetaEnv:
VITE_DEMO_MODE?: string
VITE_BASE_URL?: string
VITE_STRIPE_PUBLISHABLE_KEY?: string  // if used by any Stripe JS integration
```

Missing declarations cause TypeScript to silently type these as `any`, bypassing type checking.

---

#### INFRA-13 — Stripe API version is pinned to October 2023

**Severity:** Low  
**Files:** [api/stripe-checkout.mjs](../../api/stripe-checkout.mjs#L19), [api/stripe-portal.mjs](../../api/stripe-portal.mjs#L17), [api/stripe-webhook.mjs](../../api/stripe-webhook.mjs#L19)

**Description:**

```js
const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
```

Pinned versions are not inherently dangerous (Stripe supports them for years), but upgrading to a
recent version ensures access to newer features and is required before
Stripe sunset-deprecates this version.

---

#### INFRA-14 — `QBO_ENVIRONMENT` defaults to sandbox silently in production

**Severity:** Low  
**File:** [api/quickbooks-auth.mjs](../../api/quickbooks-auth.mjs#L25)

**Description:**

```js
const environment = process.env.QBO_ENVIRONMENT || 'sandbox';
```

If `QBO_ENVIRONMENT` is not set in Vercel env vars, QuickBooks OAuth targets the sandbox
environment. All customer syncs go to test data. There is no warning or error log, and customers
will believe accounting sync works while data is silently discarded.

**Remediation:**  
Fail loudly or default to production with a log:

```js
const environment = process.env.QBO_ENVIRONMENT;
if (!environment) {
  console.warn('[QBO] QBO_ENVIRONMENT not set — defaulting to production. Set explicitly to suppress.');
}
const qboEnv = environment === 'sandbox' ? 'sandbox' : 'production';
```

---

## Key Questions — Direct Answers

### Will the app work correctly after adding `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DEMO_MODE=false`, `VITE_BASE_URL=/` to Vercel?

**Mostly, but three critical additional vars are required:**

| Required | Status |
|---|---|
| `VITE_SUPABASE_URL` | ✅ Added |
| `VITE_SUPABASE_ANON_KEY` | ✅ Added |
| `VITE_DEMO_MODE=false` | ✅ Added |
| `VITE_BASE_URL=/` | ✅ Added |
| `APP_URL=https://crm-kanban-integrate.vercel.app` | ❌ **Not set — Stripe breaks** |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ **Not set — Webhooks/signing breaks** |
| `STRIPE_SECRET_KEY` | ❌ **Not set — All payments fail** |
| `STRIPE_WEBHOOK_SECRET` | ❌ **Not set — Subscriptions never activate** |
| `RESEND_API_KEY` | ❌ **Not set — All emails fail** |

### Is the `vite.config.ts` base path logic correct?

**Yes.** The logic is correct:

```ts
const base = process.env.VITE_BASE_URL ?? (mode === "production" ? "/crm-kanban-integrate/" : "/");
```

- Vercel with `VITE_BASE_URL=/` → `base = "/"` ✅
- GitHub Pages build (no env var) → `base = "/crm-kanban-integrate/"` ✅
- Local dev → `base = "/"` ✅

The `??` nullish coalescing handles empty string correctly (empty string is falsy with `??`, so if
`VITE_BASE_URL=""` is accidentally set it will fall through to the production default, which is
safe).

### Are Supabase auth redirect URLs correct for email confirmations and password reset?

**No — see INFRA-03.** `detectSessionInUrl: false` will prevent the Supabase client from
processing `?code=...` tokens in Vercel's real-path URLs. Add `VITE_HASH_ROUTING=false` to
Vercel and use it to conditionally set `detectSessionInUrl: !isHashRouting`.

Additionally, you must configure Supabase Dashboard → Authentication → URL Configuration:
- **Site URL**: `https://crm-kanban-integrate.vercel.app`
- **Redirect URLs**: include both `https://crm-kanban-integrate.vercel.app/**` and
  `https://614restore.github.io/crm-kanban-integrate/**`

### Does the service worker cache-busting work correctly on deployments?

**Not on Vercel — see INFRA-04.** The SW does nothing on Vercel because all fetch paths are
rejected by the `/crm-kanban-integrate/` prefix check. JS bundle cache-busting (the
`cache: 'no-store'` in the `.js` handler) only runs on GitHub Pages. On Vercel, the browser's
native cache handles all resources with no custom busting strategy.

### Are there missing env vars that would silently break features?

**Yes — 11 undocumented server-side vars (see INFRA-06).**  
Most dangerous silent failures:
- `APP_URL` missing → Stripe redirects to wrong domain (customers think payment failed)
- `STRIPE_WEBHOOK_SECRET` missing → subscriptions never activated in Supabase
- `QBO_ENVIRONMENT` missing → QBO syncs to sandbox silently
- `RESEND_API_KEY` missing → invites, estimates, and notifications fail silently

### Is `vercel.json` correct for serving the SPA and API routes?

**The SPA rewrite is correct.** Vercel resolves `api/` directory functions before processing
rewrites, so `/api/...` calls will never be caught by the `/(.*) → /index.html` rule.

However, the config is **missing function timeout config** (INFRA-10), which will cause the webhook
and QuickBooks sync functions to time out on slow operations.

---

## Metrics

| Severity | Count |
|---|---|
| Critical | 3 |
| High | 4 |
| Medium | 3 |
| Low | 4 |
| **Total** | **14** |

## Immediate Action Checklist (before first paying customer)

- [ ] Set `APP_URL=https://crm-kanban-integrate.vercel.app` in Vercel env vars
- [ ] Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` in Vercel env vars
- [ ] Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` in Vercel env vars (server-side, no VITE_ prefix)
- [ ] Set `RESEND_API_KEY` in Vercel env vars
- [ ] Set `QBO_ENVIRONMENT=production` in Vercel env vars
- [ ] Set `QB_ENCRYPT_KEY` (32+ chars) in Vercel env vars
- [ ] Fix `detectSessionInUrl` in `src/lib/supabase.ts` (INFRA-03)
- [ ] Fix QuickBooks callback hardcoded URL in `api/quickbooks-callback.mjs` (INFRA-02)
- [ ] Add auth to or delete `api/debug-env.mjs` (INFRA-08)
- [ ] Update Supabase Dashboard → Auth → Site URL to Vercel domain
