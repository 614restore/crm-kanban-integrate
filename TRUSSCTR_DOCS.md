# TrussCTR — Complete Reference Documentation

> Last updated: March 2026  
> Covers: Web App (`crm-kanban-integrate`) + Mobile App (`TrussCTR-Mobile-1.0`)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Supabase Setup](#supabase-setup)
4. [Environment Variables](#environment-variables)
5. [Web App — Feature Status](#web-app--feature-status)
6. [Mobile App — Feature Status](#mobile-app--feature-status)
7. [Session & Auth Behavior](#session--auth-behavior)
8. [Subscription & Billing](#subscription--billing)
9. [Deployment Checklists](#deployment-checklists)
10. [Known Limitations (v1.0)](#known-limitations-v10)

---

## System Overview

TrussCTR is a CRM and job management platform for roofing contractors. It consists of:

| App | Stack | Deployed At |
|-----|-------|-------------|
| **Web App** | React 18 + TypeScript + Vite + Tailwind + shadcn/ui | Vercel (primary) + GitHub Pages (backup) |
| **Mobile App** | Capacitor + React 18 + TypeScript + Vite + Tailwind | iOS App Store (Xcode build) |
| **Backend** | Supabase (PostgreSQL + Auth + Realtime + Storage) | Supabase hosted |

Both apps share the same Supabase project. All user and company data live in Supabase.

---

## Architecture

### Web App

```
src/
├── components/
│   ├── AppLayout.tsx        ← Main shell: auth gate, data loading, realtime
│   ├── crm/                 ← All feature views (43 components)
│   │   ├── AuthPage.tsx     ← Login / signup / password reset UI
│   │   ├── Dashboard.tsx    ← KPI metrics, charts, activity feed
│   │   ├── ContactList.tsx  ← Contact search, filter, quick-add
│   │   ├── ContactDetail.tsx← Full contact view with tabs
│   │   ├── PipelineBoard.tsx← Drag-and-drop Kanban
│   │   ├── SettingsView.tsx ← 8-tab settings (company, profile, billing, etc.)
│   │   └── ... (38 more)
│   ├── settings/            ← Settings sub-components
│   └── mobile/              ← Responsive layout adapter
├── lib/
│   ├── authContext.tsx      ← Supabase auth + profile loading + demo mode
│   ├── supabase.ts          ← Supabase client (PKCE, auto-refresh, demo fallback)
│   ├── database.ts          ← All DB read/write operations (~1,800 lines)
│   ├── crmStore.ts          ← Redux-like global state + helper hooks
│   ├── crmData.ts           ← Type definitions + default/fallback data
│   ├── permissions/         ← Role-based permission system
│   └── integrations/        ← Stripe, QuickBooks, Twilio, EagleView, AI, Weather
├── pages/
│   ├── Index.tsx            ← Entry point + checkout success banner
│   ├── UpdatePassword.tsx   ← Password reset landing page
│   ├── SignEstimate.tsx      ← Public estimate signing (no auth)
│   ├── SignDocument.tsx      ← Public document signing (no auth)
│   ├── SignChangeOrder.tsx   ← Public change order signing (no auth)
│   ├── Photos.tsx           ← Public photo gallery (job photos)
│   ├── EULA.tsx             ← End User License Agreement
│   ├── TermsOfService.tsx   ← Terms of Service
│   └── PrivacyPolicy.tsx    ← Privacy Policy
└── contexts/
    └── AppContext.tsx        ← Minimal app-level context (sidebar state)
```

### Key Patterns

**Data Loading:** `AppLayout.tsx` fetches all company data on mount via `Promise.all` with 7-second per-query timeouts. If any query times out, it falls back to empty state so the app never hangs.

**Realtime:** Supabase channel subscriptions update contacts/appointments/invoices/etc. in real time. If websocket fails, falls back to 20-second polling. Disabled on GitHub Pages (noisy errors).

**Subscription Gate:** If `company.subscription_status` is `canceled` or `past_due`, or trial has expired, the user sees a paywall screen.

**Session Dormancy:** Three-part fix in `authContext.tsx`:
  1. `TOKEN_REFRESHED` event re-fetches profile if null
  2. `visibilitychange` listener re-fetches profile on tab return
  3. Safety-net `useEffect` catches any remaining edge cases after 1.5s

**Lazy Loading:** All 22 CRM views are `lazy()`-imported with `<Suspense>` wrappers for fast initial load.

### Mobile App

```
src/
├── context/
│   └── AuthContext.tsx      ← Same 3-part dormancy fix as web
├── pages/
│   ├── Dashboard.tsx        ← Summary cards + quick actions
│   ├── Contacts.tsx         ← Contact list with search
│   ├── More.tsx             ← Profile, settings, subscription modal
│   ├── Notifications.tsx    ← Realtime notifications + push permission
│   └── Settings.tsx         ← Functional toggles, Change Password, nav links
└── ...
```

---

## Supabase Setup

### Core Tables (All Required)

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles linked to `auth.users` |
| `companies` | Company data, subscription status, trial dates |
| `contacts` | CRM contacts / leads |
| `appointments` | Scheduled inspections and jobs |
| `invoices` + `invoice_items` | Billing and payment tracking |
| `communications` | Call/email/SMS log |
| `kanban_boards` + `kanban_columns` | Pipeline board configuration |
| `lead_sources` | Custom lead source definitions |
| `automations` | Automation rule definitions |
| `documents` | File attachment metadata |

### Additional Tables (Apply Migrations)

> **Important:** Run both files below in Supabase's SQL Editor before going live.

#### Migration 1: Suppliers, Estimates, Projects, Work Orders, Material Orders

```
supabase-migrations/add-suppliers-orders-estimates.sql
```

Creates: `suppliers`, `estimates`, `estimate_items`, `projects`, `work_orders`, `material_orders`, `material_order_items`

#### Migration 2: AI Assistant Config

```
supabase-migrations/ai-configuration.sql
```

Creates: `ai_configurations`, `ai_access_approvals`

#### Migration 3: RLS (Row Level Security)

```
supabase-migrations/001_enable_rls.sql
```

Enables and configures RLS on all tables so each company only sees its own data.

**To apply any migration:**  
Supabase Dashboard → SQL Editor → New Query → paste file contents → Run

### RLS Policy Pattern

All tables use `company_id` for multi-tenant isolation:

```sql
-- Example: users can only see contacts from their own company
CREATE POLICY "contacts_company_isolation" ON contacts
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
```

---

## Environment Variables

### Web App (Vercel)

Set these in Vercel Dashboard → Project → Settings → Environment Variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | ✅ Yes | Your Supabase project URL (`https://xxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | ✅ Yes | Your Supabase anon/public key |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Recommended | Stripe publishable key for billing/checkout |
| `VITE_DEMO_MODE` | Optional | Set to `true` to force demo mode (no Supabase needed) |
| `VITE_HASH_ROUTING` | Optional | Set to `true` for GitHub Pages (hash-based routing) |
| `VITE_DISABLE_REALTIME` | Optional | Set to `true` to disable Supabase realtime |

> **Note:** If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are missing or contain placeholder values, the app automatically enters **Demo Mode** — users see a blue "Demo Mode Active" banner and can't connect to the real database.

### Mobile App (`.env` file in project root)

Copy `.env.example` to `.env` and fill in:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-api-key
APP_URL=https://your-app-url.com
```

### GitHub Actions (Mobile CI/CD)

Set these secrets in GitHub → Repository → Settings → Secrets and variables → Actions:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`

---

## Web App — Feature Status

### ✅ Fully Complete

| Feature | Notes |
|---------|-------|
| Authentication | Sign in, sign up, password reset, invite links, PKCE flow |
| Session management | Dormancy recovery, token refresh, visibility-change recovery |
| Dashboard | KPIs, revenue charts, pipeline summary, activity feed |
| Contact Management | Full CRUD, quick-add wizard, bulk import, search/filter |
| Pipeline / Kanban | Drag-and-drop, custom stages, per-board visibility |
| Calendar & Appointments | Month/week/day views, create/edit/delete, contact linking |
| Invoicing | Line items, tax, status tracking, payment dates |
| Financial Dashboard | Revenue, deposits, outstanding invoices, estimate totals |
| Team Management | Roles, permissions, commission rates |
| Communication Hub | Call/email/SMS logging with history |
| Document Center | File upload/storage via Supabase Storage |
| Settings | 8-tab settings (company, profile, integrations, AI, notifications, security, billing, API) |
| Subscription / Billing | Trial banner, paywall enforcement, Stripe checkout integration |
| AI Assistant | Multi-provider (OpenAI, Claude, Gemini), admin approval workflow |
| Quote Templates | Document templates for estimates, contracts, change orders |
| Public Signing Pages | Estimate/document/change-order signing without login |
| Commission / Payroll | Tracks commission rates and types per team member |
| Insurance Tracking | Insurance company, policy, claim, adjuster tracking |
| Supplement Tracking | Insurance supplement management |
| Crew Scheduling | Crew assignments with subcontractor support |
| Equipment Tracking | Equipment inventory and assignment |
| Legal Pages | EULA, Terms of Service, Privacy Policy |

### ⚠️ Partially Complete (works, but limited)

| Feature | What Works | What's Missing | Impact |
|---------|-----------|----------------|--------|
| Suppliers | List, add, edit | Communication history | Low — core function works |
| Estimates | Full CRUD, line items, PDF | Email sending from app | Medium — can workaround by downloading |
| Projects | Full CRUD, status, budget | Team assignment UI | Low |
| Work Orders | Full CRUD, status workflow | Time tracking | Low |
| Material Orders | List, create, status | Line items not loaded (items: []) | Medium — totals show, items don't |
| Expense Tracker | UI displays data | Not connected to Supabase `expenses` table | Medium — shows empty |
| Automations | Create, toggle, delete — all persisted to DB | No server-side execution engine | Low — rules save but don't fire |
| Calendar | Full UI | External calendar sync (Google/Outlook) | Low |
| Project Templates | View templates | Create/edit templates | Low |

---

## Mobile App — Feature Status

### ✅ Complete

| Feature | Notes |
|---------|-------|
| Authentication | Signs in/out, dormancy recovery (matches web 3-part fix) |
| Dashboard | Summary cards with Supabase data |
| Contacts | List + search |
| Notifications | Realtime subscriptions + Capacitor push permission + mark-all-as-read |
| Settings | Functional toggles (notifications, dark mode), Change Password flow, Help nav |
| More / Profile | Subscription plan modal, sign out |
| CI/CD | GitHub Actions builds + syncs Capacitor iOS on push |
| Capacitor Config | StatusBar, SplashScreen, PushNotifications plugin config |

### 📋 Before App Store Submission

1. Run `npm install` in `TrussCTR-Mobile-1.0/` (installs new Capacitor plugins)
2. Run `npm run build && npx cap sync ios`
3. Open `ios/App/App.xcodeproj` in Xcode
4. Set Team + Bundle ID (`com.trussctr.app`)
5. Add app icons (1024×1024 PNG)
6. Archive → Upload to App Store Connect

---

## Session & Auth Behavior

### Sign In Flow
1. User submits credentials → `supabase.auth.signInWithPassword()`
2. Supabase fires `SIGNED_IN` event → `onAuthStateChange` handler runs
3. `loadProfileOnce()` fetches profile with company_id retry/backoff (up to 3.8 seconds for trigger lag)
4. If no company_id found, `setupNewUser()` creates the company and profile
5. CRM data loads via `AppLayout.loadData()`

### Password Reset Flow
1. User clicks "Forgot password?" → receives email link
2. Link contains `?code=...&type=recovery` → `supabase.ts` sets `pending_password_reset` in sessionStorage
3. `UpdatePassword.tsx` exchanges code for session, shows form
4. On submit → `supabase.auth.updateUser({ password })` → redirect to app

### Invite Flow
1. Admin sends invite → creates row in `invitations` table
2. Invite URL: `?invite=TOKEN&company=COMPANY_ID`
3. `AuthPage.tsx` detects params, fetches invite details, pre-fills email + role
4. On signup → marks invitation as accepted

### Session Dormancy Recovery
When the browser tab sits idle and Supabase silently refreshes the token:
- `TOKEN_REFRESHED` event fires → re-fetches profile if null
- `visibilitychange` event fires when user returns to tab → re-fetches profile if null
- Safety-net `useEffect` runs 1.5s after render → re-fetches if user is authenticated but profile is null

---

## Subscription & Billing

### Trial Behavior
- New companies get a 14-day free trial (`subscription_status = 'trialing'`, `trial_ends_at = now + 14 days`)
- **Days 1–7:** Blue banner shows 50% off launch promo with copyable code `LAUNCH50`
- **Days 8–14:** Yellow urgency banner ("X days left — use code LAUNCH50")
- **Trial expired:** Full-screen paywall — "Subscribe Now" button → Settings → Billing tab

### Subscription States

| `subscription_status` | App Behavior |
|-----------------------|-------------|
| `trialing` + valid trial | Full access + trial banner |
| `trialing` + expired | Paywall |
| `active` | Full access, no banner |
| `canceled` | Paywall |
| `past_due` | Paywall |

### Stripe Integration
- Checkout sessions are created server-side (via Vercel API routes or Supabase Edge Functions)
- On successful checkout, Stripe webhook updates `subscription_status` in `companies` table
- Promo code `LAUNCH50` = 50% off first 3 months on monthly plans

---

## Deployment Checklists

### Web App — Vercel Deploy

- [ ] Set `VITE_SUPABASE_URL` in Vercel env vars
- [ ] Set `VITE_SUPABASE_ANON_KEY` in Vercel env vars
- [ ] Set `VITE_STRIPE_PUBLISHABLE_KEY` in Vercel env vars (if billing active)
- [ ] Apply `supabase-migrations/add-suppliers-orders-estimates.sql` in Supabase SQL Editor
- [ ] Apply `supabase-migrations/ai-configuration.sql` in Supabase SQL Editor
- [ ] Apply `supabase-migrations/001_enable_rls.sql` in Supabase SQL Editor
- [ ] Verify RLS is enabled: Supabase Dashboard → Auth → Policies — all core tables should show policies
- [ ] Test sign-up with a new account — confirm company is created
- [ ] Test password reset — confirm email arrives and reset link works on Vercel URL
- [ ] Confirm no "Demo Mode" banner appears after setting env vars

### Mobile App — iOS Deploy

- [ ] Copy `.env.example` → `.env`, fill in real values
- [ ] Set GitHub Actions secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`
- [ ] `npm install` (install Capacitor plugins: push-notifications, haptics, status-bar)
- [ ] `npm run build && npx cap sync ios`
- [ ] Open Xcode → set Bundle ID to `com.trussctr.app` (or your actual ID)
- [ ] Set Apple Development Team
- [ ] Add app icons (Settings → General → App Icons → 1024×1024 PNG)
- [ ] Enable Push Notification capability in Xcode
- [ ] Archive → Product → Archive
- [ ] Upload to App Store Connect
- [ ] Submit for TestFlight review, then App Store review

---

## Known Limitations (v1.0)

These are intentional stubs documented for future releases:

| Area | Status | Notes |
|------|--------|-------|
| Automation execution | UI only | Rules save to DB but no server-side trigger engine. Planned for v1.5. |
| External calendar sync | UI only | Google Calendar / Outlook integration not implemented. |
| Expense Tracker | UI only | Not connected to `expenses` Supabase table. |
| Material order line items | Partial | Items array not loaded from `material_order_items` (totals show correctly). |
| Receipt upload | Not built | Part of Expense Tracker — planned for v1.5. |
| Document template editor | View only | Can view templates, not create/edit in-app. |
| Commission payroll calculation | UI only | Rates tracked, full payroll report is manual export. |

---

## Support & Contacts

For questions about the codebase, contact the development team.

For Supabase, Stripe, or Vercel account issues, reference each platform's documentation.
