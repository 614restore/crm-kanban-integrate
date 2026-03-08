---
agent: bug-auditor
status: fail
findings: 4
---

# Bug Audit — crm-kanban-integrate

**Date:** 2026-03-08  
**Scope:** Runtime bugs, logic errors, broken UI interactions

---

## Summary

4 confirmed bugs found. No false positives or style issues included. All loading-state handlers reviewed — they universally use `finally` blocks and are correct. The documents tab in `ContactDetail.tsx` closes both wrapper `div`s correctly. The `AIConfigDialog`, `ChangeOrderModal`, `SignEstimate`, `Photos`, and `PermitTracker` handlers all properly reset loading state.

---

## Findings

---

### BUG-01 · HIGH · Logic Error

**File:** [src/components/crm/Sidebar.tsx](../../src/components/crm/Sidebar.tsx#L206)  
**Description:** The Notifications button in the sidebar (which shows a `<Bell>` icon, a "Notifications" label, and an unread-count badge) calls `handleNavClick('calendar')`, navigating the user to the Calendar view instead of opening the notification panel. The `title` attribute even says `'Notifications'`, confirming this is a copy-paste error from the Calendar nav item.

```tsx
// Sidebar.tsx ~L206 — WRONG target
<button
  onClick={() => handleNavClick('calendar')}   // ← should NOT be 'calendar'
  title={sidebarCollapsed ? 'Notifications' : undefined}
>
  <Bell size={20} />
  ...
  <span className="font-medium">Notifications</span>
```

**Remediation:** The button should open the notification panel (e.g., toggle a `showNotifications` state, or navigate to a dedicated `'notifications'` view), not call `handleNavClick('calendar')`.

---

### BUG-02 · HIGH · Data Integrity / Silent Failure

**Files:**  
- [src/components/crm/AppointmentModal.tsx](../../src/components/crm/AppointmentModal.tsx#L285) (line 285 — @mention on update)  
- [src/components/crm/AppointmentModal.tsx](../../src/components/crm/AppointmentModal.tsx#L346) (line 346 — unassigned appointment)  
- [src/components/crm/AppointmentModal.tsx](../../src/components/crm/AppointmentModal.tsx#L378) (line 378 — @mention on create)

**Description:** All three `createNotification()` calls in `AppointmentModal.tsx` omit the `read` field. The `DbNotification` interface declares `read: boolean` (non-optional), and the `createNotification` DB insert passes the object directly to Supabase with no default. If the `notifications.read` column is `NOT NULL` without a `DEFAULT`, Supabase returns a constraint violation and all three notification types are silently dropped (the `catch { /* non-critical */ }` style swallows the error).

```ts
// All three call sites look like this — missing `read: false`
await db.createNotification({
  company_id: effectiveCompanyId,
  type: 'mention',
  title: 'You were tagged in an appointment',
  message: `...`,
  related_id: ...,
  related_type: 'appointment',
  // read: false  ← MISSING
});
```

Compare with the correctly-formed calls in `EagleViewPanel.tsx` and `HailTracePanel.tsx` which all include `read: false`.

**Remediation:** Add `read: false` to all three call sites in `AppointmentModal.tsx`.

---

### BUG-03 · MEDIUM · Architectural Disconnect — Notifications Bell Shows Stale / Incomplete Data

**File:** [src/components/crm/TopBar.tsx](../../src/components/crm/TopBar.tsx#L174)

**Description:** The bell icon in the header reads exclusively from `state.notifications` — the in-memory Redux-like CRM store. It never fetches from the database `notifications` table. Most `db.createNotification()` call sites only write to the DB and never follow up with a `dispatch({ type: 'ADD_NOTIFICATION', ... })` to the in-memory store:

| Call site | Creates DB record | Dispatches to store |
|---|---|---|
| `EagleViewPanel.tsx` (report ready) | ✅ | ❌ |
| `HailTracePanel.tsx` (hail event) | ✅ | ❌ |
| `ContactDetail.tsx` (hail event inline) | ✅ | ❌ |
| `AppointmentModal.tsx` (@mention, update) | ✅ | ❌ |
| `AppointmentModal.tsx` (@mention, create) | ✅ | ❌ |
| `AppointmentModal.tsx` (unassigned appt) | ✅ | ✅ (only one) |

Result: users who receive an EagleView report-ready notification, a hail alert, or an @mention will never see it in the bell icon. The bell only ever shows the unassigned-appointment type, and only for the current browser session.

**Remediation:** Either (a) fetch `db.getUnreadNotifications(companyId)` on load and poll/subscribe for changes, or (b) add `dispatch({ type: 'ADD_NOTIFICATION', payload: { ... } })` after every successful `createNotification()` call.

---

### BUG-04 · MEDIUM · Potential 500 / Silent Auth Failure in API Route

**File:** [api/quickbooks-sync.mjs](../../api/quickbooks-sync.mjs#L15)

**Description:** The `supabase` client is constructed at module-load time (top-level, outside the handler) using `process.env.SUPABASE_SERVICE_ROLE_KEY` with no guard. If that env var is missing, `createClient(url, undefined)` creates a client with an anonymous key of `undefined`. Every subsequent DB write during a sync (`supabase.from('companies').update(...)`) will silently fail with a PostgREST 401 (unauthh'd), not a 500. The handler never checks the client's validity before using it, so the caller only gets an opaque "sync failed" error with no indication that the key is missing.

```js
// api/quickbooks-sync.mjs L15-18 — created OUTSIDE handler, no key guard
const supabase = createClient(
  process.env.SUPABASE_URL || ...,
  process.env.SUPABASE_SERVICE_ROLE_KEY   // ← undefined if not set
);
```

Compare: `stripe-webhook.mjs` correctly guards `if (!stripeKey || !webhookSecret) return res.status(500)` before constructing the client.

**Remediation:** Move the `createClient` call inside the handler and add an explicit guard:
```js
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
const supabase = createClient(process.env.SUPABASE_URL, serviceKey);
```

---

## Items Verified Clean (No Bugs Found)

- **Loading state handlers**: All `setLoading` / `setSaving` / `setIsLoading` / `setSubmitting` calls in `EagleViewPanel`, `AIConfigDialog`, `AIApprovalPanel`, `IntegrationConfigDialog`, `PermitTracker`, `ChangeOrderModal`, `AIAssistant`, `SignEstimate`, `SignChangeOrder`, `Photos`, `UpdatePassword` all use `finally` blocks and correctly reset state.
- **ContactDetail.tsx documents tab**: `<div className="space-y-4">` (L1375) and inner `<div className="bg-white ...">` (L~1391) both close correctly. `isUploadingDocument` is also reset via `finally` block on all paths.
- **Broken nav links**: No `href="#"` or `href="javascript:void(0)"` found. All `onClick` handlers reference defined functions.
- **API routes for 500 errors**: `send-email.mjs`, `stripe-checkout.mjs`, `stripe-portal.mjs`, `stripe-webhook.mjs`, `sign-document.mjs` all guard their required env vars and return appropriate 400/500 responses before proceeding. `send-invite.mjs` re-exports `send-email.mjs` which is also guarded.
- **createNotification in EagleViewPanel / HailTracePanel / ContactDetail**: All include `read: false` and are correct.

---

## Metrics

| Severity | Count |
|---|---|
| High | 2 |
| Medium | 2 |
| Low | 0 |
| **Total** | **4** |
