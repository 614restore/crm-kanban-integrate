---
agent: infra-auditor
status: fail
findings: 18
---

# Infrastructure Audit — March 8, 2026

## Summary

Audited 7 areas: `vercel.json`, `vite.config.ts`, `package.json`, hardcoded GitHub Pages URLs, QuickBooks API files, SPA 404 handling, and environment variable coverage. Found **3 critical**, **8 high**, and **7 medium** issues.

The most severe issues are: (1) the Vite base-path trap that will break Vercel builds if `VITE_BASE_URL` is not set, (2) the hardcoded `614restore.github.io` URL in `api/quickbooks-callback.mjs` that redirects paying users to the wrong domain after OAuth, and (3) three hardcoded production Vercel URLs in frontend components.

---

## Findings

---

### CRITICAL-1 — Vite base path defaults to GitHub Pages on production builds

| | |
|---|---|
| **Severity** | Critical |
| **File** | [vite.config.ts](../../vite.config.ts#L9) |

**Description:** The base URL logic is:
```ts
const base = process.env.VITE_BASE_URL ?? (mode === "production" ? "/crm-kanban-integrate/" : "/");
```
If `VITE_BASE_URL` is **not set** in Vercel environment variables, every production build will use `/crm-kanban-integrate/` as the asset base path. Every JS chunk, CSS file, and image will load from `/crm-kanban-integrate/assets/…` — a path that does not exist on Vercel — causing a completely white/broken app. The `src/App.tsx` router `basename` inherits from `import.meta.env.BASE_URL`, so all routes would also be broken.

**Remediation:** Set `VITE_BASE_URL=/` in Vercel environment variables (Production, Preview, and Development). Add a bold warning to `.env.example`. Long-term, consider flipping the default: `process.env.VITE_BASE_URL ?? "/"` and only adding the `/crm-kanban-integrate/` path for explicit GitHub Pages builds.

---

### CRITICAL-2 — QuickBooks callback redirects users to GitHub Pages after OAuth

| | |
|---|---|
| **Severity** | Critical |
| **File** | [api/quickbooks-callback.mjs](../../api/quickbooks-callback.mjs#L13) |

**Description:**
```js
const appBase = 'https://614restore.github.io/crm-kanban-integrate';
```
After a user completes QuickBooks OAuth, all redirects (success, error, CSRF failure, DB failure) point to the old GitHub Pages domain instead of the live Vercel app. Any customer who connects QuickBooks gets bounced to the wrong domain. This was previously flagged in prior audits but the fix was not applied to the live file.

**Remediation:**
```js
const appBase = process.env.APP_URL || 'https://crm-kanban-integrate.vercel.app';
```
Set `APP_URL=https://crm-kanban-integrate.vercel.app` (or the custom domain) in Vercel env vars.

---

### CRITICAL-3 — Supabase URL hardcoded in QuickBooks callback (bypasses env var)

| | |
|---|---|
| **Severity** | Critical |
| **File** | [api/quickbooks-callback.mjs](../../api/quickbooks-callback.mjs#L7) |

**Description:**
```js
const SUPABASE_URL = 'https://qgvuzrvpyyrrulhwlzma.supabase.co';
```
The Supabase project URL is hardcoded as a constant — it never reads from `process.env.SUPABASE_URL`. If the project is migrated or renamed, this will silently break DB writes after QuickBooks OAuth without any visible configuration path to fix it.

**Remediation:**
```js
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qgvuzrvpyyrrulhwlzma.supabase.co';
```

---

### HIGH-1 — vercel.json: missing API route exclusion from catch-all rewrite

| | |
|---|---|
| **Severity** | High |
| **File** | [vercel.json](../../vercel.json) |

**Description:** The catch-all rewrite `/(.*) → /index.html` technically works because Vercel evaluates `api/` functions before rewrites. However, it is fragile — future additions of a `routes` array, changing to `redirects`, or a Vercel config schema change could cause `/api/*` to be intercepted and served as `index.html`. Best practice is to explicitly exclude the API path.

**Remediation:**
```json
{
  "version": 2,
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```
Also consider adding security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`).

---

### HIGH-2 — Three hardcoded Vercel URLs in frontend source

| | |
|---|---|
| **Severity** | High |
| **Files** | [src/pages/SignEstimate.tsx](../../src/pages/SignEstimate.tsx#L5), [src/pages/SignChangeOrder.tsx](../../src/pages/SignChangeOrder.tsx#L5), [src/components/crm/TeamView.tsx](../../src/components/crm/TeamView.tsx#L161) |

**Description:** Three frontend files hardcode the Vercel domain:
```ts
// SignEstimate.tsx & SignChangeOrder.tsx
const API_BASE = "https://crm-kanban-integrate.vercel.app/api/sign-document";

// TeamView.tsx
await fetch('https://crm-kanban-integrate.vercel.app/api/send-email', ...
```
These will break on preview deployments (e.g., `crm-kanban-integrate-git-feature-xxx.vercel.app`) and will break if the app moves to a custom domain.

**Remediation:** Use relative paths — Vercel API functions live at the same origin as the frontend:
```ts
const API_BASE = "/api/sign-document";
// and
await fetch('/api/send-email', ...
```

---

### HIGH-3 — QuickBooks auth hardcodes redirect URI (no env var)

| | |
|---|---|
| **Severity** | High |
| **File** | [api/quickbooks-auth.mjs](../../api/quickbooks-auth.mjs#L27) |

**Description:**
```js
redirectUri: 'https://crm-kanban-integrate.vercel.app/api/quickbooks-callback',
```
The OAuth redirect URI is hardcoded in `quickbooks-auth.mjs`. QuickBooks' OAuth requires an **exact match** between the registered URI and the one sent in the auth request. If the domain changes (custom domain, preview deploy testing), the OAuth flow will fail with a redirect URI mismatch error.

**Remediation:**
```js
redirectUri: `${process.env.APP_URL || 'https://crm-kanban-integrate.vercel.app'}/api/quickbooks-callback`,
```
Same fix needed in `quickbooks-callback.mjs` line 41 (`const redirectUri = ...`).

---

### HIGH-4 — `quickbooks-callback.mjs` hardcodes full Vercel URL for token exchange

| | |
|---|---|
| **Severity** | High |
| **File** | [api/quickbooks-callback.mjs](../../api/quickbooks-callback.mjs#L47) |

**Description:**
```js
const fullUrl = `https://crm-kanban-integrate.vercel.app${req.url}`;
```
This constructs the full URL for `oauthClient.createToken()` by prepending the hardcoded Vercel domain. If `APP_URL` is set to a custom domain, the token exchange URL will still use the old domain, potentially failing PKCE/state validation.

**Remediation:**
```js
const fullUrl = `${process.env.APP_URL || 'https://crm-kanban-integrate.vercel.app'}${req.url}`;
```

---

### HIGH-5 — `.env.example` is missing all server-side environment variables

| | |
|---|---|
| **Severity** | High |
| **File** | [.env.example](../../.env.example) |

**Description:** The `.env.example` only documents frontend (`VITE_*`) variables. All server-side Vercel environment variables required by the API functions are completely undocumented. A developer setting up or recovering from a failed deployment would have no reference for what to configure in Vercel.

**Missing variables:**
| Variable | Required By |
|---|---|
| `APP_URL` | stripe-checkout, stripe-portal, send-email (CORS), quickbooks-callback |
| `STRIPE_SECRET_KEY` | stripe-checkout, stripe-portal, stripe-webhook |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook |
| `SUPABASE_URL` | stripe-portal, stripe-webhook, quickbooks-sync, sign-change-order |
| `SUPABASE_SERVICE_ROLE_KEY` | stripe-portal, stripe-webhook, quickbooks-callback, send-invite, sign-change-order |
| `RESEND_API_KEY` | send-email |
| `QBO_CLIENT_ID` | quickbooks-auth, quickbooks-callback |
| `QBO_CLIENT_SECRET` | quickbooks-auth, quickbooks-callback |
| `QBO_ENVIRONMENT` | quickbooks-auth, quickbooks-callback (`sandbox` or `production`) |
| `QB_ENCRYPT_KEY` | _crypto-utils (token encryption) |
| `GROQ_API_KEY` | ai-draft |

**Remediation:** Add a `## Server-side (Vercel) Environment Variables` section to `.env.example` listing the above with descriptions.

---

### HIGH-6 — `.env.example` missing frontend env vars used in code

| | |
|---|---|
| **Severity** | High |
| **File** | [.env.example](../../.env.example) |

**Description:** Several `VITE_*` variables are used in source code but absent from `.env.example`:

| Variable | Used In |
|---|---|
| `VITE_API_BASE_URL` | [src/pages/SignDocument.tsx](../../src/pages/SignDocument.tsx#L18), [src/lib/emailApi.ts](../../src/lib/emailApi.ts#L12) |
| `VITE_API_URL` | [src/components/IntegrationConfigDialog.tsx](../../src/components/IntegrationConfigDialog.tsx#L237) |
| `VITE_DEMO_MODE` | [src/lib/supabase.ts](../../src/lib/supabase.ts#L20) |
| `VITE_HASH_ROUTING` | [src/lib/supabase.ts](../../src/lib/supabase.ts#L52) |
| `VITE_DISABLE_REALTIME` | [src/components/AppLayout.tsx](../../src/components/AppLayout.tsx#L780) |
| `VITE_BASE_URL` | Documented in a comment but not as an active variable |

**Remediation:** Add these to `.env.example` with descriptions and example values.

---

### HIGH-7 — Stripe API version is outdated (`2023-10-16`)

| | |
|---|---|
| **Severity** | High |
| **Files** | [api/stripe-checkout.mjs](../../api/stripe-checkout.mjs#L20), [api/stripe-portal.mjs](../../api/stripe-portal.mjs) |

**Description:** Both Stripe API files use `apiVersion: '2023-10-16'`. Stripe has released multiple versions since then (2024-04, 2024-06, 2024-09, 2024-12, 2025-01). Older API versions eventually get sunset. Check Stripe Dashboard for deprecation notices.

**Remediation:** Update to the latest stable API version and test for breaking changes.

---

### HIGH-8 — `xlsx` package at vulnerable/controversial version

| | |
|---|---|
| **Severity** | High |
| **File** | [package.json](../../package.json) — `"xlsx": "^0.18.5"` |

**Description:** SheetJS `xlsx` 0.18.5 (community edition) has been reported to include code that contacts an external server in versions modified around February 2023. This version is also over 2 years old with no community updates. Multiple security advisories exist. The `^` range means this is pinned to `0.18.x` only, but that entire line is problematic.

**Remediation:** Evaluate replacing with `exceljs` (actively maintained, no controversy) or `papaparse` for CSV-only use cases. If `xlsx` must be kept, pin to a known-safe hash and audit the installed version.

---

### MEDIUM-1 — SPA 404.html is GitHub Pages-only code dead on Vercel

| | |
|---|---|
| **Severity** | Medium |
| **File** | [public/404.html](../../public/404.html) |

**Description:** The `public/404.html` implements a GitHub Pages SPA redirect hack (query-string encoding of deep-link paths). On Vercel, the catch-all rewrite in `vercel.json` handles all SPA routing correctly. This file still ships in the `dist/` output but is never triggered on Vercel. It references `/crm-kanban-integrate/` in the fallback link, which is the GitHub Pages path prefix.

**Remediation:** Acceptable to leave for GitHub Pages compatibility. No action needed for Vercel correctness, but add a comment noting this is GH Pages-only.

---

### MEDIUM-2 — `package.json` deploy script targets GitHub Pages, not Vercel

| | |
|---|---|
| **Severity** | Medium |
| **File** | [package.json](../../package.json) — `"deploy"` script |

**Description:**
```json
"deploy": "npm run build && gh-pages -d dist"
```
The `deploy` script pushes to GitHub Pages. Running `npm run deploy` from a CI/CD context or by a developer unfamiliar with the setup would deploy to the old GitHub Pages URL instead of Vercel. The `gh-pages` package in `devDependencies` is also only needed if GitHub Pages is being actively maintained.

**Remediation:** Rename or remove the `deploy` script, or rename it to `deploy:gh-pages` to make the target explicit. Add a `deploy:vercel` script that documents the actual deployment path (`vercel --prod`).

---

### MEDIUM-3 — `homepage` field in package.json points to GitHub Pages

| | |
|---|---|
| **Severity** | Medium |
| **File** | [package.json](../../package.json#L6) — `"homepage"` |

**Description:**
```json
"homepage": "https://614restore.github.io/crm-kanban-integrate"
```
The `homepage` field is read by tools like `gh-pages` and some generators. It's a stale reference to the old deployment domain. Any tooling that reads this field will generate incorrect URLs.

**Remediation:** Update to `"homepage": "https://crm-kanban-integrate.vercel.app"` (or the custom production domain).

---

### MEDIUM-4 — `@types/*` packages in `dependencies` instead of `devDependencies`

| | |
|---|---|
| **Severity** | Medium |
| **File** | [package.json](../../package.json) |

**Description:** Three type-only packages are in `dependencies` (shipped to production) instead of `devDependencies`:
- `@types/dexie: "^1.3.32"`
- `@types/uuid: "^10.0.0"`
- `@types/xlsx: "^0.0.35"`

These are TypeScript declaration packages that have zero runtime value. They bloat the `node_modules` size in production serverless function deployments.

**Remediation:** Move all three to `devDependencies`.

---

### MEDIUM-5 — `eslint-plugin-react-hooks` locked to release candidate

| | |
|---|---|
| **Severity** | Medium |
| **File** | [package.json](../../package.json) — `"eslint-plugin-react-hooks": "^5.1.0-rc.0"` |

**Description:** Using a release candidate (`-rc.0`) in devDependencies has been in place since the project was set up. The stable `5.1.0` has been released. RC packages are pre-release and may have bugs or API changes.

**Remediation:** Update to `"^5.1.0"` (stable).

---

### MEDIUM-6 — `send-email.mjs` CORS `Access-Control-Allow-Origin` will be empty if `APP_URL` is unset

| | |
|---|---|
| **Severity** | Medium |
| **File** | [api/send-email.mjs](../../api/send-email.mjs#L6) |

**Description:**
```js
const allowedOrigin = process.env.APP_URL || '';
res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
```
If `APP_URL` is not set, the CORS header is set to an empty string, which is an invalid value and will cause all cross-origin requests to the email API to fail silently with a CORS error — without a clear error message. This silently breaks the email feature.

**Remediation:** Add a fallback warning:
```js
const allowedOrigin = process.env.APP_URL;
if (!allowedOrigin) {
  console.error('APP_URL is not set — CORS will block all requests to /api/send-email');
}
res.setHeader('Access-Control-Allow-Origin', allowedOrigin || '*'); // or fail-closed
```

---

### MEDIUM-7 — `QBO_ENVIRONMENT` defaults to `sandbox` in production

| | |
|---|---|
| **Severity** | Medium |
| **Files** | [api/quickbooks-auth.mjs](../../api/quickbooks-auth.mjs#L20), [api/quickbooks-callback.mjs](../../api/quickbooks-callback.mjs#L39) |

**Description:**
```js
const environment = process.env.QBO_ENVIRONMENT || 'sandbox';
```
If `QBO_ENVIRONMENT` is not explicitly set on Vercel, the app runs in QuickBooks sandbox mode even in production. Real customers would be connecting to QuickBooks test data.

**Remediation:** Set `QBO_ENVIRONMENT=production` in Vercel Production environment variables. Add it to `.env.example` with a note that Production should use `production` and local dev should use `sandbox`.

---

## Metrics

| Category | Count |
|---|---|
| Critical | 3 |
| High | 8 |
| Medium | 7 |
| **Total** | **18** |

## Priority Remediation Order

1. **CRITICAL-2** — Fix `quickbooks-callback.mjs` `appBase` to use `APP_URL` env var
2. **CRITICAL-1** — Confirm `VITE_BASE_URL=/` is set in Vercel env vars
3. **CRITICAL-3** — Replace hardcoded `SUPABASE_URL` constant in `quickbooks-callback.mjs`
4. **HIGH-2** — Replace 3 hardcoded Vercel URLs in frontend with relative paths
5. **HIGH-3 / HIGH-4** — Parameterize `redirectUri` and `fullUrl` in QuickBooks files
6. **HIGH-5 / HIGH-6** — Expand `.env.example` with server-side and missing frontend vars
7. **HIGH-8** — Evaluate replacing `xlsx` package
8. **MEDIUM-6** — Fix empty CORS header in `send-email.mjs`
9. **MEDIUM-7** — Confirm `QBO_ENVIRONMENT=production` is set in Vercel
