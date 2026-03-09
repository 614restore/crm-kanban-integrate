---
agent: ui-auditor
status: fail
findings: 14
---

# UI/UX Audit — TrussCTR Contractor CRM
**Date:** 2026-03-08  
**Scope:** Onboarding, empty states, navigation, mobile, error states, trial banner, billing  
**Auditor:** ui-auditor mode

---

## Summary

The app has a solid visual foundation — consistent use of Tailwind, good modal patterns, toast feedback in most forms, and a real mobile layout. However, there are 14 distinct UX issues ranging from a missing onboarding flow (P1) to a broken trial banner copy button in the urgency phase (P1 / quick win). The sidebar is a flat dump of 23 ungrouped items and the `BillingSettings.tsx` component is unreachable dead code.

---

## Findings

### P1 — Critical / Conversion-Impacting

---

#### [F-01] No onboarding flow for new users
**Severity:** P1 — Critical  
**Files:** `src/lib/authContext.tsx` (L435), `src/lib/setupCompany.ts`, `src/components/crm/Dashboard.tsx`

**Description:**  
`setupNewUser()` is called silently in the background when a new account is created, but there is zero first-run UI. A brand-new user who signs up lands directly on the Dashboard showing all-zero metrics — no checklist, no guided setup, no tooltip, no modal. There is no "Getting Started" prompt, no sample data, no inline guidance.

The Dashboard headline is "Welcome back, {firstName}!" — the word "back" is incorrect for new users on first login.

**Remediation:**
- Add a first-run checklist panel or modal that appears when `contacts.length === 0 && teamMembers.length <= 1 && invoices.length === 0`
- Steps: Add first contact → Create first estimate → Invite a team member → Connect email
- Alternatively, populate demo/seed data on account creation (toggle-removable)
- Change "Welcome back" to "Welcome" for accounts with 0 historical data

---

#### [F-02] Trial banner urgency phase (days 8–14) has NO copy button for LAUNCH50
**Severity:** P1 — High impact, 5-minute fix  
**File:** `src/components/AppLayout.tsx` (lines ~375–393)

**Description:**  
The day 1–7 "discount" banner has a polished inline copy button:
```tsx
<button onClick={handleCopy} className="...font-mono font-bold...">
  {copied ? '✓ Copied!' : LAUNCH_PROMO_CODE}
</button>
```

The day 8–14 "urgency" banner shows the code only as inline bold text — no button, no copy interaction:
```tsx
Use code <strong className="font-mono">{LAUNCH_PROMO_CODE}</strong> at checkout...
```

Users in the urgency phase are the **most likely to convert**. They must manually select and copy the code from the banner text, which is friction that will reduce redemption.

The `handleCopy` function is already defined in the component — it just wasn't threaded into the urgency variant.

**Remediation:**  
Add the copy button to the urgency banner (yellow phase):
```tsx
if (showUrgency) {
  return (
    <div className="flex items-center justify-between gap-3 bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800">
      <div className="flex items-center gap-2 flex-wrap">
        <Zap className="w-4 h-4 flex-shrink-0" />
        <span>
          Your free trial ends in <strong>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</strong>.{' '}
          Use code at checkout for <strong>50% off 3 months</strong> (monthly plans only).
        </span>
        <button
          onClick={handleCopy}
          className="flex-shrink-0 flex items-center gap-1 bg-yellow-200 hover:bg-yellow-300 border border-yellow-400 rounded px-2 py-0.5 text-xs font-mono font-bold transition-colors"
          title="Copy promo code"
        >
          {copied ? '✓ Copied!' : LAUNCH_PROMO_CODE}
        </button>
      </div>
      <button onClick={() => setDismissed(true)} ...>
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
```

---

#### [F-03] `BillingSettings.tsx` is unreachable dead code — users never see it
**Severity:** P1 — Feature gap  
**Files:** `src/components/settings/BillingSettings.tsx`, `src/components/settings/MainSettings.tsx`, `src/components/crm/SettingsView.tsx`

**Description:**  
`BillingSettings.tsx` is imported by `MainSettings.tsx` (line 22), but `MainSettings.tsx` is **not imported anywhere** in the live app — it has no consumers. The actual Settings route renders `SettingsView.tsx`, whose billing tab (`activeTab === 'billing'` at line 2087) uses the separate `SubscriptionView` component.

