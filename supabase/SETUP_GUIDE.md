# 🚀 Supabase Setup - Simple Step-by-Step Guide

**Run these 7 SQL files in order in your Supabase SQL Editor**

---

## ✅ How to Run

1. Open your Supabase project at https://supabase.com
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the contents of each file below (in order)
5. Paste into the SQL editor
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. Wait for "Success" message
8. Move to next file

---

## 📋 Run These Files in Order

### Step 1: Enable Extensions
**File:** `setup-step-1-extensions.sql`
- Enables UUID generation
- Takes 1 second

### Step 2: Create Tables
**File:** `setup-step-2-tables.sql`
- Creates all database tables
- Takes 5-10 seconds

### Step 3: Create Indexes
**File:** `setup-step-3-indexes.sql`
- Adds performance indexes
- Takes 2-3 seconds

### Step 4: Create Triggers
**File:** `setup-step-4-triggers.sql`
- Auto-updates timestamps
- Auto-creates user profiles
- Takes 3-5 seconds

### Step 5: Enable Row Level Security
**File:** `setup-step-5-rls.sql`
- Enables data security
- Creates access policies
- Takes 10-15 seconds

### Step 6: Create Owner Priority View
**File:** `setup-step-6-owner-priority-view.sql`
- Powers the Priority Board
- Takes 2 seconds

### Step 7: Setup Storage Buckets
**File:** `setup-step-7-storage.sql`
- Creates file storage buckets
- Sets upload policies
- Takes 5 seconds

---

## ✅ Verification

After running all 7 steps, verify:

### Check Tables
Go to **Table Editor** and confirm these tables exist:
- ✅ companies
- ✅ profiles
- ✅ contacts
- ✅ appointments
- ✅ invoices
- ✅ estimates
- ✅ document_templates
- ✅ lead_sources
- ✅ activities

### Check View
In SQL Editor, run:
```sql
SELECT * FROM v_owner_priority LIMIT 1;
```
Should return: "Success. No rows returned" (that's good - means view exists)

### Check Storage
Go to **Storage** and confirm these buckets exist:
- ✅ company-logos (public)
- ✅ avatars (public)
- ✅ projectceo-documents (private)

---

## 🎉 Done!

Your Supabase backend is now fully configured!

**Next steps:**
1. Update your `.env` file with Supabase credentials
2. Run `npm run dev` to start the app
3. Create an account and test uploading a logo

---

## 🚨 If You Get Errors

### "relation already exists"
- That's OK! It means the table was already created
- Continue to the next step

### "syntax error"
- Make sure you copied the ENTIRE file contents
- Check there are no extra characters at the end
- Try running the file again

### "permission denied"
- Make sure you're logged into Supabase
- Verify you're in the correct project
- Check you have admin access

### Storage policies fail
- Go to **Storage** in Supabase UI
- Manually create the 3 buckets first:
  - company-logos (make it public)
  - avatars (make it public)
  - projectceo-documents (keep private)
- Then run Step 7 again

---

## 📞 Need Help?

Check the full documentation in:
- `SUPABASE_SETUP.md` - Detailed setup guide
- `SUPABASE_CHECKLIST.md` - Complete checklist

---

**Total Time:** 5-10 minutes to run all steps
