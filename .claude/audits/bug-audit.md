---
agent: bug-auditor
status: fail
findings: 11
---

# Bug Audit — TrussCTR CRM

**Date:** 2026-03-08  
**Scope:** AppLayout.tsx, authContext.tsx, CommunicationHub.tsx, ai-draft.mjs, stripe-webhook.mjs, SubscriptionView.tsx  

---

## Summary

11 bugs found across the 7 files reviewed. One is **critical** (payments never activate subscriptions). Three are **high** severity (silent save failures, wrong-contact template injection, user stuck with no CRM data). The rest are medium/low but will confuse real customers.

---

## Findings

---

### BUG-01 — CRITICAL | stripe-webhook.mjs + companies table

**File:** `api/stripe-webhook.mjs` (all webhook handlers)  
**Severity:** 🔴 CRITICAL

#### Description
The Stripe webhook upserts/updates a `subscriptions` table, but the application reads subscription status exclusively from the `companies` table columns (`subscription_status`, `subscription_plan`, `trial_ends_at`). These are confirmed separate tables — the migration in `supabase-migrations/add-subscription-plans.sql` adds the fields directly to `companies`, and `db.getCompany()` queries `companies` directly (`supabase.from('companies').select('*')`).

After a customer successfully pays (checkout.session.completed, customer.subscription.updated), the webhook writes to `subscriptions` only. The `companies` row is never touched. The customer's app permanently shows `trialing` status: the trial banner never disappears, and any subscription gate would block them indefinitely.

#### Proof
```js
// stripe-webhook.mjs: checkout.session.completed
await supabase.from('subscriptions').upsert({ ... status: 'active' ... });
// ↑ writes subscriptions, NOT companies

// database.ts: getCompany()
supabase.from('companies').select('*').eq('id', companyId).single();
// ↑ reads companies — never sees the subscriptions row
```

#### Remediation
Either:
- **(A)** Update the webhook to also update `companies` using `stripe_customer_id` to look up the row:
  ```js
  // After subscriptions upsert, also update companies
  await supabase
    .from('companies')
    .update({ subscription_status: 'active', subscription_plan: planId, stripe_subscription_id: subscriptionId })
    .eq('stripe_customer_id', customerId);
  ```
- **(B)** Add a Supabase database trigger that syncs `subscriptions` → `companies` on update.

---

### BUG-02 — HIGH | stripe-webhook.mjs `trial_end` always null

**File:** `api/stripe-webhook.mjs` line ~72  
**Severity:** 🟠 HIGH

#### Description
In the `checkout.session.completed` handler:

```js
trial_end: session.subscription ? null : null,
```

This ternary always evaluates to `null`. The Stripe `checkout.session` object contains `subscription` (the subscription ID), not the actual subscription object, so `trial_end` from the subscription (if any) is never written. If the subscription has a trial period configured in Stripe, the `trial_ends_at` on the company record will never be set correctly.

#### Remediation
Fetch the subscription from Stripe to get the actual trial end date, or remove the dead field and handle `trial_ends_at` via a subsequent `customer.subscription.updated` event:
```js
// Remove the dead field or expand the session to get trial data
trial_ends_at: session.subscription
  ? (await stripe.subscriptions.retrieve(session.subscription)).trial_end
      ? new Date((await stripe.subscriptions.retrieve(session.subscription)).trial_end * 1000).toISOString()
      : null
  : null,
```
Or more cleanly: let `customer.subscription.updated` (which fires right after) handle trial dates, and skip trial_end in the checkout handler.

---

### BUG-03 — HIGH | authContext.tsx — user stuck with null profile after setup failure

**File:** `src/lib/authContext.tsx` lines ~98–115 (`ensureUserSetup`)  
**Severity:** 🟠 HIGH

#### Description
When `setupNewUser` reports success but the retry still finds no `company_id`:

```ts
const retryProfile = await fetchProfile(userId);
if (!retryProfile?.company_id) {
  console.error('❌ Company setup failed even after retry');
}
return retryProfile;  // ← returns null or profile-without-company_id unconditionally
```

`loadProfile` in the effect receives this null/no-company_id profile and calls `setProfile(profileData)`. Now the app has a valid session (`user` is non-null) but `profile.company_id` is undefined. `loadData` detects `!profile?.company_id` and, once `authLoading` is false, dispatches `SET_LOADING: false` and returns. The user sees an empty CRM shell with no data and no error message — and no automatic recovery path. On refresh the same cycle repeats.