This means:
- The well-designed billing/upgrade page in `BillingSettings.tsx` (full pricing table, add-ons section, competitor comparison) is **never shown to users**
- `MainSettings.tsx` itself is dead code

Additionally, the Add-Ons "Add" buttons inside `BillingSettings.tsx` (lines ~324–334) have no `onClick` handler — clicking them does nothing.

**Remediation:**
- Either import and render `BillingSettings` from `SettingsView.tsx`'s billing tab, replacing or supplementing `SubscriptionView`
- Or delete `BillingSettings.tsx` and `MainSettings.tsx` if they are deliberately unused

---

#### [F-04] Promo code LAUNCH50 not visible at the point of purchase
**Severity:** P1 — Conversion gap  
**Files:** `src/components/crm/SettingsView.tsx` (billing tab), `src/components/crm/SubscriptionView.tsx`

**Description:**  
Users who click through to the Stripe pricing table (from Settings → Billing) see no mention of the `LAUNCH50` promo code. The trial banner disappears once they navigate away, and neither `SubscriptionView` nor the billing tab in `SettingsView` shows the promo code or any discount reminder. Users who remember a promo exists still have to navigate back to find it.

**Remediation:**  
Add a promo code reminder callout directly above the Stripe pricing table in `SubscriptionView`:
```tsx
{company?.subscription_status === 'trialing' && (
  <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 text-sm text-indigo-800 flex items-center gap-2 mb-4">
    <Tag className="w-4 h-4" />
    Use code <strong className="font-mono">LAUNCH50</strong> at checkout for 50% off your first 3 months (monthly plans).
  </div>
)}
```

---

### P2 — Significant UX Problems

---

#### [F-05] Sidebar: 23 flat ungrouped navigation items
**Severity:** P2 — Navigation friction  
**File:** `src/components/crm/Sidebar.tsx` (lines 40–63, `navItems` array)

**Description:**  
The sidebar lists every module in a single flat vertical list with no section headers, dividers, or grouping. This creates cognitive overload — users must scan all 23 items to find what they need. Items are also in a non-intuitive order (e.g., "Expenses" between "Financial" and "Suppliers", "AI Assistant" between "Automations" and "Settings").

Current order (abbreviated): Dashboard → Pipeline → Contacts → Communications → Calendar → Documents → Templates → Financial → Expenses → Suppliers → Estimates → Projects → Crew Schedule → Equipment → Work Orders → Material Orders → Insurance → Supplements → Reports → Team → Automations → AI Assistant → Settings

**Remediation:**  
Introduce section labels. Suggested logical groupings:

| Group | Items |
|---|---|
| **Overview** | Dashboard, Reports |
| **Leads & CRM** | Pipeline, Contacts, Communications, Calendar |
| **Sales** | Estimates, Financial, Expenses |
| **Projects** | Projects, Work Orders, Crew Schedule, Equipment, Material Orders, Suppliers |
| **Insurance** | Insurance Tracking, Supplements |
| **Tools** | Documents, Templates, Automations, AI Assistant |
| **Admin** | Team, Settings |

Add small uppercase section labels (e.g., `<p className="px-3 pb-1 pt-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">CRM</p>`) between groups when the sidebar is expanded.

---

#### [F-06] ContactList empty state: wrong message for zero-data state vs. search-filtered state
**Severity:** P2 — Misleading copy  
**File:** `src/components/crm/ContactList.tsx` (lines 519–528)

**Description:**  
The empty state only keys off `sortedContacts.length === 0`, but it always shows the same UI regardless of whether:
- (a) there are literally no contacts yet (brand new account), or
- (b) the search/filter returned no matches

In case (a), the icon is `<Search>` and the text says "Try adjusting your search or filter criteria" — which makes no sense for a user who hasn't added any contacts yet. There's no CTA to add a first contact (unlike ProjectsView, WorkOrdersView, etc., which do).

