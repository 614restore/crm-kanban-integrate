---
agent: ui-auditor
status: fail
findings: 25
---

# TrussCTR UI/UX Audit
**Date:** 2026-03-08
**Auditor:** ui-auditor
**Scope:** All screens, modals, dialogs, settings panels, and public pages in `src/`

---

## Summary

The TrussCTR CRM has a solid visual design and a well-structured component architecture. However, the audit uncovered **3 CRITICAL blocking defects**, **9 HIGH-severity UX degradations**, and **13 LOW-severity accessibility/polish issues**. The most serious problems are:

1. Customer signature links (Change Order, Estimate) are **completely unrouted** — they 404 for every recipient.
2. The subscription-expired "Subscribe Now" button navigates to a hardcoded SPA path that doesn't exist in the router, resulting in a 404.
3. The PDF export button in Reports crashes with a `ReferenceError` on every click.

---

## CRITICAL — Blocks User

---

### C-01: `SignChangeOrder` and `SignEstimate` pages are unregistered routes — customer signature links 404

**Severity:** CRITICAL
**Files:**
- `src/App.tsx` — routes missing
- `src/pages/SignEstimate.tsx` — orphaned page
- `src/pages/SignChangeOrder.tsx` — orphaned page
- `src/components/crm/ChangeOrderModal.tsx` lines 112, 222 — generates `/sign-change-order/{token}` URLs

**Description:**
`App.tsx` registers routes for `/sign` (SignDocument), `/reset-password`, `/terms`, `/privacy`, `/eula`, but has **no routes** for `/sign-estimate/:token` or `/sign-change-order/:token`.

`ChangeOrderModal.tsx` (lines 112, 222) generates links like:
```
${window.location.origin}/sign-change-order/${token}
```
When a customer receives this link and opens it, Vercel rewrites to `index.html`, React Router boots up, sees path `/sign-change-order/...`, finds no match, and renders `<NotFound />`. The entire customer-facing signature flow for change orders is completely broken.

`SignEstimate.tsx` is similarly orphaned — no route exists for it and no API endpoint (`sign-estimate.mjs`) exists either.

**Remediation:**
Add routes in `src/App.tsx`:
```tsx
import SignEstimate from "./pages/SignEstimate";
import SignChangeOrder from "./pages/SignChangeOrder";
<Route path="/sign-estimate/:token" element={<SignEstimate />} />
<Route path="/sign-change-order/:token" element={<SignChangeOrder />} />
```

---

### C-02: Subscription-blocked "Subscribe Now" navigates to a non-existent SPA route (404)

**Severity:** CRITICAL
**File:** `src/components/AppLayout.tsx` line 957

**Description:**
When a user's trial has expired, they see a paywall screen. The primary CTA:
```tsx
<a href="/settings?tab=billing">Subscribe Now</a>
```
This is a standard `<a href>` that triggers a full navigation. With Vercel's SPA wildcard rewrite (`/* to index.html`), React Router loads and tries to match `/settings` — which matches no defined route and falls to `<NotFound />`. The user who most needs to pay is sent to a dead-end page.

**Remediation:**
Replace with an in-app navigation that dispatches a view change:
```tsx
<button onClick={() => dispatch({ type: 'SET_VIEW', payload: 'settings' })}>
  Subscribe Now
</button>
```

---

### C-03: Reports & Analytics "Export PDF" crashes with ReferenceError

**Severity:** CRITICAL
**File:** `src/components/crm/ReportsAnalytics.tsx` lines 329-360

**Description:**
The `handleExportPDF` function references identifiers that do not exist in scope:
- `metrics.netProfit` — not in the `metrics` useMemo return object (it returns `totalProfit`)
- `metrics.avgProjectValue` — not defined
- `metrics.conversionRate` — not defined (exists as `overallConversionRate`)
- `metrics.customerSatisfaction` — not defined
- `teamPerformanceData` — no variable with this name exists anywhere in the file (actual variable is `teamPerformance`)

Clicking **Export PDF** throws an uncaught `ReferenceError`. Export CSV works correctly; only PDF is broken.

**Remediation:**
Replace undefined references with the actual property names:
```tsx
{ Metric: 'Net Profit', Value: formatCurrency(metrics.totalProfit) },
{ Metric: 'Conversion Rate', Value: `${metrics.overallConversionRate.toFixed(1)}%` },
// use: teamPerformance.map(...) not teamPerformanceData.map(...)
```

---

## HIGH — Degrades UX

---

### H-01: TopBar renders "Dashboard" for 10+ views — no page title feedback

**Severity:** HIGH
**File:** `src/components/crm/TopBar.tsx` lines 81-97

