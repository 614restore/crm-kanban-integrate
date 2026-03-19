# Infrastructure Audit — TrussCTR CRM (2026-03-19)

## Summary
1 critical · 6 high · 7 medium · 4 low

---

## CRITICAL (1)

SEVERITY: critical
FILE: api/stripe-checkout.mjs lines 13-20
FINDING: getAllowedPriceIds() reads process.env.VITE_STRIPE_* vars. These are Vite client-side build vars and will be undefined in the Vercel serverless runtime. The array returns empty, and the guard passes vacuously — any arbitrary Stripe price ID is accepted. A caller can substitute a $1/month price ID and it will not be rejected.
FIX: Replace all 8 VITE_STRIPE_* references in this file with non-prefixed server-only vars (e.g. STRIPE_PRICE_STARTER_MONTHLY).

---

## HIGH (6)

SEVERITY: high
FILE: api/document-handler.mjs line 4
FINDING: VITE_ fallback order is reversed; server-side SUPABASE_URL should take priority over VITE_SUPABASE_URL.
FIX: Swap fallback order: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL

SEVERITY: high
FILE: api/document-handler.mjs line 18
FINDING: Empty catch {} silently swallows all Resend email failures.
FIX: Add console.error() and structured error logging in the catch block.

SEVERITY: high
FILE: api/send-email.mjs lines 5-7
FINDING: CORS Allow-Origin header set to APP_URL || ''. If APP_URL is unset, the empty-string header breaks all browser preflight requests.
FIX: Require APP_URL — return 500 if not configured rather than defaulting to empty string.

SEVERITY: high
FILE: api/eagleview-webhook.mjs lines 18-28
FINDING: Signature verification is optional. If EAGLEVIEW_WEBHOOK_SECRET is unset, the endpoint accepts unauthenticated POSTs from any source.
FIX: Make the secret mandatory — return 500 if not configured, 401 if signature is absent.

SEVERITY: high
FILE: vercel.json
FINDING: No functions block means default 10s timeout applies to stripe-webhook.mjs, eagleview-order.mjs, and document-handler.mjs — all can exceed 10s under normal load.
FIX: Add a functions block with maxDuration: 30 for these three routes.

SEVERITY: high
FILE: .env.example
FINDING: Five actively-used variables are completely absent: EAGLEVIEW_API_KEY, EAGLEVIEW_API_SECRET, EAGLEVIEW_CLIENT_ID, EAGLEVIEW_ENV, EAGLEVIEW_WEBHOOK_SECRET.
FIX: Add an EagleView section to .env.example with all five vars.

---

## MEDIUM (7)

SEVERITY: medium
FILE: api/stripe-checkout.mjs, stripe-portal.mjs, ai-draft.mjs, eagleview.mjs, eagleview-order.mjs, eagleview-auth.mjs
FINDING: No CORS headers and no OPTIONS handler — browser preflight requests will fail.
FIX: Add setCors(req, res) and handle OPTIONS method in each route.

SEVERITY: medium
FILE: api/document-handler.mjs lines 67, 118
FINDING: Email body links hardcoded to crm-kanban-integrate.vercel.app, bypassing APP_URL.
FIX: Replace hardcoded domain with process.env.APP_URL.

SEVERITY: medium
FILE: .github/workflows/deploy.yml line 36
FINDING: VITE_STRIPE_PUBLISHABLE_KEY secret referenced but not in .env.example or truthpack.
FIX: Add to .env.example and Vercel env vars.

SEVERITY: medium
FILE: .github/workflows/
FINDING: Both deploy.yml (GitHub Pages) and deploy-vercel.yml trigger on every main push — ambiguous production target.
FIX: Disable or remove deploy.yml now that Vercel is the production deployment target.

SEVERITY: medium
FILE: .github/workflows/quality-gate.yml
FINDING: Build step passes no env vars; builds against undefined Supabase config.
FIX: Add required env vars to the workflow using GitHub Secrets.

SEVERITY: medium
FILE: .github/workflows/soak-regression.yml
FINDING: Daily cron with no actual test assertions; uses npm install instead of npm ci.
FIX: Replace npm install with npm ci; add real assertions or remove the workflow.

SEVERITY: medium
FILE: api/stripe-webhook.mjs line 22
FINDING: export const config = { api: { bodyParser: false } } is Next.js syntax with no effect in Vercel's plain serverless runtime — dead code.
FIX: Remove the export const config block; use proper raw body parsing for Vercel functions.

---

## LOW (4)

SEVERITY: low
FILE: vercel.json CSP
FINDING: unsafe-eval in script-src weakens XSS protection.
FIX: Document as accepted risk or remove if not needed.

SEVERITY: low
FILE: .github/workflows/deploy-vercel.yml
FINDING: No typecheck or lint step before deploying to production.
FIX: Add npm run lint && npm run typecheck before the deploy step.

SEVERITY: low
FILE: api/eagleview-auth.mjs + 2 other EagleView routes
FINDING: OAuth client ID hardcoded as fallback default.
FIX: Remove hardcoded fallback; require the env var.

SEVERITY: low
FILE: .github/workflows/
FINDING: Node version inconsistency — PR checks use Node 24 (via .nvmrc); other workflows hardcode Node 20.
FIX: Standardize all workflows on the same Node version as .nvmrc.