**Remediation:**  
Distinguish the two cases:
```tsx
{sortedContacts.length === 0 && (
  state.contacts.length === 0
    ? (
      <div className="p-12 text-center">
        <Users size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts yet</h3>
        <p className="text-gray-500 mb-4">Add your first contact or lead to get started</p>
        <button onClick={() => dispatch({ type: 'SET_SHOW_QUICK_ADD', payload: true })}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={20} /> Add First Contact
        </button>
      </div>
    )
    : (
      <div className="p-12 text-center">
        <Search size={24} className="..." />
        <h3>No contacts found</h3>
        <p>Try adjusting your search or filter criteria</p>
      </div>
    )
)}
```

---

#### [F-07] PipelineBoard empty columns have no CTA to add a contact
**Severity:** P2 — Dead end for new users  
**File:** `src/components/crm/PipelineBoard.tsx` (lines 494–498)

**Description:**  
Empty pipeline columns show just:
```tsx
<div className="text-center py-8 text-gray-400">
  <p className="text-sm">No contacts</p>
</div>
```

No icon, no link, no button. Compare this to ProjectsView, WorkOrdersView, and EstimatesView which all have action buttons in their empty states.

**Remediation:**  
Add a "Add Contact" link/button (or link to the Contacts view) in the empty column state.

---

#### [F-08] Dashboard shows all zeros for a new user with no orientation
**Severity:** P2 — Poor first impression  
**File:** `src/components/crm/Dashboard.tsx`

**Description:**  
The Dashboard stats cards (total contacts, open invoices, pipeline value, etc.) all show `$0` or `0` for a new user. There's no contextual help explaining what each metric means or how to populate it. The "Upcoming Appointments" and "Action Items" sections do have graceful empty states, but the top-level KPI card row and the activity feed just render empty or zeroed-out — which looks like a loaded/broken state, not an intentional "new account" experience.

**Remediation:**  
Add a "Getting Started" card that appears when `contacts.length === 0`:
```tsx
{state.contacts.length === 0 && (
  <GettingStartedCard /> // checklist: add contact, create estimate, invite team
)}
```

---

### P3 — Minor / Polish

---

#### [F-09] Data load failure shows empty app with no error message
**Severity:** P3 — Silent failure  
**File:** `src/components/AppLayout.tsx` (lines ~733–751)

**Description:**  
The `loadData` catch block silently dispatches empty arrays on any error. If Supabase is down or the user's session is invalid, the app just shows empty views everywhere with no toast, banner, or retry button. The user has no indication that something went wrong vs. genuinely having no data.

The `withFetchTimeout` wrapper also silently returns `[]` on timeout — a user on a slow connection simply sees an empty app.

**Remediation:**  
In the catch block, add a toast or a banner:
```tsx
} catch (error) {
  console.error('Error loading CRM data:', error);
  toast.error('Failed to load your data. Please refresh to try again.');
  // ...dispatch empty fallback
}
```
Consider also tracking a `loadError` state and showing an inline retry button in the main content area.

---

#### [F-10] Mobile header hardcodes "TrussCTR" instead of company name
**Severity:** P3 — White-label / branding inconsistency  
**File:** `src/components/mobile/ResponsiveLayout.tsx` (line ~152)

**Description:**  
The mobile sticky header displays `<span>TrussCTR</span>` as a hardcoded string, even though the component already loads `companyLogoUrl` from the company record. The desktop sidebar dynamically displays the user's company name. On mobile, white-label/custom-branded tenants see "TrussCTR" in the header.

**Remediation:**  
Add a `companyName` state alongside `companyLogoUrl` in `ResponsiveLayout.tsx` (mirroring the pattern in `Sidebar.tsx`).

---

#### [F-11] MobileNav: "Work Orders" view ID mismatch
**Severity:** P3 — Navigation bug  
**File:** `src/components/mobile/MobileNav.tsx` (line ~76)

**Description:**  
The secondary nav item for Work Orders sets `view: 'work_orders'` (underscore), but the `ViewType` and router use `'work-orders'` (hyphen). This means tapping "Work Orders" in the mobile More sheet will navigate to the default case (`Dashboard`) instead.

```tsx
{ icon: FileText, label: 'Work Orders', path: '/', view: 'work_orders', color: '...' },
//                                                       ^^^^^^^^^^^^ should be 'work-orders'
```

