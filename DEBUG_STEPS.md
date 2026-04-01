# Debugging Steps for Missing Data Issue

## Problem
User reports that after login, no company logo, company name, contacts, or other data is loading.

## Changes Made

### 1. Reduced Timeouts (Previous Fix)
- Auth loading: 8s → 5s
- Data fetch timeout: 7s → 4s  
- Initial load timeout: 12s → 8s
- Force continue button: 5s → 3s

### 2. Improved Company Data Loading
- Increased company fetch timeout: 5s → 8s (to allow more time for slow connections)
- Added background cache refresh when returning cached data
- Added better error logging to identify where the failure occurs
- Added loading state to Sidebar to show "Loading..." instead of default name

## Next Steps to Debug

### Open Browser Console (F12) and check for:

1. **Auth State**
   - Look for `[Auth]` prefixed messages
   - Check if user is authenticated
   - Verify `company_id` is present in profile

2. **Database Errors**
   - Look for `[Database]` prefixed messages
   - Check for timeout errors
   - Look for RLS (Row Level Security) policy errors
   - Check for "Failed to load company data for ID:" message

3. **Network Tab**
   - Filter by "supabase"
   - Check if requests to `companies` table are succeeding
   - Look for 401 (unauthorized) or 403 (forbidden) errors
   - Check response times

### Common Issues and Solutions

#### Issue 1: RLS Policies Blocking Access
**Symptoms:** 
- Console shows "Direct company query failed" 
- Network tab shows 403 or empty results

**Solution:**
```sql
-- Run in Supabase SQL Editor
-- Check current RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'companies';

-- If RLS is enabled and blocking, temporarily disable for testing:
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;

-- Or add proper policy:
CREATE POLICY "Users can view their own company"
  ON companies FOR SELECT
  USING (id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));
```

#### Issue 2: Stale Cache
**Symptoms:**
- Old data showing
- Changes not reflecting

**Solution:**
```javascript
// In browser console:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

#### Issue 3: Profile Missing company_id
**Symptoms:**
- Console shows "No company_id available"
- User authenticated but no data loads

**Solution:**
```sql
-- Check profile in Supabase
SELECT id, email, company_id, role FROM profiles WHERE email = 'your-email@example.com';

-- If company_id is NULL, update it:
UPDATE profiles 
SET company_id = 'your-company-uuid-here'
WHERE email = 'your-email@example.com';
```

#### Issue 4: Network Timeout
**Symptoms:**
- Console shows "timed out after Xms"
- Slow network connection

**Solution:**
- Check internet connection
- Try from different network
- Check Supabase project status at status.supabase.com

### Manual Test Commands

Run these in browser console after logging in:

```javascript
// 1. Check auth state
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);
console.log('User ID:', session?.user?.id);

// 2. Check profile
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', session?.user?.id)
  .single();
console.log('Profile:', profile);
console.log('Company ID:', profile?.company_id);

// 3. Check company data
const { data: company, error } = await supabase
  .from('companies')
  .select('*')
  .eq('id', profile?.company_id)
  .single();
console.log('Company:', company);
console.log('Error:', error);

// 4. Check contacts
const { data: contacts, error: contactsError } = await supabase
  .from('contacts')
  .select('*')
  .eq('company_id', profile?.company_id);
console.log('Contacts count:', contacts?.length);
console.log('Contacts error:', contactsError);

// 5. Clear all caches and reload
localStorage.clear();
sessionStorage.clear();
location.reload();
```

## Files Modified
1. `/src/lib/authContext.tsx` - Reduced auth timeout to 5s
2. `/src/components/AppLayout.tsx` - Reduced data fetch and load timeouts
3. `/src/lib/supabase.ts` - Added auto-cleanup for auth URL params
4. `/src/lib/database.ts` - Improved company data loading with better caching and timeouts
5. `/src/components/crm/Sidebar.tsx` - Added loading state for company branding