**Affected flow:** New user first sign-up when Supabase is slow or company creation fails.

#### Remediation
Show a specific error state when `profile` exists but `profile.company_id` is null, with a "Retry setup" button or a toast with instructions to contact support.

---

### BUG-04 — HIGH | CommunicationHub.tsx — `handleUseTemplate` injects variables for wrong contact

**File:** `src/components/crm/CommunicationHub.tsx` (inside `handleUseTemplate`)  
**Severity:** 🟠 HIGH

#### Description
```js
const contact = selectedCommData?.contact || state.contacts[0];
```
When the user opens Templates from the header (without selecting a communication first), `selectedCommData` is null and `state.contacts[0]` silently becomes the template contact. The template is populated with a **random customer's** name, claim number, deductible, and adjuster name. The user could unknowingly send a mis-addressed email with another customer's private insurance data.

#### Remediation
Remove the silent fallback and require explicit contact selection:
```js
if (!selectedCommData?.contact) {
  toast.error('Select a communication first to use a template');
  return;
}
const contact = selectedCommData.contact;
```

---

### BUG-05 — HIGH | CommunicationHub.tsx — `handleSaveCompose` silently does nothing without contact

**File:** `src/components/crm/CommunicationHub.tsx` (`handleSaveCompose`)  
**Severity:** 🟠 HIGH

#### Description
```js
const handleSaveCompose = async () => {
  if (!composeText.trim() || !composeContactId) return;  // ← silent no-op
  ...
};
```
If a user types a message but hasn't selected a contact, clicking Save closes nothing, shows no error, and loses no work (modal stays open). But there is no toast or validation hint. Users clicking Save without a contact selected will be confused and may click repeatedly or assume the app is broken.

#### Remediation
Add a toast and early return with user feedback:
```js
if (!composeContactId) {
  toast.error('Please select a contact before saving');
  return;
}
if (!composeText.trim()) return;
```

---

### BUG-06 — MEDIUM | AppLayout.tsx — TrialBanner copy button swallows clipboard errors

**File:** `src/components/AppLayout.tsx` (`handleCopy` inside `TrialBanner`)  
**Severity:** 🟡 MEDIUM

#### Description
```js
const handleCopy = () => {
  navigator.clipboard.writeText(LAUNCH_PROMO_CODE).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  });
  // ← no .catch()
};
```
`navigator.clipboard` is only available in secure contexts (HTTPS). In development (HTTP) or in browsers with strict clipboard policies, the Promise rejects silently. The button appears to do nothing. Users lose trust in the promo code feature.

#### Remediation
```js
navigator.clipboard.writeText(LAUNCH_PROMO_CODE).then(() => {
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
}).catch(() => {
  // Fallback for non-secure context
  toast.error('Copy failed — please select the code manually: ' + LAUNCH_PROMO_CODE);
});
```

---

### BUG-07 — MEDIUM | CommunicationHub.tsx — AI Draft produces malformed text when subject is empty

**File:** `src/components/crm/CommunicationHub.tsx` (`handleAIDraft`)  
**Severity:** 🟡 MEDIUM

#### Description
```js
const draft = data.body ? `Subject: ${data.subject}\n\n${data.body}` : data.body;
setComposeText(draft || data.body || '');
```
Two issues:
1. When `data.subject` is an empty string (valid OpenAI response), the compose field starts with `"Subject: \n\n..."` — a visible formatting artifact.
2. The fallback chain `draft || data.body || ''`: if `data.body` is undefined (API returns `{subject: "...", body: undefined}`), `draft = undefined`, then `setComposeText(undefined)` is evaluated as `''`. The compose field is blank with no indication of failure, even though `res.ok` was true.

#### Remediation
```js
if (data.subject && data.body) {
  setComposeText(`Subject: ${data.subject}\n\n${data.body}`);
} else if (data.body) {
  setComposeText(data.body);
} else {
  toast.error('AI returned an empty draft — please try again');
}
```

---

### BUG-08 — MEDIUM | CommunicationHub.tsx — Contact avatar crashes on null firstName/lastName

**File:** `src/components/crm/CommunicationHub.tsx` (right panel contact card)  
**Severity:** 🟡 MEDIUM

#### Description
```jsx
{selectedCommData.contact.firstName[0]}
{selectedCommData.contact.lastName[0]}
```
`dbContactToAppContact` maps `firstName: dbContact.first_name` with no null fallback. If the database row has a null `first_name` (valid for legacy records or data imported without names), then `null[0]` evaluates to `undefined`, rendering as blank. While React doesn't crash on `undefined`, this exposes empty initials with no avatar. Furthermore, if this pattern were ever used in a context that calls `.toUpperCase()` (e.g., future refactor), it would throw `TypeError: Cannot read properties of null`.