**Description:**
`viewTitles` is missing entries for: `suppliers`, `estimates`, `projects`, `work-orders`, `material-orders`, `expenses`, `document-templates`, `reports`, `insurance-tracking`, `supplement-tracking`, `financial`, `team`, `automations`.

All fall through to the fallback `|| 'Dashboard'`, so the heading reads "Dashboard" while the user is on the Expenses or Reports screen.

**Remediation:**
Add the missing keys to `viewTitles`:
```tsx
suppliers: 'Suppliers',  estimates: 'Estimates',  projects: 'Projects',
'work-orders': 'Work Orders',  'material-orders': 'Material Orders',
expenses: 'Expenses',  'document-templates': 'Document Templates',
reports: 'Reports & Analytics',  'insurance-tracking': 'Insurance Tracking',
'supplement-tracking': 'Supplement Tracking',  financial: 'Financial Dashboard',
team: 'Team Management',  automations: 'Workflow Automations',
```

---

### H-02: Settings Quick Actions — 3 buttons are dead (no onClick)

**Severity:** HIGH
**File:** `src/components/settings/MainSettings.tsx` lines 181-187

**Description:**
"Export Settings", "Import Configuration", "Reset to Defaults" buttons in the settings sidebar Quick Actions panel have visual hover states but zero handler. Clicking them does nothing.

**Remediation:**
Implement handlers or replace with `disabled` state and tooltip ("Coming soon") until implemented.

---

### H-03: Settings Data Management — 4 export buttons are dead (no onClick)

**Severity:** HIGH
**File:** `src/components/settings/MainSettings.tsx` lines 389-401

**Description:**
"Export All Data", "Export Contacts", "Export Estimates", "Export Invoices" buttons render with hover states but no `onClick` handlers. Note: `ContactList.tsx` already implements CSV contact export — that logic should be wired here.

**Remediation:**
Implement CSV export handlers or mark as `disabled` with tooltip.

---

### H-04: Settings Notification/Appearance/Security panels have un-saveable form controls

**Severity:** HIGH
**File:** `src/components/settings/MainSettings.tsx` lines 217-412

**Description:**
Three settings panels render interactive controls but never persist changes:
- **NotificationSettings**: Checkboxes with `defaultChecked` — changes silently discarded. No save button.
- **AppearanceSettings**: Theme radio buttons that never apply. Logo upload zone ("Click to upload logo") is a `<div>` with no file input or onClick handler.
- **SecuritySettings**: Password policy checkboxes and 2FA toggle — no persistence.

User changes are silently discarded when navigating away with no warning.

**Remediation:**
Add a "Save Changes" button with persistence via Supabase (`db.updateCompany`), or mark sections as read-only until implemented.

---

### H-05: 5 Settings sections show "Coming Soon" but appear as real nav items

**Severity:** HIGH
**File:** `src/components/settings/MainSettings.tsx` lines 413-418

**Description:**
Communication Settings, Calendar Settings, Document Settings, Reporting Settings, and Help & Support all render only `SettingsPlaceholder` with "Coming Soon" text. They appear alongside fully-functional sections in the same sidebar. A user clicking "Help & Support" expecting support contact information gets a dead placeholder.

**Remediation:**
Badge stub items as "Soon" or grey them out in the nav, or remove them until implemented.

---

### H-06: BillingSettings — 3 Add-On "Add" buttons have no onClick handler

**Severity:** HIGH
**File:** `src/components/settings/BillingSettings.tsx` line ~330

**Description:**
The Add-Ons section renders three "+ Add" buttons (5 Additional Users, 500 Additional Contacts, Contact Export) with no onClick handlers. Users attempting to purchase add-ons receive no response.

**Remediation:**
Wire to Stripe Customer Portal (`window.open(...)`) using the same pattern as the "Manage Billing" button.

---

### H-07: CalendarScheduler Month/Week/Day views render "coming soon" placeholder

**Severity:** HIGH
**File:** `src/components/calendar/CalendarScheduler.tsx` lines 779-793

**Description:**
The calendar toolbar shows Month, Week, and Day tabs. Clicking any of them renders `CalendarGridView` which only displays "Month/Week/Day calendar view is coming soon." Only List view is functional. The tabs are clickable and appear fully clickable but deliver zero content.

**Remediation:**
Either implement full calendar grid views, or remove the non-list tabs so the UI matches actual capability.

---

### H-08: 10+ window.prompt / window.confirm dialogs across the app

