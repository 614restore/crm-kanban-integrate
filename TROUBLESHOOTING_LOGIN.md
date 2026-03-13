# 🔧 Troubleshooting: Stuck on Login Screen

## Quick Fixes

### 1. **Create Your First Account**

If you haven't created an account yet:

1. Click **"Sign up free"** on the login page
2. Fill in:
   - First Name
   - Last Name
   - Company Name
   - Email
   - Password (min 6 characters)
3. Click **"Create Account"**
4. Check your email for verification link (if email confirmation is enabled)
5. Return to login page and sign in

---

### 2. **Verify Supabase Setup**

Check if your database is set up:

1. Go to https://supabase.com
2. Open your project: `qgvuzrvpyyrrulhwlzma`
3. Go to **Table Editor**
4. Verify these tables exist:
   - ✅ companies
   - ✅ profiles
   - ✅ contacts
   - ✅ (and 53 others)

If tables are missing, run the 7 SQL setup scripts from `supabase/` folder.

---

### 3. **Check Supabase Connection**

Open browser console (F12) and look for errors:

**Good signs:**
- No red errors
- See "Supabase client initialized"

**Bad signs:**
- "Failed to fetch"
- "Invalid API key"
- "Project not found"

**Fix:**
- Verify `.env` file has correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Restart dev server: `npm run dev`

---

### 4. **Clear Browser Cache**

Sometimes old auth tokens cause issues:

1. Open browser DevTools (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Expand **Local Storage**
4. Click your site URL
5. Delete all items
6. Refresh page

---

### 5. **Check Email Confirmation Settings**

If you're stuck after signup:

1. Go to Supabase Dashboard
2. Click **Authentication** → **Settings**
3. Check **"Enable email confirmations"**
   - If **ON**: Check your email for verification link
   - If **OFF**: You can login immediately after signup

**To disable email confirmation:**
```
1. Supabase Dashboard → Authentication → Settings
2. Scroll to "Email Auth"
3. Toggle OFF "Enable email confirmations"
4. Save
```

---

### 6. **Test with Demo Mode**

Enable demo mode to test without creating an account:

**In `.env` file:**
```env
VITE_DEMO_MODE=true
```

**Restart dev server:**
```bash
npm run dev
```

**Login with:**
- Email: `demo@example.com`
- Password: `password`

---

### 7. **Check for JavaScript Errors**

Open browser console (F12) and look for:

**Common errors:**
- `Uncaught ReferenceError` - Missing dependency
- `Failed to fetch` - Supabase connection issue
- `Invalid token` - Auth session expired

**Fix:**
```bash
# Reinstall dependencies
npm install --legacy-peer-deps

# Restart dev server
npm run dev
```

---

### 8. **Verify Supabase Project Status**

1. Go to https://supabase.com/dashboard
2. Check project status
3. If paused (free tier), click **"Resume"**

---

### 9. **Check RLS Policies**

If you can create an account but can't see data:

1. Go to Supabase Dashboard
2. Click **Authentication** → **Policies**
3. Verify RLS policies exist for:
   - profiles
   - companies
   - contacts

If missing, run **Step 5** from the SQL setup scripts.

---

### 10. **Manual User Creation (Last Resort)**

If signup isn't working, create user manually:

1. Go to Supabase Dashboard
2. Click **Authentication** → **Users**
3. Click **"Add user"**
4. Enter email and password
5. Click **"Create user"**
6. Go to **Table Editor** → **profiles**
7. Manually add a row:
   - `id`: (copy from auth.users)
   - `email`: your email
   - `first_name`: Your Name
   - `role`: owner
8. Go to **Table Editor** → **companies**
9. Add a company:
   - `name`: Your Company
10. Go back to **profiles** and set `company_id` to the company you just created

---

## 🔍 Diagnostic Checklist

Run through this checklist:

- [ ] `.env` file exists with Supabase credentials
- [ ] Supabase project is active (not paused)
- [ ] Database tables exist (56 tables)
- [ ] RLS policies are enabled
- [ ] No JavaScript errors in console
- [ ] Browser cache cleared
- [ ] Email confirmation setting checked
- [ ] Tried creating a new account
- [ ] Tried demo mode (if enabled)

---

## 🚀 Quick Test

Run this in your browser console (F12) while on the login page:

```javascript
// Test Supabase connection
const { data, error } = await window.supabase.from('profiles').select('count');
console.log('Connection test:', { data, error });
```

**Expected result:**
- `data: [{ count: 0 }]` or `[{ count: N }]` - ✅ Working
- `error: { message: "..." }` - ❌ Problem

---

## 📞 Still Stuck?

If none of these work, provide:

1. Browser console errors (F12 → Console tab)
2. Network tab errors (F12 → Network tab)
3. Supabase project status (active/paused)
4. Whether you can create an account or not
5. Whether email confirmation is enabled

---

## 🎯 Most Common Issues

### Issue: "Invalid login credentials"
**Cause:** Wrong email/password or account doesn't exist  
**Fix:** Click "Sign up free" to create account first

### Issue: "Failed to fetch"
**Cause:** Supabase connection problem  
**Fix:** Check `.env` file, verify project is active

### Issue: "User already registered"
**Cause:** Account exists but you forgot password  
**Fix:** Click "Forgot password?" to reset

### Issue: Stuck after signup
**Cause:** Email confirmation required  
**Fix:** Check email for verification link, or disable email confirmation in Supabase

### Issue: Can login but see no data
**Cause:** RLS policies not set up  
**Fix:** Run Step 5 SQL script (RLS policies)

---

## ✅ Success Indicators

You'll know it's working when:

1. ✅ Login page loads without errors
2. ✅ Can create account successfully
3. ✅ After login, see dashboard (not login page)
4. ✅ Can create contacts, view data
5. ✅ No red errors in browser console

---

**Your Supabase credentials are configured correctly!**  
The issue is likely one of the common problems above.