The `buildFallbackAvatar` is never called for the contact card avatar — only for team members.

#### Remediation
In `dbContactToAppContact`:
```js
firstName: dbContact.first_name || '',
lastName: dbContact.last_name || '',
```
And in the JSX:
```jsx
{(selectedCommData.contact.firstName?.[0] || '?').toUpperCase()}
{(selectedCommData.contact.lastName?.[0] || '').toUpperCase()}
```

---

### BUG-09 — LOW | SubscriptionView.tsx — Manage Billing opens for trial users with no Stripe account

**File:** `src/components/crm/SubscriptionView.tsx` (`handleManageBilling`)  
**Severity:** 🟢 LOW

#### Description
The "Manage Billing" button opens the hardcoded Stripe customer portal URL unconditionally. Trial users who have never paid have no Stripe customer record. The Stripe portal will show an error page ("no customer found" or ask for email). There's no guard on `company.stripe_customer_id` before showing the button.

#### Remediation
```jsx
{company?.stripe_customer_id && (
  <button onClick={handleManageBilling}>Manage Billing</button>
)}
```
Or if always shown, add a check inside `handleManageBilling`:
```js
if (!company?.stripe_customer_id) {
  toast.info('Start a subscription first to manage billing');
  return;
}
```

---

### BUG-10 — LOW | SubscriptionView.tsx — `stripe-pricing-table` gets empty customer-email

**File:** `src/components/crm/SubscriptionView.tsx`  
**Severity:** 🟢 LOW

#### Description
```jsx
customer-email={profile?.email ?? ''}
```
While `AuthProvider` is always wrapping this component, `profile` can be null during the brief window between session load and profile fetch. When `profile` is null, `customer-email=""` is passed to the Stripe pricing table. Stripe may attempt to look up an empty-string email, potentially causing a poor UX (pre-fill fails, or Stripe throws a console warning).

#### Remediation
Conditionally render the pricing table only after profile is available:
```jsx
{profile?.email && (
  <stripe-pricing-table
    ...
    customer-email={profile.email}
  />
)}
```

---

### BUG-11 — LOW | AppLayout.tsx — `BILLING_SETTINGS_VIEW` is defined but never used

**File:** `src/components/AppLayout.tsx` (`TrialBanner`)  
**Severity:** 🟢 LOW (dead code / missed feature)

#### Description
```js
const BILLING_SETTINGS_VIEW = 'billing';
```
This constant is defined but never referenced. The trial banner was presumably intended to include a "Go to Billing" link that redirects to the billing/subscription view, but the link was not implemented. Currently the banner shows a promo code with no direct CTA to subscribe. Users in the urgency phase (≤7 days left) have no one-click path to the billing screen.

#### Remediation
Add a link/button in both banner variants:
```jsx
<button
  onClick={() => dispatch({ type: 'SET_VIEW', payload: BILLING_SETTINGS_VIEW })}
  className="underline font-medium hover:no-underline"
>
  Subscribe now →
</button>
```

---

## Metrics

| Severity | Count |
|----------|-------|
| 🔴 Critical | 1 |
| 🟠 High | 4 |
| 🟡 Medium | 3 |
| 🟢 Low | 3 |
| **Total** | **11** |

| Category | Bugs |
|----------|------|
| Payments / Billing | 3 (BUG-01, BUG-02, BUG-09) |
| Auth / Session | 1 (BUG-03) |
| Data correctness | 2 (BUG-04, BUG-08) |
| UX / Silent failures | 3 (BUG-05, BUG-06, BUG-11) |
| AI feature | 1 (BUG-07) |
| Rendering | 1 (BUG-10) |

## Priority Fix Order

1. **BUG-01** — Fix immediately. No customer can activate a paid subscription without this fix.
2. **BUG-04** — Fix immediately. Potential data leak (one customer's insurance info shown in another's template).
3. **BUG-03** — Fix before launch. New users stuck in empty CRM on signup failure.
4. **BUG-05** — Fix before launch. Core compose workflow is confusing.
5. **BUG-02** — Fix before launch. Trial end dates are silently lost.
6. **BUG-06, BUG-07, BUG-08** — Fix in next sprint.
7. **BUG-09, BUG-10, BUG-11** — Fix before v1.1.
