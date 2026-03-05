# Fix 500 Error on Profiles Table

## Problem
You're seeing a 500 error when logging in:
```
Failed to load resource: the server responded with a status of 500 () (profiles, line 0)
```

**Root Cause**: PostgreSQL error 42P17 - Ambiguous column references in RLS policies.

## Solution

### Step 1: Run the Fix SQL in Supabase

1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/qgvuzrvpyyrrulhwlzma
2. Go to **SQL Editor** (in the left sidebar)
3. Click **"New Query"**
4. Copy and paste the entire contents of this file: `supabase/migrations/002_fix_rls_policies.sql`
5. Click **"Run"** or press `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows)

### Step 2: Verify the Fix

After running the SQL, you should see output like:
```
NOTICE:  Dropped policy: Managers can update team members
NOTICE:  Dropped policy: Users can insert own profile
NOTICE:  Dropped policy: Users can update own profile
NOTICE:  Dropped policy: Users can view profiles in their company
NOTICE:  === Current RLS Policies on profiles table ===
NOTICE:  Policy: Managers can update team members (Command: UPDATE)
NOTICE:  Policy: Users can insert own profile (Command: INSERT)
NOTICE:  Policy: Users can update own profile (Command: UPDATE)
NOTICE:  Policy: Users can view profiles in their company (Command: SELECT)
NOTICE:  RLS policies updated successfully!
```

### Step 3: Test Your Login

1. **Hard refresh your browser**: 
   - **Mac**: `Cmd + Shift + R`
   - **Windows**: `Ctrl + Shift + F5`
   - **Safari**: `Cmd + Option + R`

2. **Clear browser cache** (if hard refresh doesn't work):
   - Open Developer Tools (`F12`)
   - Right-click the refresh button
   - Select "Empty Cache and Hard Reload"

3. **Log in again** at https://614restore.github.io/crm-kanban-integrate/

### Step 4: Verify Everything Works

After logging in successfully, check:
- ✅ Your profile info displays (name, email, role)
- ✅ Company name shows "614 Restore" (not TrussCTR)
- ✅ Team members are visible in the Team section
- ✅ No 500 errors in browser console

## Still Having Issues?

If you still see errors after completing all steps:

1. **Check Supabase logs**:
   - Go to Supabase Dashboard → Logs → API
   - Look for any new 500 errors
   - Share the error details

2. **Check browser console**:
   - Press `F12` to open Developer Tools
   - Go to "Console" tab
   - Share any red error messages

3. **Verify your role**:
   ```sql
   SELECT email, role, company_id 
   FROM profiles 
   WHERE email = 'jeffrey@614restore.com';
   ```
   Your role should be `owner` (not `admin`)

## What This Fix Does

The fix resolves ambiguous column references by:
1. **Dropping all existing conflicting policies**
2. **Recreating policies with explicit table qualifications**:
   - Changed `id` → `profiles.id`
   - Changed `company_id` → `profiles.company_id`
   - Used table alias `p` consistently in subqueries
3. **Ensuring no circular dependencies** between policies

This is a permanent fix - once applied, the error won't come back.
