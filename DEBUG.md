# 🔍 Debug Guide - Testing Company Settings Save

## Test 1: Check Database Connection

### In Browser Console (F12 → Console):
```javascript
// Test Supabase connection
const { data, error } = await supabase.from('companies').select('*').limit(1);
console.log('Database test:', { data, error });
```

**Expected:** `data` should be an array (even if empty), `error` should be null
**If error:** Your database isn't set up or connection is wrong

---

## Test 2: Check Company Data Loading

### Steps:
1. Open app at `http://localhost:8080/`
2. Go to Settings → Company tab
3. Open Console (F12)
4. Look for these messages:
   - `"Creating default company for new user..."` (if first time)
   - `"Company created: [some-id]"` (if first time)
   - `"✅ Company setup complete!"` (if first time)

### In Console, check your profile:
```javascript
// Get your user profile
const { data: session } = await supabase.auth.getSession();
const userId = session?.session?.user?.id;

const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single();

console.log('Your profile:', profile);
console.log('Company ID:', profile?.company_id);
```

**Expected:** `company_id` should have a value (UUID string)
**If null:** Run the auto-setup or create company manually

---

## Test 3: Test Company Save Function

### In Console:
```javascript
// Get your company ID first
const { data: session } = await supabase.auth.getSession();
const userId = session?.session?.user?.id;

const { data: profile } = await supabase
  .from('profiles')
  .select('company_id')
  .eq('id', userId)
  .single();

const companyId = profile?.company_id;
console.log('Testing with company ID:', companyId);

// Test update
const { data, error } = await supabase
  .from('companies')
  .update({ 
    name: 'Test Company Name',
    phone: '(555) 123-4567'
  })
  .eq('id', companyId)
  .select()
  .single();

console.log('Update result:', { data, error });
```

**Expected:** `data` should show the updated company, `error` should be null
**If error:** Check the error message for clues

---

## Test 4: Test Logo Upload

### Steps:
1. Go to Settings → Company
2. Click "Change Logo" or click on the logo area
3. Select an image file
4. Watch the Console for messages:

**Expected messages:**
```
Logo uploaded and saved successfully
```

**If you see errors:**
```
Upload error: [some message]
```
Or:
```
Failed to upload logo
```

### Manual upload test in Console:
```javascript
// Test if storage bucket is accessible
const { data: buckets, error } = await supabase.storage.listBuckets();
console.log('Available buckets:', buckets?.map(b => b.name));

// Should see: ['company-logos', 'avatars', 'projectceo-documents', ...]
```

### Test upload permissions:
```javascript
// Create a test file
const testBlob = new Blob(['test'], { type: 'image/png' });
const testFile = new File([testBlob], 'test.png', { type: 'image/png' });

// Try to upload
const { data, error } = await supabase.storage
  .from('company-logos')
  .upload(`test-${Date.now()}.png`, testFile);

console.log('Upload test:', { data, error });
```

**Expected:** `data` should have path info, `error` should be null
**If error:** Check bucket permissions in Supabase

---

## Test 5: Check Persistence

### After saving company info:
1. Edit company name to "My New Company Name"
2. Click "Save Changes"
3. Wait for success toast
4. Switch to another tab (like "My Profile")
5. Switch back to "Company" tab

**Expected:** Company name should still be "My New Company Name"
**If it reverts:** Form is not loading from database properly

### Check what's in database:
```javascript
// Get your company data
const { data: session } = await supabase.auth.getSession();
const userId = session?.session?.user?.id;

const { data: profile } = await supabase
  .from('profiles')
  .select('company_id')
  .eq('id', userId)
  .single();

const { data: company } = await supabase
  .from('companies')
  .select('*')
  .eq('id', profile?.company_id)
  .single();

console.log('Company in database:', company);
```

**Expected:** Should show your company with the data you saved

---

## Common Issues & Fixes

### Issue: "No company associated with your account"
**Fix:** Run auto-setup or create company manually
```sql
-- In Supabase SQL Editor
INSERT INTO companies (name, email)
VALUES ('My Company', 'your-email@example.com')
RETURNING id;

-- Copy the ID, then:
UPDATE profiles 
SET company_id = 'paste-id-here'
WHERE email = 'your-email@example.com';
```

### Issue: "Upload failed" or logo doesn't save
**Check:**
1. Is `company-logos` bucket public?
2. Go to Storage → company-logos → Settings
3. Make sure "Public" is enabled

**Or add policy:**
```sql
-- In Supabase SQL Editor
CREATE POLICY "Public logo read" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'company-logos');

CREATE POLICY "Authenticated logo upload" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'company-logos' 
  AND auth.role() = 'authenticated'
);
```

### Issue: Data doesn't persist after refresh
**Check:**
1. Is the form using controlled inputs? (should have `value={}` not `defaultValue={}`)
2. Is `useEffect` loading data on mount?
3. Check Console for "Error fetching company"

### Issue: Save button does nothing
**Check Console for:**
- "Error updating company"
- "Failed to save company profile"
- Any database permission errors

**Fix permissions:**
```sql
-- In Supabase SQL Editor
CREATE POLICY "Users can update their company" 
ON companies FOR UPDATE 
USING (
  id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);
```

---

## Quick Health Check Script

Run this in Console to check everything:

```javascript
async function healthCheck() {
  console.log('🔍 Running health check...');
  
  // 1. Check auth
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;
  console.log('✅ Auth:', userId ? 'Logged in' : '❌ Not logged in');
  
  if (!userId) return;
  
  // 2. Check profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  console.log('✅ Profile:', profile ? 'Found' : '❌ Not found', profileError);
  
  // 3. Check company
  if (profile?.company_id) {
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', profile.company_id)
      .single();
    console.log('✅ Company:', company ? 'Found' : '❌ Not found', companyError);
    console.log('   Company name:', company?.name);
    console.log('   Logo URL:', company?.logo_url);
  } else {
    console.log('❌ No company_id in profile');
  }
  
  // 4. Check storage buckets
  const { data: buckets } = await supabase.storage.listBuckets();
  console.log('✅ Storage buckets:', buckets?.map(b => b.name));
  
  console.log('🎉 Health check complete!');
}

healthCheck();
```

---

## Need More Help?

If tests fail:
1. Share the console output
2. Share any error messages
3. Check if SQL setup script was run
4. Verify `.env` file has correct Supabase credentials
