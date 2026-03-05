# 🚨 CRITICAL FIX: Apply RLS Policies Now

**Your 500 errors are caused by ambiguous column references in Supabase RLS policies.**

## What to Do (Choose One Path)

### PATH 1: Quick Fix (2 minutes) - RECOMMENDED ✅

1. Open Supabase Dashboard: https://app.supabase.com
2. Select your project: `qgvuzrvpyyrrulhwlzma`
3. Go to **SQL Editor** → Click **"New Query"**
4. Copy **ALL** the SQL from `APPLY_RLS_FIX_NOW.sql` (in this repo)
5. Paste it into the SQL Editor
6. Click **"Run"** (or press Cmd+Enter)
7. Wait for the query to complete
8. Hard refresh your browser (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)

**That's it!** Your app should work now.

---

### PATH 2: Using Supabase CLI (5 minutes)

If you want to use migrations:

```bash
cd /Users/jeffreynewell/Downloads/crm-kanban-integrate

# Link your project
supabase link --project-ref qgvuzrvpyyrrulhwlzma

# Push migrations
supabase db push

# Then deploy with:
npm run build
npm run deploy
```

---

## What This SQL Fixes

✅ Removes ambiguous column references (PostgreSQL error 42P17)  
✅ Adds explicit table qualifications in RLS policies  
✅ Enables team member loading  
✅ Fixes user profile queries  
✅ Restores company branding display

---

## After Applying the Fix

1. **Hard Refresh Browser**: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. **Clear Browser Cache**: F12 → Application → Clear Cache
3. **Log Out Then Back In** if you're still logged in
4. **Check Browser Console** for any remaining errors (F12)

---

## Troubleshooting

**Still seeing 500 errors?**
- Check Supabase logs: https://app.supabase.com → Your Project → Logs
- Look for PostgreSQL error details
- Make sure ALL the SQL ran without errors

**Team members still not showing?**
- Verify you're logged in with a user that has a `company_id`
- Check that other users exist in the `profiles` table for your company
- Check browser console for fetch errors (F12)

**Can't access Supabase dashboard?**
- Visit: https://app.supabase.com
- Log in with your account
- Your project reference is: `qgvuzrvpyyrrulhwlzma`

---

## File Location

The SQL to apply is in: `/APPLY_RLS_FIX_NOW.sql`

Copy the entire contents and run in Supabase → SQL Editor.
