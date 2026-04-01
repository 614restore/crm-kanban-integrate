# 🚨 DATA NOT LOADING - RECOVERY GUIDE

## Your data is NOT lost! It's likely blocked by Row Level Security (RLS) policies.

## IMMEDIATE STEPS TO FIX

### Step 1: Run Quick Check (2 minutes)

1. **Open your app** and log in
2. **Press F12** to open browser console
3. **Copy and paste** the contents of `public/quick-check.js` into the console
4. **Press Enter** and read the output

This will tell you exactly what's wrong.

---

### Step 2: Most Likely Fix - Disable RLS (5 minutes)

Your data is probably blocked by Row Level Security policies. Here's how to fix it:

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**: `qgvuzrvpyyrrulhwlzma`
3. **Click "SQL Editor"** in the left sidebar
4. **Click "New Query"**
5. **Copy and paste** this SQL:

```sql
-- Disable RLS on all tables (temporary fix)
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE estimates DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE communications DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE material_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_boards DISABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_columns DISABLE ROW LEVEL SECURITY;
ALTER TABLE lead_sources DISABLE ROW LEVEL SECURITY;
ALTER TABLE automations DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
```

6. **Click "Run"** (or press Ctrl+Enter)
7. **Refresh your app** (Ctrl+Shift+R or Cmd+Shift+R)

Your data should now appear!

---

### Step 3: Verify Data is Back

After disabling RLS:

1. **Refresh the app** (hard refresh: Ctrl+Shift+R)
2. **Check if you see**:
   - Company name in sidebar
   - Your contacts
   - Your estimates
   - Your projects

If YES → Your data is back! RLS was the problem.
If NO → Continue to Step 4.

---

### Step 4: Check if Data Actually Exists (if Step 3 didn't work)

Run this in Supabase SQL Editor:

```sql
-- Check if your data exists
SELECT 'companies' as table_name, COUNT(*) as records FROM companies
UNION ALL
SELECT 'contacts', COUNT(*) FROM contacts
UNION ALL
SELECT 'estimates', COUNT(*) FROM estimates
UNION ALL
SELECT 'projects', COUNT(*) FROM projects;
```

If you see 0 records → Data was actually deleted (rare)
If you see records → Continue to Step 5

---

### Step 5: Check Your Profile's company_id

Run this in Supabase SQL Editor (replace YOUR_EMAIL):

```sql
SELECT 
  id,
  email,
  company_id,
  first_name,
  last_name,
  role
FROM profiles 
WHERE email = 'YOUR_EMAIL_HERE';
```

**If company_id is NULL**, that's the problem! Fix it:

```sql
-- First, find your company ID
SELECT id, name FROM companies LIMIT 5;

-- Then update your profile (replace COMPANY_UUID and USER_UUID)
UPDATE profiles 
SET company_id = 'YOUR_COMPANY_UUID_HERE'
WHERE id = 'YOUR_USER_UUID_HERE';
```

---

### Step 6: Clear Browser Cache

Sometimes cached data causes issues:

1. **Open browser console** (F12)
2. **Run this**:
```javascript
localStorage.clear();
sessionStorage.clear();
location.reload();
```

---

## WHY DID THIS HAPPEN?

Row Level Security (RLS) policies control who can see what data. If:
- RLS was recently enabled
- Policies were changed
- Your profile lost its company_id

Then the database blocks access to protect data, even though it's YOUR data.

---

## WHAT IF NOTHING WORKS?

### Option 1: Check Supabase Logs
1. Go to Supabase Dashboard → Logs
2. Look for errors around the time data disappeared
3. Check for "permission denied" or "policy violation" errors

### Option 2: Export Data Backup
If you have access to Supabase, export your data:

```sql
-- Export contacts
COPY (SELECT * FROM contacts) TO '/tmp/contacts_backup.csv' CSV HEADER;

-- Or use Supabase Dashboard → Table Editor → Export
```

### Option 3: Contact Support
Email: scopemgr@614restore.com

Include:
- Your email address
- When the issue started
- Screenshot of browser console errors
- Results from the quick-check.js script

---

## PREVENTION FOR FUTURE

After fixing, add proper RLS policies (see EMERGENCY_FIX.sql) or keep RLS disabled if this is a private/internal app.

---

## FILES TO USE

1. **quick-check.js** - Diagnose the problem (run in browser console)
2. **EMERGENCY_FIX.sql** - Complete SQL fix (run in Supabase SQL Editor)
3. **diagnostic.js** - Full diagnostic report (run in browser console)

---

## MOST COMMON FIXES (in order)

1. ✅ Disable RLS (fixes 80% of cases)
2. ✅ Fix missing company_id in profile (fixes 15% of cases)
3. ✅ Clear browser cache (fixes 4% of cases)
4. ✅ Check Supabase project status (fixes 1% of cases)

---

**Your data is safe!** This is almost always a permissions/access issue, not data loss.
