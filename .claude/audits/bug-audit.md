---
agent: bug-auditor
status: fail
findings: 12
---

# TrussCTR Bug Audit — March 8, 2026

## Summary

12 bugs found across 7 files. 3 CRITICAL issues directly break core user flows: PDF export crashes at runtime
with an undeclared variable (`teamPerformanceData`), expired-trial users who click "Subscribe Now" land on a
404 (blocking all subscriptions), and four metric properties in the PDF payload are `undefined`. 4 HIGH bugs
cause data corruption and empty-state failures. 5 MEDIUM bugs produce silent failures, misleading UI, or dead
code risks.

---

## CRITICAL

---

### BUG-01 · `ReportsAnalytics.tsx:355` — `teamPerformanceData` ReferenceError crashes PDF export

**File:** `src/components/crm/ReportsAnalytics.tsx`
**Lines:** 355–360

The `handleExportPDF` function references `teamPerformanceData`, which is never declared anywhere in the file.
The correct in-scope variable is `teamPerformance` (line ~202). Additionally the field names in the `.map()`
do not match the `TeamPerformance` interface: `member` not `name`, `projectsCompleted` not `projects`,
`customerRating` not `satisfaction`.

```ts
// Current (broken):
rows: teamPerformanceData.map(t => ({   // ReferenceError — variable does not exist
  Team_Member: t.name,                  // wrong field (should be t.member)
  Projects:    t.projects,              // wrong field (should be t.projectsCompleted)
  Revenue:     `$${t.revenue.toLocaleString()}`,
  Satisfaction:`${t.satisfaction}/5`,   // wrong field (should be t.customerRating)
}))

// Fixed:
rows: teamPerformance.map(t => ({
  Team_Member: t.member,
  Projects:    t.projectsCompleted,
  Revenue:     `$${t.revenue.toLocaleString()}`,
  Rating:      `${t.customerRating}/5`,
}))
```

**Impact:** Every click of the "Export PDF" button throws an uncaught ReferenceError, silently aborting
the handler. Users see no feedback.

---

### BUG-02 · `AppLayout.tsx:957` — Paywall "Subscribe Now" link navigates to a 404

**File:** `src/components/AppLayout.tsx`
**Line:** 957

```tsx
<a href="/settings?tab=billing">Subscribe Now</a>
```

There is no `/settings` route in `src/App.tsx`. Registered routes are: `/`, `/photos`, `/reset-password`,
`/terms`, `/privacy`, `/eula`, `/sign`, `*` (NotFound). "Settings" is CRM view state
(`currentView: "settings"`), not a URL. The `<a>` tag triggers a full browser navigation; BrowserRouter
finds no match and renders NotFound.

**Impact:** Users with an expired trial or canceled subscription click "Subscribe Now" and land on a 404
dead end. They cannot subscribe. Direct conversion and revenue blocker.

**Fix:** Replace the `<a>` tag with a button that sets a sessionStorage flag and redirects to `/`:

```tsx
<button
  onClick={() => {
    try { sessionStorage.setItem("open_billing", "true"); } catch (_) {}
    window.location.href = "/";
  }}
  className="inline-block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg px-6 py-3 text-sm transition-colors"
>
  Subscribe Now
</button>
```

Then in `CRMApp`'s init sequence, read the flag and dispatch `SET_VIEW: "settings"` with the billing tab.

---

### BUG-03 · `ReportsAnalytics.tsx:346–350` — Four undefined property accesses in PDF Key Metrics table

**File:** `src/components/crm/ReportsAnalytics.tsx`
**Lines:** 346, 348, 349, 350

```ts
{ Metric: "Net Profit",            Value: formatCurrency(metrics.netProfit) },         // undefined
{ Metric: "Avg Project Value",     Value: formatCurrency(metrics.avgProjectValue) },    // undefined
{ Metric: "Conversion Rate",       Value: `${metrics.conversionRate}%` },               // "undefined%"
{ Metric: "Customer Satisfaction", Value: `${metrics.customerSatisfaction}/5` },        // "undefined/5"
```

The `metrics` useMemo (lines 264–293) returns `{ totalRevenue, totalExpenses, totalProfit, avgProfitMargin,
totalProjects, completedProjects, activeProjects, completionRate, totalLeads, totalConversions,
overallConversionRate }`. None of the four accessed keys exist. `tsconfig.app.json` has `"strict": false`
and `"noImplicitAny": false`, so TypeScript does not flag this.

