# TrussCTR CRM — v1.0.0

**Released:** March 9, 2026  
**Commit:** d851fbd683018f263468a617cf640a6082c41268  
**Branch:** main  
**Status:** Production · Full-Feature · Live

---

## What's Included

### Core Application (`src/`)
- React 18 + TypeScript + Vite SPA
- Tailwind CSS + shadcn/ui component library
- Hash-based routing (GitHub Pages compatible)
- Full responsive layout

### Authentication & User Management
- Supabase Auth (email/password)
- Company-scoped multi-tenant isolation (RLS)
- Role hierarchy: Owner → Admin → Manager → Sales Manager → Sales Rep → Viewer
- Custom per-user permissions editor
- Team invite flow with token-based acceptance
- `join?token=` route for invite acceptance

### Email System
- Supabase Edge Function: `send-invite-email` (Resend)
- Supabase Edge Function: `send-invitation-email` (Resend)
- Supabase Edge Function: `create-team-user`
- Invitations table with 7-day expiry, accepted flag, revoke support
- All email calls route directly via `supabase.functions.invoke()` — works from any domain

### CRM Modules
- **Kanban Board** — drag-and-drop deal pipeline
- **Leads** — full CRUD, filters, assignment
- **Contacts** — company + person records
- **Jobs / Projects** — status tracking
- **Calendar** — event scheduling
- **Documents** — file management
- **Reporting & Analytics** — revenue, leaderboard, charts
- **Settings** — company profile, billing, notifications
- **Team Management** — invite, edit roles, commission rates, permissions, revoke invites
- **AI Assistant** — in-app CRM assistant

### Infrastructure
- **Hosting:** GitHub Pages (auto-deploy via Actions on push to main)
- **Database & Auth:** Supabase (PostgreSQL + RLS)
- **Email:** Resend via Supabase Edge Functions
- **Build:** Vite + TypeScript strict mode
- **CI:** `.github/workflows/` GitHub Actions

### Database Migrations (`supabase-migrations/` & `supabase/`)
- Full schema: profiles, companies, leads, contacts, deals, jobs, documents, invitations
- RLS policies for company isolation
- Custom permissions column on profiles
- Commission rate fields (self_gen, company, custom)

---

## Local Restore Instructions

```bash
# 1. Clone
git clone https://github.com/614restore/crm-kanban-integrate.git
cd crm-kanban-integrate
git checkout d851fbd683018f263468a617cf640a6082c41268

# 2. Install
npm install

# 3. Environment — copy and fill in your Supabase keys
cp .env.example .env.local
# Set: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

# 4. Run locally
npm run dev
```

---

## Edge Functions (Supabase)

| Function | Purpose | Deployments |
|---|---|---|
| `send-invite-email` | Sends team invite emails via Resend | 9 |
| `send-invitation-email` | Alternate invite flow | 7 |
| `create-team-user` | Creates auth user on accept | 6 |

All functions live in `supabase/functions/`.

---

## Key Files

| File | Description |
|---|---|
| `src/components/crm/TeamView.tsx` | Team management + invite UI |
| `src/lib/authContext.tsx` | Auth provider |
| `src/lib/crmStore.tsx` | Global state (useReducer) |
| `src/lib/database.ts` | Supabase DB helpers |
| `src/lib/supabase.ts` | Supabase client init |
| `src/lib/crmData.ts` | Types, roles, formatters |
| `supabase/functions/send-invite-email/` | Resend email edge function |
| `SUPABASE_FULL_BACKUP_20260308.sql` | Full DB schema + RLS backup |
| `.env.example` | Environment variable template |
| `.github/workflows/` | GitHub Actions deploy pipeline |

---

## GitHub Backup

This commit is permanently tagged as `v1.0.0` in the GitHub repository.  
To restore to exactly this state at any time:

```bash
git fetch --tags
git checkout v1.0.0
```

---

*TrussCTR CRM · v1.0.0 · March 2026*