**Severity:** HIGH
**Files:**
- `src/components/crm/AutomationsView.tsx` lines 67, 102 — window.prompt for automation name
- `src/components/crm/AutomationsView.tsx` line 126 — window.confirm for delete
- `src/components/crm/CalendarView.tsx` lines 189, 222 — window.prompt and window.confirm
- `src/components/crm/DocumentCenter.tsx` line 186 — window.confirm
- `src/components/crm/SettingsView.tsx` line 777 — window.confirm
- `src/components/crm/DocumentTemplates.tsx` line 2536 — window.confirm
- `src/components/crm/ContactDetail.tsx` line 260 — window.confirm
- `src/components/crm/PermitTracker.tsx` line 277 — window.confirm

**Description:**
Native browser dialogs block the UI thread, are unstyled, and are suppressed or broken on mobile WebViews. Newer views (EquipmentView, CrewScheduleView) already use proper in-component confirmation modals — this pattern is inconsistent.

**Remediation:**
Replace with Radix UI `<AlertDialog>` for confirmations and proper form modals for input. The `sonner` toast library, already imported, handles success/error feedback.

---

### H-09: Subscription expired paywall does not deep-link to Billing tab

**Severity:** HIGH
**File:** `src/components/settings/MainSettings.tsx`

**Description:**
Even if the routing were fixed (C-02), linking to `/settings?tab=billing` via query param would not open the Billing tab — `MainSettings.tsx` ignores URL params and always defaults to `'company'` tab (`useState('company')`). The user who just clicked "Subscribe Now" under urgency lands on the wrong settings page.

**Remediation:**
Read `?tab` query param on mount:
```tsx
const [activeSection, setActiveSection] = useState(() =>
  new URLSearchParams(window.location.search).get('tab') || 'company'
);
```

---

## LOW — Accessibility & Polish

---

### L-01: ZERO aria-labels on ~150+ icon-only buttons in CRM components

**Severity:** LOW (accessibility)
**Files:** All files in `src/components/crm/`

**Description:**
A grep for `aria-label` across all non-UI-library component files returns exactly 2 results — both in `AppLayout.tsx` (trial banner dismiss buttons). An estimated 150+ icon-only buttons (X close, Edit pencil, Trash delete, Search clear, Sidebar toggle, Bell, LogOut) have no accessible name.

Notable gaps: sidebar collapse chevron, sign-out button, search-clear X, all Edit/Delete table action buttons, notification bell, filter toggle.

**Remediation:**
```tsx
<button onClick={handleDelete} aria-label="Delete contact">
  <Trash2 size={16} />
</button>
```

---

### L-02: TopBar global search input has no label

**Severity:** LOW
**File:** `src/components/crm/TopBar.tsx` lines ~112-120

**Description:**
Search `<input>` has a placeholder but no `<label>` or `aria-label`. Screen readers won't announce the field purpose.

**Remediation:**
```tsx
<input type="search" aria-label="Search contacts, jobs, documents" ... />
```

---

### L-03: TopBar filter dropdown and notification bell missing aria-expanded / aria-label

**Severity:** LOW
**File:** `src/components/crm/TopBar.tsx`

**Description:**
The Filters dropdown toggle and notification bell have no `aria-label` or `aria-expanded`. Keyboard users cannot determine open/closed state.

**Remediation:**
```tsx
<button aria-label="Open filters" aria-expanded={showFilters} aria-haspopup="true">
```

---

### L-04: Sidebar collapse/expand button missing accessible label

**Severity:** LOW
**File:** `src/components/crm/Sidebar.tsx`

**Description:**
Sidebar toggle renders `<ChevronLeft>` / `<ChevronRight>` with no `aria-label`. Collapsed nav items use HTML `title` attribute for tooltips — visible on hover only, not announced by screen readers.

**Remediation:**
```tsx
<button aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
```
Use `aria-label={item.label}` on collapsed nav item buttons.

---

### L-05: AppearanceSettings logo upload zone has no file input or handler

**Severity:** LOW
**File:** `src/components/settings/MainSettings.tsx` line ~330

**Description:**
The "Click to upload logo" zone is a plain `<div>` with no `<input type="file">`, no onClick, and no drag-and-drop handler. Actual logo upload IS implemented correctly in `CompanyTeamSettings.tsx` (with Supabase storage) — this is an unfunctional duplicate.

**Remediation:**
Remove the dead upload zone from AppearanceSettings and point users to Company & Team Settings for logo upload.

---

### L-06: AutomationsView Create/Edit only expose name — trigger and action are hardcoded

**Severity:** LOW
**File:** `src/components/crm/AutomationsView.tsx`

**Description:**
Creating an automation only sets the name via `window.prompt`. The trigger event and action type are hardcoded and never configurable. No edit UI exists for these properties.

**Remediation:**
Replace the prompt with a modal including trigger event and action type selectors.

---

### L-07: Global search bar inconsistently applied — many views ignore state.searchQuery

