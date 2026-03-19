# Security Audit — TrussCTR CRM (2026-03-19)

## Summary
3 critical · 5 high · 5 medium · 4 low — 18 total

---

## CRITICAL (3)

SEVERITY: critical
FILE: .env, .env.local
FINDING: Two real Supabase project URLs and full anon JWT tokens present on disk (yjnnvocctprfuwirrxcx.supabase.co in .env, qgvuzrvpyyrrulhwlzma.supabase.co in .env.local). If either file was ever committed, those keys are in git history.
FIX: Run git log --all -- .env .env.local to check. Rotate both anon keys in the Supabase dashboard immediately. Store all credentials in Vercel environment variables only.

SEVERITY: critical
FILE: src/lib/aiConfigurationManager.ts — encryptApiKey()
FINDING: AI API keys stored in ai_configurations table "encrypted" with Buffer.from(key).toString('base64'). Base64 provides zero confidentiality. Any company user who can SELECT from that table can trivially decode every stored key.
FIX: Replace with AES-256-GCM using libsodium-wrappers server-side. Decryption must never happen in the client bundle. Make decryptApiKey private.

SEVERITY: critical
FILE: api/eagleview-webhook.mjs
FINDING: Only validates HMAC signature if (webhookSecret && signature). If EAGLEVIEW_WEBHOOK_SECRET is unset, the endpoint is fully unauthenticated — any attacker can overwrite job records.
FIX: Make verification mandatory. Return 401 immediately if the secret or signature is absent.

---

## HIGH (5)

SEVERITY: high
FILE: api/document-handler.mjs
FINDING: Public signing/tracking endpoint uses a service-role client. No rate limiting means token brute-force is possible. Notification email fires before the viewed_at DB flag is set, enabling duplicate sends.
FIX: Add IP-based rate limiting. Fix the race by updating viewed_at atomically before emailing.

SEVERITY: high
FILE: api/send-invite.mjs
FINDING: inviteUrl, companyName, and invitedByName are interpolated raw into HTML email template. An authenticated user can inject arbitrary HTML or javascript: hrefs.
FIX: Validate inviteUrl starts with APP_URL. HTML-escape all user-supplied fields.

SEVERITY: high
FILE: api/send-email.mjs
FINDING: Access-Control-Allow-Origin set to process.env.APP_URL || ''. Empty string breaks CORS silently when APP_URL is unset.
FIX: Use the origin-reflective allowlist pattern from send-invite.mjs. Fail closed if APP_URL is absent.

SEVERITY: high
FILE: src/components/crm/EquipmentView.tsx + TeamView.tsx
FINDING: Delete on equipment and delete on invitations have no client-side role check. Any authenticated company member can perform these operations if RLS permits it.
FIX: Add canManage/isAdmin guards before delete actions in both components.

SEVERITY: high
FILE: src/lib/aiConfigurationManager.ts
FINDING: decryptApiKey is a public method on the exported singleton. Any XSS payload that runs in-page can call aiConfigurationManager.decryptApiKey(x) to decode any stored key.
FIX: Mark it private.

SEVERITY: high
FILE: api/_disabled/quickbooks-sync.mjs
FINDING: May still be deployed by Vercel. Has wildcard CORS and the production Supabase URL hardcoded as a fallback.
FIX: Move _disabled/ outside api/ or exclude via vercel.json. Remove the hardcoded URL.

---

## MEDIUM (5)

SEVERITY: medium
FILE: src/components/crm/FeatureToggles.tsx + multiple components
FINDING: Team members, permissions, and feature flags stored in localStorage. Can be tampered with in DevTools to escalate client-side privileges. The code comment acknowledges this is a production TODO.
FIX: Move all access-control state to Supabase. Use localStorage only for non-sensitive UI prefs.

SEVERITY: medium
FILE: src/components/crm/FeatureToggles.tsx
FINDING: Feature flags stored in localStorage are trivially bypassable — a user can unlock any feature manually.
FIX: Move feature flag reads/writes to the companies table, protected by RLS.

SEVERITY: medium
FILE: supabase-migrations/ — customer_surveys table
FINDING: RLS uses old subquery pattern instead of get_my_company_id(). All other tables use company_id = get_my_company_id(). This approach has prior recursion risks.
FIX: Update the three policies to company_id = get_my_company_id().

SEVERITY: medium
FILE: api/send-email.mjs, api/send-invite.mjs, api/ai-draft.mjs
FINDING: No rate limiting on any API endpoint. Auth-gated email and AI endpoints can be abused with a valid JWT to send unlimited emails or exhaust AI quota.
FIX: Add Vercel Edge Middleware or Upstash Redis rate limiting on these three routes.

SEVERITY: medium
FILE: api/document-handler.mjs
FINDING: signedBy and signatureData have no size limits. A crafted multi-megabyte signatureData payload can be submitted. signedBy is stored unescaped and rendered in email HTML.
FIX: Cap signedBy at 200 chars, signatureData at 500 KB. HTML-escape signedBy.

---

## LOW (4)

SEVERITY: low
FILE: src/components/ui/chart.tsx
FINDING: dangerouslySetInnerHTML could become XSS if props come from user input.
FIX: Ensure id and colorConfig are never derived from raw user input at all call sites.

SEVERITY: low
FILE: api/stripe-checkout.mjs
FINDING: couponId is unvalidated, enabling coupon enumeration.
FIX: Validate against an allowlist or remove client-side coupon support.

SEVERITY: low
FILE: src/lib/integrations/twilio.ts
FINDING: Twilio credentials used client-side.
FIX: Move all Twilio calls to a server-side Vercel function.

SEVERITY: low
FILE: api/eagleview-webhook.mjs
FINDING: reportUrl from EagleView webhook written unvalidated into jobs.notes.
FIX: Validate HTTPS protocol with new URL() before writing.
