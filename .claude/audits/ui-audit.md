---
agent: ui-auditor
status: fail
findings: 24
---

# TrussCTR UI/UX Audit — March 8, 2026

## Summary

The app is functionally solid but has several UX friction points that would confuse or frustrate new customers. The most critical issues are: **no onboarding flow for first-time users**, **an overwhelming 23-item sidebar**, a **broken trial urgency banner with no copy button**, a **misleading "Save" button that looks like Send**, and **hardcoded GitHub Pages paths on the production domain**. Twelve of the 24 findings are HIGH severity.

---

## Findings

### 1 — AUTH PAGE: Email field missing a visible label
**Severity:** HIGH  
**File:** [src/components/crm/AuthPage.tsx](../../../src/components/crm/AuthPage.tsx#L338)

Every other form field has an explicit `<label>` element (First Name, Last Name, Company, Password, Confirm Password), but the email `<input>` has no `<label>` — only a placeholder and a `Mail` icon. This breaks screen-reader accessibility and is inconsistent with all other fields.

**Fix:** Add `<label className="block text-sm font-medium text-gray-700 mb-1">Email</label>` above the email input, matching the pattern used for other fields.

---

### 2 — AUTH PAGE: Promo badge on signup doesn't show the promo code
**Severity:** HIGH  
**File:** [src/components/crm/AuthPage.tsx](../../../src/components/crm/AuthPage.tsx#L271)

The signup header shows a promotional badge: "Subscribe within your trial — get 50% off your first 3 months." It does not include the promo code `LAUNCH50`, meaning the user has no idea what code to enter at checkout. The code only appears inside the app's trial banner after they sign up.

**Fix:** Add the code to the badge inline: `Use code LAUNCH50 at checkout — 50% off your first 3 months.` Include a small copy button or highlight the code in `font-mono` style so it's obviously a code, not body text.

---

### 3 — AUTH PAGE: No password strength indicator
**Severity:** MEDIUM  
**File:** [src/components/crm/AuthPage.tsx](../../../src/components/crm/AuthPage.tsx#L130)

The password field only enforces a minimum of 6 characters via a client-side check after the form submits. There is no real-time strength indicator. Industry best practice is 8+ characters with at least one number or special character, and a visual strength meter while typing.

**Fix:** Add a real-time `zxcvbn`-based or simple regex-based strength meter below the password field during signup.

---

### 4 — AUTH PAGE: "Welcome back" is shown before first login mode even starts
**Severity:** LOW  
**File:** [src/components/crm/AuthPage.tsx](../../../src/components/crm/AuthPage.tsx#L261)

The login mode subtitle is `"Sign in to access your CRM"` which is neutral. The heading "Welcome back" could technically apply to brand new users who just verified their email. Once inside the app the problem is worse (see Finding #18), but the login form subtitle is fine — this is a minor tone issue.

**Remediation:** No change needed here; onboarding fix (Finding #18) handles this.

---

### 5 — AUTH PAGE: Role selector on invite flow is shown disabled
**Severity:** MEDIUM  
**File:** [src/components/crm/AuthPage.tsx](../../../src/components/crm/AuthPage.tsx#L465)

When accepting an invite, a `<select>` for "Role" is rendered but is `disabled`. Showing a disabled, non-interactive control without explanation causes confusion — users may try to click it and wonder why it doesn't work.

**Fix:** Either hide the role field entirely when `inviteToken` is set, or show it as read-only text with a note: "Role assigned by your team admin."

---

### 6 — AUTH PAGE: Legal links use hardcoded GitHub Pages paths
**Severity:** HIGH  
**File:** [src/components/crm/AuthPage.tsx](../../../src/components/crm/AuthPage.tsx#L545)

The Terms of Service, EULA, and Privacy Policy links point to `/crm-kanban-integrate/terms`, `/crm-kanban-integrate/eula`, `/crm-kanban-integrate/privacy`. On Vercel production (e.g., `app.trussctr.com`), these paths resolve to 404s. The same issue exists in the Sidebar footer.

**Fix:** Use relative paths (`/terms`, `/privacy`, `/eula`) and configure proper routes on both GitHub Pages and Vercel, or use environment-relative base URL from `import.meta.env.BASE_URL`.

---

### 7 — TRIAL BANNER: Urgency banner (last 7 days) has NO copy button for LAUNCH50
**Severity:** HIGH  
**File:** [src/components/AppLayout.tsx](../../../src/components/AppLayout.tsx#L374)

The early trial banner (days 1-7) has a clickable copy button for `LAUNCH50`. The urgency banner (days 8-14, when conversion urgency peaks) shows the code as plain `<strong className="font-mono">` text with no copy button. Users must manually select and copy it.

**Fix:** Add the same copy button pattern used in `showDiscount` to the `showUrgency` banner:
```tsx
<button onClick={handleCopy} className="...">
  {copied ? '✓ Copied!' : LAUNCH_PROMO_CODE}
</button>
```

---

### 8 — TRIAL BANNER: Dismissed state is not persisted to localStorage
**Severity:** MEDIUM  
**File:** [src/components/AppLayout.tsx](../../../src/components/AppLayout.tsx#L322)

The `dismissed` state is component-local (`useState(false)`). Refreshing the page or navigating between views resets it, causing the banner to reappear. Users who have read and dismissed the banner will see it on every page load, leading to banner fatigue.

**Fix:** Persist dismiss to `localStorage`:
```tsx
const [dismissed, setDismissed] = useState(
  () => localStorage.getItem('trial_banner_dismissed') === '1'
);
// in the dismiss handler:
localStorage.setItem('trial_banner_dismissed', '1');
setDismissed(true);
```

---

### 9 — TRIAL BANNER: Early trial copy button lacks a clipboard icon
**Severity:** LOW  
**File:** [src/components/AppLayout.tsx](../../../src/components/AppLayout.tsx#L355)

The `LAUNCH50` copy button displays the code text as the button label (no `Copy` or clipboard icon). First-time users may not realize this is a button — it looks like a styled code chip. The ✓ feedback after clicking is good, but discoverability before clicking is weak.

**Fix:** Add a `Copy` or clipboard icon to the left of the code text: `<ClipboardCopy size={12} />` + `LAUNCH50`.

---

### 10 — TRIAL BANNER: `BILLING_SETTINGS_VIEW` constant defined but never used
**Severity:** MEDIUM  
**File:** [src/components/AppLayout.tsx](../../../src/components/AppLayout.tsx#L317)

`const BILLING_SETTINGS_VIEW = 'billing'` is declared but never referenced in the banner. The banner copy says "Enter at checkout → Billing" but there is no navigation link. Users are told to go to Billing but there's no button to take them there.

**Fix:** Use the constant to add a navigation link:
```tsx
<button onClick={() => dispatch({ type: 'SET_VIEW', payload: BILLING_SETTINGS_VIEW })}>
  Go to Billing →
</button>
```
Or remove the orphaned constant if the inline Stripe table is the intended path.

---

### 11 — COMMUNICATION HUB: "Save" button has Send icon (misleading label)
**Severity:** HIGH  
**File:** [src/components/crm/CommunicationHub.tsx](../../../src/components/crm/CommunicationHub.tsx#L749)

The compose modal footer button renders:
```tsx
<Send size={16} />
Save
```
A `Send` icon with a "Save" label is contradictory. For email and SMS types, users expect an action that actually sends the message; for notes/calls they expect a log/save. Using "Save" for all types plus a Send icon erodes trust ("Is this actually sending an email? Or just logging it?").

**Fix:** Use contextual labels:
- note/call → `<Clipboard />` + "Log"
- email/sms → `<Send />` + "Send" (or clarify this is a CRM log with a tooltip)

---

### 12 — COMMUNICATION HUB: AI Draft button disappears silently when switching types
**Severity:** MEDIUM  
**File:** [src/components/crm/CommunicationHub.tsx](../../../src/components/crm/CommunicationHub.tsx#L724)

The AI Draft button is conditionally rendered `{composeType === 'email' && ...}`. Switching from "email" to "note" makes it vanish with no explanation. Users who discover AI drafting on email and then switch to SMS will wonder why AI is no longer available.

**Fix:** Show the AI Draft button for all types but disable it with a tooltip for non-email types: "AI drafting is available for email only."

---

### 13 — COMMUNICATION HUB: Reply box is a single-line `<input>`, not a `<textarea>`
**Severity:** HIGH  
**File:** [src/components/crm/CommunicationHub.tsx](../../../src/components/crm/CommunicationHub.tsx#L570)

The reply field in the right panel (`placeholder="Type a reply..."`) is an `<input type="text">`. This limits replies to a single line. For emails or longer notes, this is completely inadequate and creates a jarring experience (text overflows horizontally, no line breaks).

**Fix:** Replace with `<textarea rows={3} className="... resize-none" />` and update the `onKeyDown` to `Shift+Enter` for newline, plain `Enter` to send.

---

### 14 — COMMUNICATION HUB: Empty state copy is wrong for brand new users
**Severity:** HIGH  
**File:** [src/components/crm/CommunicationHub.tsx](../../../src/components/crm/CommunicationHub.tsx#L450)

When there are zero communications, the empty state reads: "No communications found — Try adjusting your search or filter." A brand new user has not added any search or filter. This message implies they did something wrong.

**Fix:** Detect whether there are *any* contacts/communications at all vs a filtered result:
```tsx
{filteredCommunications.length === 0 && (
  state.contacts.length === 0 
    ? <EmptyState title="No communications yet" cta="Add your first contact to start logging interactions" />
    : searchQuery || filter !== 'all'
      ? <EmptyState title="No results" body="Try adjusting your search or filter" />
      : <EmptyState title="No communications yet" body="Use Compose to log your first interaction" />
)}
```

---

### 15 — COMMUNICATION HUB: Template card click area vs button mismatch
**Severity:** LOW  
**File:** [src/components/crm/CommunicationHub.tsx](../../../src/components/crm/CommunicationHub.tsx#L607)

Each template card has `cursor-pointer` on the outer `<div>` but clicking the card body does nothing — only the "Use Template" button acts. This creates a false affordance.

**Fix:** Either add an `onClick` handler to the card `<div>` to call `handleUseTemplate(template)`, or remove `cursor-pointer` from the card wrapper.

---

### 16 — SUBSCRIPTION VIEW: Stripe pricing table has no loading or error state
**Severity:** HIGH  
**File:** [src/components/crm/SubscriptionView.tsx](../../../src/components/crm/SubscriptionView.tsx#L177)

`<stripe-pricing-table>` is a web component that loads asynchronously. If Stripe JS hasn't loaded, the user sees a blank white box with no indication of loading, error, or what to do. This is most visible to users opening DevTools or on slow connections.

**Fix:** Wrap the Stripe table in a container with a loading placeholder and a `<noscript>` / `window.onerror` fallback linking to direct plan URLs.

---

### 17 — SUBSCRIPTION VIEW: Usage meters hidden during free trial
**Severity:** MEDIUM  
**File:** [src/components/crm/SubscriptionView.tsx](../../../src/components/crm/SubscriptionView.tsx#L131)

`{plan !== 'trial' && (<usage stats>)}` hides the contact/user usage meters during the trial. Trial users can't see their current usage vs plan limits. This is a missed conversion opportunity — users who can see they're approaching limits have strong motivation to upgrade.

**Fix:** Show usage meters during trial based on the plan the user is likely to need (e.g., the "Starter" limits), with messaging like "You're using X contacts — the Starter plan includes 100."

---

### 18 — FIRST-TIME USER: No onboarding flow or empty-state guidance on Dashboard
**Severity:** CRITICAL  
**File:** [src/components/crm/Dashboard.tsx](../../../src/components/crm/Dashboard.tsx#L87)

After first login, the Dashboard shows "Welcome back, John!" with all metric cards showing 0 ($0 revenue, 0 contacts, 0 appointments) and empty lists. There is no "Get Started" card, setup checklist, empty state illustrations, or CTA to add a first contact. A first-time user has no idea what to do.

**Fix:** Add a first-time welcome experience:
1. Detect `state.contacts.length === 0 && state.isInitialized` as the "empty account" state.
2. Render a "Get Started" checklist card:
   - Add your first contact
   - Set up your pipeline stages
   - Invite a team member
   - Upload your company logo
3. Change greeting to "Welcome to TrussCTR, John!" on first login (can track via `localStorage` flag set on first render after INITIALIZE_DATA with zero contacts).

---

### 19 — FIRST-TIME USER: "Welcome back" greeting on first-ever login
**Severity:** MEDIUM  
**File:** [src/components/crm/Dashboard.tsx](../../../src/components/crm/Dashboard.tsx#L87)

`"Welcome back, {firstName}!"` is shown to every user on every load, including someone who just created their account. "Welcome back" implies a returning user. For a brand-new customer this feels robotic and incorrect.

**Fix:** Use `"Welcome, {firstName}!"` (dropping "back") as default, or detect first login via `localStorage` and show "Welcome to TrussCTR, {firstName}!" on first visit, switching to "Welcome back" on subsequent logins.

---

### 20 — SIDEBAR: 23 navigation items with no grouping or visual hierarchy
**Severity:** CRITICAL  
**File:** [src/components/crm/Sidebar.tsx](../../../src/components/crm/Sidebar.tsx#L37)

The sidebar renders 23 navigation items in a single, flat list with no section headings, dividers, or grouping. For a new user this is cognitively overwhelming and offers no progressive disclosure. There's no way to tell which items are "primary" vs "advanced."

**Fix:** Group items into sections with slim dividers and optional section labels:
- **Core**: Dashboard, Pipeline, Contacts, Communications, Calendar
- **Operations**: Projects, Work Orders, Crew Schedule, Equipment, Material Orders, Estimates
- **Finance**: Financial, Expenses, Documents, Suppliers
- **Insurance**: Insurance, Supplements
- **Admin**: Reports, Team, Automations, AI Assistant, Settings

---

### 21 — SIDEBAR: "Supplements" uses a warning/error icon (`AlertCircle`)
**Severity:** MEDIUM  
**File:** [src/components/crm/Sidebar.tsx](../../../src/components/crm/Sidebar.tsx#L57)

`{ id: 'supplement-tracking', label: 'Supplements', icon: <AlertCircle size={20} /> }` — `AlertCircle` is the standard icon for errors, warnings, or alerts. Using it for a "Supplement Tracking" feature creates immediate confusion ("Is there an alert? Did something go wrong?").

**Fix:** Replace with a more semantically appropriate icon such as `ClipboardList`, `FilePlus2`, or `PlusCircle`.

---

### 22 — SIDEBAR: `Documents` and `Estimates` share identical `FileText` icons
**Severity:** LOW  
**File:** [src/components/crm/Sidebar.tsx](../../../src/components/crm/Sidebar.tsx#L44)

Both `{ id: 'documents', label: 'Documents', icon: <FileText size={20} /> }` and `{ id: 'estimates', label: 'Estimates', icon: <FileText size={20} /> }` use the same icon. In the collapsed sidebar, these two items are visually indistinguishable.

**Fix:** Use `FileText` for Documents and `FileCheck` or `ClipboardList` for Estimates.

---

### 23 — SIDEBAR: Sign-out button has no visible label
**Severity:** MEDIUM  
**File:** [src/components/crm/Sidebar.tsx](../../../src/components/crm/Sidebar.tsx#L349)

The sign-out action is a 16px `LogOut` icon button with only a `title="Sign out"` tooltip. On touch devices, there are no tooltips, making this button undiscoverable. New users may not recognize the `LogOut` icon.

**Fix:** When sidebar is expanded, show the label alongside the icon: `<LogOut size={16} />` + `"Sign out"` (even a short text beside the avatar footer).

---

### 24 — SIDEBAR: Legal links hardcoded to GitHub Pages base path
**Severity:** HIGH  
**File:** [src/components/crm/Sidebar.tsx](../../../src/components/crm/Sidebar.tsx#L315)

Same issue as Finding #6. `href="/crm-kanban-integrate/terms"` etc. will 404 on Vercel production.

**Fix:** Same as Finding #6 — use `import.meta.env.BASE_URL` or environment-relative routing.

---

## Metrics

| Severity  | Count |
|-----------|-------|
| CRITICAL  | 2     |
| HIGH      | 10    |
| MEDIUM    | 9     |
| LOW       | 3     |
| **Total** | **24** |

## Top Priorities for New-Customer Experience

1. **[CRITICAL] Add first-time onboarding flow** (Finding #18) — empty dashboard with zero prompts is the #1 cause of trial churn.
2. **[CRITICAL] Sidebar grouping** (Finding #20) — 23 flat items overwhelms new users before they've done anything.
3. **[HIGH] Hardcoded GitHub Pages paths** (Findings #6, #24) — Terms/Privacy 404 on production; legal risk.
4. **[HIGH] Urgency banner missing copy button** (Finding #7) — peak conversion window (days 8-14) has broken UX.
5. **[HIGH] Misleading Save/Send button** (Finding #11) — confuses users about whether emails are actually sent.
6. **[HIGH] Reply box is a single-line input** (Finding #13) — prevents composing any message longer than one line.
7. **[HIGH] Empty state copy is wrong** (Finding #14) — new users told to adjust a filter they never set.
8. **[HIGH] Stripe table has no loading state** (Finding #16) — billing page appears broken on slow connections.