**Severity:** LOW
**Files:** `src/components/crm/TopBar.tsx`, multiple view files

**Description:**
Many views (EquipmentView, CrewScheduleView, ReportsAnalytics, InsuranceTrackingView, SupplementTrackingView, FinancialDashboard) maintain their own local `searchQuery` state and do not consume the global `state.searchQuery`. Typing in the global search bar while on Equipment has no effect.

**Remediation:**
Consume `state.searchQuery` from global state in all views, or add a visual indicator that global search only applies to Contacts.

---

### L-08: No empty-state onboarding prompt for brand-new users on Dashboard

**Severity:** LOW
**File:** `src/components/crm/Dashboard.tsx`

**Description:**
Dashboard renders KPI cards showing $0 and 0% for a new user. "Recent Activity" and "Upcoming Appointments" render nothing. First-time users see an empty, confusing screen with no CTA to add their first contact.

**Remediation:**
Add an empty-state card when `state.contacts.length === 0` with a CTA to add the first contact or create the first pipeline entry.

---

### L-09: Two separate Billing UIs exist in parallel

**Severity:** LOW
**Files:** `src/components/crm/SubscriptionView.tsx`, `src/components/settings/BillingSettings.tsx`

**Description:**
`SubscriptionView` is rendered inside `SettingsView.tsx` (line 2093) as a second billing interface separate from `BillingSettings` (the Stripe pricing table in MainSettings). Two billing UIs coexist and may render different or conflicting content depending on which settings path the user took.

**Remediation:**
Consolidate to `BillingSettings` as the single canonical billing UI. Remove or redirect the SubscriptionView reference in SettingsView.

---

### L-10: Settings page does not read ?tab query param on mount

**Severity:** LOW
**File:** `src/components/settings/MainSettings.tsx`

**Description:**
Multiple locations link to Settings with `?tab=billing` or similar, but MainSettings always defaults to `'company'` tab ignoring URL params (see also H-09).

**Remediation:**
```tsx
const [activeSection, setActiveSection] = useState(() =>
  new URLSearchParams(window.location.search).get('tab') || 'company'
);
```

---

### L-11: Many inline buttons missing explicit type="button"

**Severity:** LOW
**Files:** Multiple CRM components

**Description:**
Several `<button>` elements inside form contexts lack `type="button"`. HTML defaults untyped form buttons to `type="submit"`, which can trigger accidental form submissions. Only 27 explicit `type` attributes found across all CRM components.

**Remediation:**
Add `type="button"` to all non-submit buttons in form contexts.

---

### L-12: Notification count badge uses 10px font (below WCAG minimum)

**Severity:** LOW
**File:** `src/components/crm/Sidebar.tsx` line ~224

**Description:**
Notification badge uses `text-[10px]` (10px), below the WCAG recommended minimum of 12px for readable text.

**Remediation:**
Use `text-xs` (12px). The existing "9+" truncation already handles overflow.

---

### L-13: BillingSettings "Compare Plans" links to a static HTML file

**Severity:** LOW
**File:** `src/components/settings/BillingSettings.tsx`

**Description:**
A "Compare Plans" button opens `/public/trussctr-comparison.html` in a new tab. This file exists in the repo, but serving a raw HTML file bypasses the SPA navigation context. If the deployment path changes, users get a 404.

**Remediation:**
Verify the path resolves correctly in production. Consider integrating the comparison inline or as a proper route.

---

## Metrics

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 9 |
| LOW | 13 |
| **Total** | **25** |

### Coverage
- TSX files audited: ~65 components + routing entry points
- Dead click handlers (explicit no-op buttons): 10
- Settings sections that are "Coming Soon" stubs: 5
- aria-label coverage on CRM icon buttons: ~1% (2 of ~150+)
- window.prompt / window.confirm usages: 10 across 9 files
- Missing router entries for existing page components: 2

### Priority Fix Order
1. **C-01** Register SignEstimate + SignChangeOrder routes (~30 min)
2. **C-02** Fix "Subscribe Now" to use in-app navigation (~15 min)
3. **C-03** Fix undefined variables in handleExportPDF (~20 min)
4. **H-01** Add missing view titles to TopBar (~10 min)
5. **H-02 / H-03** Implement or disable dead export/action buttons in Settings
6. **H-04** Add save functionality to Notification/Appearance/Security settings
7. **H-05** Distinguish or remove stub "Coming Soon" settings nav items
8. **H-06** Wire billing add-on buttons to Stripe Customer Portal
9. **H-07** Remove non-functional Month/Week/Day calendar tabs or implement them
10. **L-01** Batch add aria-label to all icon-only buttons (high-impact accessibility)