**Fix:**
```ts
{ Metric: "Net Profit",        Value: formatCurrency(metrics.totalProfit) },
{ Metric: "Avg Project Value", Value: formatCurrency(
    metrics.totalProjects > 0 ? metrics.totalRevenue / metrics.totalProjects : 0) },
{ Metric: "Conversion Rate",   Value: `${metrics.overallConversionRate.toFixed(1)}%` },
// Remove "Customer Satisfaction" — no data source exists
```

---

## HIGH

---

### BUG-04 · `ReportsAnalytics.tsx:268,274,278` — Division by zero produces NaN in all metric cards for new accounts

**File:** `src/components/crm/ReportsAnalytics.tsx`
**Lines:** 268, 274, 278 (computed); rendered at 443, 459, 472, 1082

```ts
const avgProfitMargin       = (totalProfit  / totalRevenue)   * 100;  // NaN when no invoices
const completionRate        = (completedProjects / totalProjects) * 100;  // NaN when no projects
const overallConversionRate = (totalConversions / totalLeads)  * 100;  // NaN when no contacts
```

`.toFixed(1)` on `NaN` returns the string `"NaN"` without throwing. Every new account with zero data sees
"NaN% margin", "NaN% completion rate", "NaN%" across the four analytics cards.

**Fix:**
```ts
const avgProfitMargin       = totalRevenue  > 0 ? (totalProfit / totalRevenue) * 100 : 0;
const completionRate        = totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0;
const overallConversionRate = totalLeads    > 0 ? (totalConversions / totalLeads) * 100 : 0;
```

---

### BUG-05 · `EstimatesView.tsx:196` — Tax rate silently reset to 0% when editing an estimate with zero subtotal

**File:** `src/components/crm/EstimatesView.tsx`
**Line:** 196

```ts
setTaxRate(estimate.tax / estimate.amount * 100 || 0);
```

When `estimate.amount === 0`, this is `0/0 = NaN`, then `NaN || 0 = 0`. Any previously saved tax rate
(e.g. 8%) is silently overwritten with 0%. On next save the `tax` column is written as `0`, permanently
corrupting the estimate's tax data.

**Fix:** `setTaxRate(estimate.amount > 0 ? (estimate.tax / estimate.amount) * 100 : 0);`

---

### BUG-06 · `ProjectsView / EstimatesView / WorkOrdersView` — Empty dep array silently skips data fetch if profile not ready at mount

**Files:**
- `src/components/crm/ProjectsView.tsx` ~line 113
- `src/components/crm/EstimatesView.tsx` ~line 82
- `src/components/crm/WorkOrdersView.tsx` ~line 130

```ts
useEffect(() => {
  loadProjects();   // returns early if !profile?.company_id
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);             // never retries when company_id arrives
```

On slow auth initialization, `profile?.company_id` may be null at first mount. The fetch is silently
skipped and never retried. The view appears empty until a hard reload.

**Fix:** `useEffect(() => { if (profile?.company_id) loadProjects(); }, [profile?.company_id]);`

---

### BUG-07 · `authContext.tsx:~196–220` — Stale `pending_password_reset` flag freezes app for 12 seconds

**File:** `src/lib/authContext.tsx`
**Lines:** ~196–220

`pendingReset` is read from sessionStorage at init and never cleared unless a `PASSWORD_RECOVERY` event
fires. If a user once opened a reset link but navigated away before completing the flow, the flag persists.
On every subsequent page load, both the auth state listener and `getSession().then()` early-return without
ever calling `setLoading(false)`. The app is stuck on the loading screen for 12 seconds until the failsafe
timeout fires.

**Fix:** In the `SIGNED_IN`/`INITIAL_SESSION` branch, treat any non-recovery event as proof the flag is
stale and clear it before the early-return guard:
```ts
if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && pendingReset && !recoveryEventFired) {
  try { sessionStorage.removeItem("pending_password_reset"); } catch (_) {}
}
if (recoveryEventFired || pendingReset) return;
```

---

## MEDIUM

---

### BUG-08 · `ReportsAnalytics.tsx:98` — Period selector ignored — all options show identical 12-month data

**File:** `src/components/crm/ReportsAnalytics.tsx`
**Lines:** 98, 103–140

