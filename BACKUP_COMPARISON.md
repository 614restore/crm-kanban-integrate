# 📦 Backup Comparison Guide

## Available Backups

### 1. SUPABASE_FULL_BACKUP_20260308.sql (March 8, 2026)
**Status:** Basic Setup - Everything Working Differently

**What's in this backup:**
- ✅ Basic authentication and password reset working
- ✅ Company + profiles setup
- ✅ Contact management basic structure
- ✅ Pipeline boards (Retail + Insurance only)
- ✅ Document uploads (without rollback protection)
- ✅ Communication logging (with optimistic fallback on all errors)

**Known Issues in March 8 Version:**
- ❌ Analytics show data from ALL companies (cross-tenant leakage)
- ❌ Only 2 pipeline boards seeded (missing Production + Billing)
- ❌ Status definitions inconsistent across components
- ❌ Document uploads can orphan files in storage
- ❌ Communication logs show fake success on permission errors
- ❌ No loading states on archive/restore operations
- ❌ Auto-status progression not wired to UI

**Use this backup if:**
- You want the simpler, earlier version
- You're okay with the security issues for testing
- You prefer the old way things worked

---

### 2. SUPABASE_FULL_BACKUP_20260401.sql (April 1, 2026) ⭐ **RECOMMENDED**
**Status:** Production-Ready with Security Hardening

**What's in this backup:**
- ✅ **CRITICAL SECURITY FIX:** Analytics filter by company_id (no cross-tenant leakage)
- ✅ **All 4 pipeline boards:** Retail, Insurance, Production, Billing
- ✅ **Standardized status definitions:** Consistent business logic across app
- ✅ **Smart communication logging:** Only optimistic on network errors
- ✅ **Document rollback protection:** Orphaned files automatically deleted
- ✅ **Loading states:** Archive, restore, upload operations show progress
- ✅ **Navigation guards:** Validate company context before view changes
- ✅ **Auto-status progression:** Wired to contact saves

**Additional improvements:**
- Better error handling throughout
- Operation locks prevent race conditions
- Double-click prevention on uploads
- Proper user feedback on failures
- All critical audit findings fixed

**Use this backup if:**
- You're preparing for production launch
- You need multi-tenant security
- You want all features working correctly
- You value data integrity and UX polish

---

## Key Differences Summary

| Feature | March 8 Backup | April 1 Backup |
|---------|---------------|----------------|
| **Security** | ❌ Cross-tenant leakage | ✅ Company isolation enforced |
| **Pipeline Boards** | 2 boards (Retail, Insurance) | 4 boards (+ Production, Billing) |
| **Status Logic** | Inconsistent hardcoded strings | ✅ Standardized enums |
| **Document Uploads** | Can orphan files | ✅ Rollback on metadata failure |
| **Communication Logs** | Fake success on all errors | ✅ Smart error detection |
| **Loading States** | Missing on critical ops | ✅ All async ops show progress |
| **Auto-Status** | Not wired to UI | ✅ Fully functional |
| **Error Handling** | Silent failures | ✅ Clear user feedback |
| **Navigation** | No validation | ✅ Company context checked |
| **Data Integrity** | Race conditions possible | ✅ Operation locks |

---

## How to Restore

### Option 1: Restore March 8 Backup
```sql
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Open SUPABASE_FULL_BACKUP_20260308.sql
-- 3. Copy entire contents
-- 4. Paste into SQL Editor
-- 5. Click "Run"
-- 6. Wait 2-3 minutes for completion
```

### Option 2: Restore April 1 Backup (Recommended)
```sql
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Open SUPABASE_FULL_BACKUP_20260401.sql
-- 3. Copy entire contents
-- 4. Paste into SQL Editor
-- 5. Click "Run"
-- 6. Wait 2-3 minutes for completion
```

---

## Migration Path

If you're currently on March 8 and want to upgrade to April 1:

### Step 1: Test April 1 in Staging
1. Restore April 1 backup to a NEW Supabase project (staging)
2. Deploy latest code from branch `claude/strange-elbakyan`
3. Test all critical features
4. Verify analytics show only your company data
5. Test archive/restore operations

### Step 2: Production Upgrade (when ready)
1. **Backup production data first** (export via Supabase Dashboard)
2. Restore April 1 backup to production
3. Re-seed your production contacts/projects
4. Deploy latest code
5. Verify everything works

### Step 3: Rollback (if needed)
1. Restore March 8 backup
2. Re-import your data
3. Deploy older code version

---

## Code Compatibility

### March 8 Backup requires:
- Code from commit `40a981a` or earlier
- Older status definitions (hardcoded strings)
- 2-board pipeline setup only

### April 1 Backup requires:
- Code from commit `1304fb1` or later (current)
- New `statusDefinitions.ts` file
- 4-board pipeline support

---

## Storage Buckets (Manual Setup Required)

Both backups require these storage buckets:

```
projectceo-documents (private, max 15MB)
inspection-images (private, max 10MB)
avatars (public, max 2MB)
company-logos (public, max 2MB)
```

**Setup:**
1. Go to Supabase Dashboard → Storage
2. Create each bucket
3. Set privacy (public vs private)
4. Configure RLS policies to match table policies

---

## Edge Functions (Manual Deployment Required)

Both backups require these edge functions:

```
supabase/functions/temp-password-reset/
supabase/functions/confirm-password-change/
supabase/functions/send-email/
supabase/functions/send-sms/
```

**Deploy:**
```bash
cd /Users/jeffreynewell/Documents/GitHub/crm-kanban-integrate
supabase functions deploy temp-password-reset
supabase functions deploy confirm-password-change
supabase functions deploy send-email
supabase functions deploy send-sms
```

**Environment Variables:**
Add these in Supabase Dashboard → Settings → Edge Functions:
- `RESEND_API_KEY` - For email sending
- `TWILIO_ACCOUNT_SID` - For SMS
- `TWILIO_AUTH_TOKEN` - For SMS
- `TWILIO_PHONE_NUMBER` - Your Twilio number

---

## Verification After Restore

Run these queries to verify restore succeeded:

```sql
-- Check tables exist
SELECT COUNT(*) FROM public.companies;
SELECT COUNT(*) FROM public.profiles;
SELECT COUNT(*) FROM public.kanban_boards;
SELECT COUNT(*) FROM public.pipeline_statuses;
SELECT COUNT(*) FROM public.contacts;

-- Check RLS policies
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check indexes
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename;
```

Expected results:
- **March 8:** 2 kanban_boards, ~10-15 pipeline_statuses
- **April 1:** 4 kanban_boards (when seeded), ~20-30 pipeline_statuses

---

## Support

If you need help deciding which backup to use:

**Choose March 8 if:**
- You just want to test features quickly
- Security isn't a concern (single-tenant testing)
- You prefer the simpler setup

**Choose April 1 if:**
- You're going to production
- You need multi-tenant security
- You want all features working correctly
- You value data integrity

---

## Change Log

### Version 2.0 (April 1, 2026)
- ✅ Fixed cross-tenant data leakage in analytics
- ✅ Added Production + Billing boards
- ✅ Standardized status definitions
- ✅ Smart communication error handling
- ✅ Document upload rollback protection
- ✅ Loading states on async operations
- ✅ Navigation guards with company validation
- ✅ Auto-status progression wired to UI

### Version 1.0 (March 8, 2026)
- ✅ Basic authentication working
- ✅ Password reset flow complete
- ✅ Retail + Insurance boards
- ✅ Contact management setup
- ✅ Document uploads (basic)
- ✅ Communication logging (basic)

---

*Both backups are preserved and safe to use. Choose based on your needs.*
