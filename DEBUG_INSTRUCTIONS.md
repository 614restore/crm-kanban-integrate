# 🔍 DEBUG: Missing Team Members

## Current Status
- ✅ RLS policies applied successfully
- ✅ App deployed with debug logging
- ❌ Team members still not showing

## Step 1: Check Browser Console (CRITICAL)

1. **Open Browser Console**: Press `F12` or `Cmd+Option+I` (Mac)
2. **Go to Console tab**
3. **Hard refresh**: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
4. **Log in to your app**
5. **Navigate to Team view**

### Look for these specific log messages:

```
[Database] Fetching team members for company: <your-company-id>
[Database] Team members fetched successfully: <number>
[CRM] Raw dbTeamMembers from database: <number>
[CRM] Converted teamMembers: <number>  
[TeamView] state.teamMembers: <number>
```

**If you see `<number> = 0`**, the problem is in the database query.
**If you see errors**, they'll tell us exactly what's wrong.

**Copy and paste ALL console output here.**

---

## Step 2: Run Diagnostic SQL in Supabase

1. Open Supabase: https://app.supabase.com
2. Select your project: `qgvuzrvpyyrrulhwlzma`
3. Go to **SQL Editor** → **New Query**
4. Copy ALL SQL from `DEBUG_TEAM_MEMBERS.sql` (in this repo)
5. Run it
6. **Take screenshots of ALL 5 query results**
7. Share them with me

This will show:
- Your user profile and company_id
- All team members in your company
- Whether RLS policies are blocking the query
- The exact data the app should be seeing

---

## Step 3: Possible Issues & Fixes

### Issue A: No company_id on your profile
**Symptom**: Query 1 shows `company_id = NULL`

**Fix**:
```sql
-- Run in Supabase SQL Editor
UPDATE profiles 
SET company_id = (SELECT id FROM companies LIMIT 1)
WHERE id = auth.uid();
```

### Issue B: No other team members exist
**Symptom**: Query 2 only shows YOUR profile

**This is expected if you're the only user!** You need to invite team members.

### Issue C: is_active = false
**Symptom**: Query 3 shows `inactive_members = 1`

**Fix**:
```sql
-- Activate all profiles
UPDATE profiles 
SET is_active = true
WHERE company_id = (SELECT company_id FROM profiles WHERE id = auth.uid());
```

### Issue D: RLS policy blocking the query
**Symptom**: Query 5 returns 0 rows but Query 2 returns rows

**This means RLS is still broken. Run**:
```sql
-- Copy from APPLY_RLS_FIX_NOW.sql and run again
```

---

## Step 4: After Running Diagnostics

**Send me**:
1. ✅ All browser console logs (from Step 1)
2. ✅ Screenshots of all 5 SQL query results (from Step 2)
3. ✅ Any error messages you see

With this information, I can pinpoint exactly what's wrong and fix it immediately.

---

## Quick Checks

Before running diagnostics, verify:
- [ ] You've hard refreshed the browser (Cmd+Shift+R)
- [ ] You're logged in with the correct account
- [ ] You're looking at the Team view (not Dashboard)
- [ ] Browser console is open (F12)

---

## Expected Behavior

When working correctly, you should see:
- Your own profile in the team list
- Any other users you've invited
- Each team member shows: name, email, role, department

If you only see yourself, that's correct if you haven't invited anyone yet!