The "Last 30 Days / 90 Days / 12 Months / YTD" dropdown has no effect because `selectedPeriod` is never
referenced inside or listed as a dependency of the `revenueData` useMemo. All four options render the same
12-month chart.

**Fix:** Gate the month-bucket seed loop on `selectedPeriod` and add it to the useMemo dep array:
```ts
const monthsBack = selectedPeriod === "30days" ? 1 : selectedPeriod === "90days" ? 3 : 12;
for (let i = monthsBack - 1; i >= 0; i--) { ... }
```

---

### BUG-09 · `stripe-webhook.mjs:~95` — `listUsers()` without pagination misses users beyond offset 50

**File:** `api/stripe-webhook.mjs`
**Lines:** ~95–107

```js
const { data: { users } } = await supabase.auth.admin.listUsers();  // default page = 50
const matchedUser = users.find(u => u.email === email);
```

If the customer's auth account is beyond position 50, `matchedUser` is `undefined`, `companyId` is never
resolved, and the company's `subscription_status` is never activated after a successful payment.

**Fix:** Use a direct lookup:
```js
const { data: userData } = await supabase.auth.admin.getUserByEmail(
  session.customer_details.email
);
const matchedUser = userData?.user ?? null;
```

---

### BUG-10 · `AppLayout.tsx:317` / `BillingSettings.tsx:22–31` — Dead constants never used

**Files:**
- `src/components/AppLayout.tsx` line 317: `const BILLING_SETTINGS_VIEW = "billing";`
- `src/components/settings/BillingSettings.tsx` lines 22–31: `const STRIPE_PRICES = { ... }`

Both are leftover from a previous custom checkout flow replaced by the Stripe Pricing Table embed.
`STRIPE_PRICES` reads 8 `VITE_STRIPE_*` env vars that serve no purpose.

---

### BUG-11 · `api/stripe-checkout.mjs:32` — No type validation on `couponId` / `planId` from request body

**File:** `api/stripe-checkout.mjs`
**Line:** 32

```js
const { priceId, planId, couponId } = req.body;
...(couponId ? { discounts: [{ coupon: couponId }] } : ...),
```

A non-string `couponId` (object, array) is passed directly to Stripe, causing an opaque 400 error.
`planId` is written to Stripe metadata without length validation.

**Fix:**
```js
const couponId = typeof req.body.couponId === "string" && req.body.couponId.trim()
  ? req.body.couponId.trim() : null;
const planId = typeof req.body.planId === "string" ? req.body.planId.slice(0, 50) : "";
```

---

### BUG-12 · `index.html:25,28,35,37` — App still branded "614 Restore" in all `<head>` metadata

**File:** `index.html`
**Lines:** 25, 28, 35, 37

Browser tab title, PWA home-screen install name, and all OG/Twitter social-share previews still reference
the old brand name "614 Restore" instead of "TrussCTR".

---

## Metrics

| Severity | Count |
|----------|-------|
| CRITICAL | 3     |
| HIGH     | 4     |
| MEDIUM   | 5     |
| **Total**| **12** |

| Category                          | Count |
|-----------------------------------|-------|
| Runtime crashes / ReferenceError  | 2     |
| Data / calculation errors         | 4     |
| Navigation / routing (404)        | 1     |
| Auth flow / race condition        | 1     |
| Stripe / billing bugs             | 2     |
| Dead code / branding              | 2     |

## Priority Fix Order

1. **BUG-02** — Fix paywall "Subscribe Now" 404 (direct revenue blocker)
2. **BUG-01** — Fix `teamPerformanceData` ReferenceError crashing PDF export
3. **BUG-03** — Fix undefined metric keys in PDF Key Metrics table
4. **BUG-04** — Guard division by zero in metrics (visible to every new user)
5. **BUG-05** — Fix tax rate data-loss when editing estimates with zero subtotal
6. **BUG-07** — Clear stale `pending_password_reset` (12s freeze on login)
7. **BUG-06** — Add `profile?.company_id` dep to view mount effects (3 files)
8. **BUG-09** — Replace `listUsers()` with `getUserByEmail()` in Stripe webhook
9. **BUG-08** — Wire `selectedPeriod` into `revenueData` useMemo
10. **BUG-11** — Validate `couponId`/`planId` types in `stripe-checkout.mjs`
11. **BUG-10 + BUG-12** — Remove dead constants; update brand name in `index.html`