**Remediation:**  
Change `view: 'work_orders'` → `view: 'work-orders'` in `MobileNav.tsx`.

---

#### [F-12] BillingSettings Add-On buttons are non-functional
**Severity:** P3 — Dead UI (component is unreachable per F-03, but relevant if it gets wired up)  
**File:** `src/components/settings/BillingSettings.tsx` (lines ~320–334)

**Description:**  
The "Add-Ons" section renders `<button>+ Add</button>` buttons with no `onClick` handler. They appear interactive but do nothing.

**Remediation:**  
Either wire them to the Stripe customer portal / a checkout URL for the add-on price IDs, or show a "Coming soon" tooltip, or remove the section until it's implemented.

---

#### [F-13] Mobile layout `max-w-lg` clips wide views (FinancialDashboard, BillingSettings comparison table)
**Severity:** P3 — Mobile overflow  
**File:** `src/components/mobile/ResponsiveLayout.tsx` (line ~168)

**Description:**  
The mobile content area wraps children in `<div className="mx-auto max-w-lg">`. Views like `FinancialDashboard` (multi-column grid), `BillingSettings` competitor comparison table (7-column table), and `ReportsAnalytics` contain wide layouts with no mobile-specific overrides. The `max-w-lg` container causes horizontal scroll or layout breaking on these views.

**Remediation:**  
Give wide views a `overflow-x-auto` wrapper or replace multi-column grids with `grid-cols-1 sm:grid-cols-2` on small screens. Alternatively, make the mobile max-width conditional per view.

---

#### [F-14] SubscriptionView shows plan names that don't match between components (price inconsistency)
**Severity:** P3 — Trust / credibility  
**Files:** `src/components/crm/SubscriptionView.tsx` (line 17+), `src/components/settings/BillingSettings.tsx` (line 40+)

**Description:**  
`SubscriptionView` lists three plans: Starter ($49), Professional ($99), Enterprise ($199) — and omits the "Business" tier.  
`BillingSettings` lists four plans: Starter ($29), Pro ($59), Business ($99), Enterprise ($179) — different prices and different tier names.

If a user compares these two views, the prices and tiers are contradictory. The Stripe pricing table (embedded in both) is the source of truth, but the surrounding copy should be consistent.

**Remediation:**  
Decide on a single PLANS constant in a shared file (e.g., `src/lib/planConfig.ts`) and import it in both components. Verify prices match the live Stripe pricing table.

---

## Metrics

| Category | Status |
|---|---|
| Onboarding flow | ❌ Missing |
| Empty states (all main views) | ⚠️ Partial (ContactList/Pipeline/Dashboard weak) |
| Sidebar grouping | ❌ Flat / ungrouped |
| Mobile layout | ⚠️ Functional but 2 bugs (name hardcoded, Work Orders view ID) |
| Error states (API failures) | ⚠️ Toast on forms; silent fail on initial load |
| Trial banner copy button (urgency phase) | ❌ Missing (quick win) |
| BillingSettings reachability | ❌ Dead code — never rendered |
| Promo code at checkout | ❌ Not shown at the point of purchase |

---

## Prioritized Fix Order

1. **[F-02]** Add copy button to the urgency trial banner — 5 min, P1 conversion win
2. **[F-04]** Add LAUNCH50 reminder above pricing table in `SubscriptionView` — 10 min
3. **[F-03]** Resolve dead code: wire `BillingSettings` or remove `MainSettings` 
4. **[F-11]** Fix `work_orders` → `work-orders` in `MobileNav.tsx` — 1 min bug fix
5. **[F-05]** Add section labels to sidebar navigation
6. **[F-06]** Fix ContactList empty state to distinguish no-data vs. no-results
7. **[F-01]** Build a first-run onboarding checklist for new users
8. **[F-14]** Reconcile plan names/prices across components
9. **[F-09]** Surface load errors in the UI instead of silently showing empty data
10. **[F-08]** Add getting-started callout on Dashboard for fresh accounts
11. **[F-07]** Add CTA to PipelineBoard empty columns
12. **[F-10]** Replace hardcoded "TrussCTR" in mobile header
13. **[F-12]** Fix Add-On buttons or remove them
14. **[F-13]** Fix mobile layout overflow for wide views
