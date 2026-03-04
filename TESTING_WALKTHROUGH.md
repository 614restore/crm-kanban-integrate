# 🧪 TrussCTR CRM – Complete Testing Walkthrough

## Overview

This guide walks you through testing the TrussCTR CRM application to verify that all features work correctly with the **live Supabase backend**.

By the end of this walkthrough, you'll have tested:
- ✅ User authentication
- ✅ Profile creation and avatar uploads
- ✅ Company settings and logo uploads
- ✅ Data persistence across logout/login
- ✅ All integrations

**⏱️ Estimated Time: 15-20 minutes**

---

## Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- An email address you haven't used with the app before
- Access to https://614restore.github.io/crm-kanban-integrate/

---

## Phase 1: Initial Setup & Authentication

### Step 1.1: Open the App in Incognito/Private Mode

**Why incognito?** Clears old cache and ensures we're testing the latest version.

1. Open a **NEW incognito/private browser window**
   - **Chrome**: `Cmd+Shift+N` (Mac) or `Ctrl+Shift+N` (Windows)
   - **Firefox**: `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows)
   - **Safari**: `Cmd+Shift+N` (Mac)

2. Navigate to: **https://614restore.github.io/crm-kanban-integrate/**

3. You should see the TrussCTR CRM login page

✅ **Checkpoint**: Login page loads without errors

---

### Step 1.2: Sign In with New Email

**Goal**: Test real Supabase authentication

1. Enter a **NEW email address** you haven't used before
   - Example: `test-march2026-[your-name]@gmail.com`
   - ⚠️ **Use a REAL email** (we're connecting to live Supabase)

2. Enter any **password** (demo mode accepts any password)
   - Example: `TestPassword123!`

3. Click **Sign In**

4. **Watch the console** (F12 → Console tab):
   - You should see: `✅ Demo mode sign-in successful: [your-email]`
   - OR different console messages indicating live backend

5. Wait for the app to load (10-15 seconds)

✅ **Checkpoint**: You're logged in and see the Dashboard

---

## Phase 2: Profile Customization

### Step 2.1: Navigate to Settings

1. Click the **⚙️ Settings icon** (bottom left of sidebar)
   - Or go to the hamburger menu if on mobile

2. You should see multiple tabs:
   - Company
   - **My Profile** ← Click this
   - Integrations
   - Notifications
   - Security
   - Billing
   - API Access

✅ **Checkpoint**: Settings page loads

---

### Step 2.2: Update Your Profile Information

**Goal**: Test profile editing in live backend

1. In the **My Profile** tab, you should see:
   - Your avatar (circle with initials)
   - Your email
   - Edit Profile button

2. Click **Edit Profile**

3. Fill in your information:
   - **First Name**: `John` (or your name)
   - **Last Name**: `Tester`

4. Click **Save Changes**

5. You should see a **toast notification** (green popup): "Profile updated successfully"

✅ **Checkpoint**: Profile name saved

---

### Step 2.3: Upload Avatar (Profile Photo)

**Goal**: Test file upload to live Supabase storage

1. In **My Profile** tab, find the avatar circle at the top

2. **Hover over the avatar** and click the 📸 **camera icon**

3. A file picker opens. Select any **image file** from your computer
   - JPG, PNG, GIF, or WebP (under 2MB)
   - If you don't have an image, use any screenshot or download one

4. **Wait for upload** (10-15 seconds)

5. You should see:
   - Loading spinner briefly
   - **Toast notification**: "Avatar saved using compatibility mode"
   - Avatar now shows your uploaded image

✅ **Checkpoint**: Avatar uploaded and visible

---

### Step 2.4: Update Avatar URL (Alternative)

**Goal**: Test saving image URLs

1. In **My Profile** tab, find the **"Or paste profile image URL"** field

2. Enter an image URL:
   - Example: `https://via.placeholder.com/150`

3. Click **Save URL**

4. Verify the avatar updates

✅ **Checkpoint**: URL-based avatar works

---

## Phase 3: Company Settings

### Step 3.1: Navigate to Company Tab

1. In Settings, click the **Company** tab (first tab)

2. You should see:
   - Company logo (large card)
   - Company name, phone, email, website, address fields
   - Lead sources section

✅ **Checkpoint**: Company settings load

---

### Step 3.2: Update Company Information

**Goal**: Test company data persistence in Supabase

1. Update the following fields:

   | Field | Example Value |
   |-------|---|
   | **Company Name** | `TrussCTR Testing - [Your Name]` |
   | **Business Phone** | `(555) 987-6543` |
   | **Business Email** | `test@trussctr.com` |
   | **Website** | `https://test-trussctr.com` |
   | **Address** | `456 Test St, Dallas, TX 75201` |

2. Click **Save Changes** (blue button)

3. Verify **toast notification**: "Company profile saved successfully!"

✅ **Checkpoint**: Company data saved

---

### Step 3.3: Upload Company Logo

**Goal**: Test logo upload to Supabase storage

1. Find the **company logo section** (top of Company tab)

2. **Hover over the logo** and click the 📤 **upload icon**

3. Select an image file from your computer (any PNG, JPG, GIF, or WebP under 5MB)

4. **Wait for upload** (15-30 seconds)

5. You should see a **green notification**: "Logo uploaded and saved successfully"
   - OR "Logo saved using compatibility mode" (also valid)

6. Verify the logo appears in the preview box

✅ **Checkpoint**: Company logo uploaded

---

### Step 3.4: Save Company Logo via URL

1. Find the **"Or paste logo image URL"** field

2. Enter a logo URL:
   - Example: `https://via.placeholder.com/200?text=TrussCTR`

3. Click **Save URL**

4. Verify the logo updates

✅ **Checkpoint**: URL-based logo works

---

## Phase 4: The Critical Test – Data Persistence

### Step 4.1: Log Out Completely

**Goal**: Verify all data was saved to Supabase (not just browser cache)

1. Go to **Settings → Security** tab

2. Scroll down to the **Session** section

3. Click **Log out** (red button)

4. **Confirm** the log out action if prompted

5. You should be back at the **login page**

6. **Close this browser tab completely** (don't just navigate away)

✅ **Checkpoint**: Logged out and app cleared

---

### Step 4.2: The Real Test – Log Back In

**THIS IS THE CRITICAL TEST** – If data persists, everything works correctly!

1. Open a **NEW incognito window** (fresh session, zero cache)

2. Navigate to: **https://614restore.github.io/crm-kanban-integrate/**

3. Sign in with the **SAME email** you used before

4. Wait for app to load

5. **Immediately check**:
   - ❓ Do you see your **profile first name and last name**?
   - ❓ Do you see your **avatar photo**?
   - ❓ Is there a company logo visible on the dashboard?

6. Go to **Settings → My Profile**:
   - ✅ Your first/last name should be there
   - ✅ Your avatar should be loaded

7. Go to **Settings → Company**:
   - ✅ All company details should match what you entered
   - ✅ Company logo should be visible
   - ✅ Company name should show your updated value

---

## ✅ Success Scenarios

### All Data Persisted ✅ (Best Case)
```
Login → Profile name visible
       → Avatar photo loaded
       → Company name correct
       → Company logo visible
       → All settings match previous session
```
**Result**: Everything is working perfectly with **LIVE Supabase backend**

---

### Partial Data (Some Persists) ⚠️ (Demo Mode)
```
Login → Profile name visible
       → Avatar shows as DATA URL (not full URL)
       → Company data present but logo might be placeholder
```
**Result**: Using demo fallback, but data still persists

---

## Phase 5: Additional Testing

### Test 5.1: Check Console for Backend Confirmation

**Goal**: Verify which backend is active

1. Press **F12** to open DevTools

2. Go to **Console** tab

3. You should see messages like:
   - `✅ TrussCTR CRM Service Worker loaded`
   - `✅ Service worker registered successfully`
   - Either:
     - `🚧 Running in DEMO MODE` (offline fallback)
     - OR nothing about demo mode = **LIVE BACKEND** ✅

4. Try typing in console:
   ```javascript
   localStorage.getItem('demo_mode')
   ```
   - Result: `null` or `undefined` = **Live backend** ✅
   - Result: `true` = Demo mode with fallback

✅ **Checkpoint**: Confirmed which backend is active

---

### Test 5.2: Test Integrations Tab

**Goal**: Verify all integrations are available

1. Go to **Settings → Integrations**

2. You should see 8 integration cards:

| Integration | Status | Purpose |
|---|---|---|
| **QuickBooks** | Connect | Accounting sync |
| **Twilio** | Connect | SMS messages |
| **Google Calendar** | Manage | Appointments |
| **EagleView** | Connect | Roof measurements |
| **Stripe** | Connect | Payments |
| **DocuSign** | Connect | E-signatures |
| **ScopeMGR** | Manage | Field photos |
| **Zapier** | Connect | 5,000+ apps |

3. Click **Connect** on one integration (opens new tab)

4. You should be directed to the integration's sign-up/login page

✅ **Checkpoint**: Integration links work

---

### Test 5.3: Test Notifications Settings

1. Go to **Settings → Notifications**

2. You should see checkboxes for:
   - Email notifications (New leads, estimate changes, etc.)
   - SMS notifications

3. Toggle a few checkboxes

4. Click outside or try another tab

5. Go back to Notifications → verify your changes are still there

✅ **Checkpoint**: Settings preference saves

---

### Test 5.4: Test API Access Tab

1. Go to **Settings → API Access**

2. You should see:
   - **API Keys** section with production and test keys
   - **Webhooks** section for event notifications
   - Links to API documentation

3. Click **Copy** on an API key (in demo mode, shows masked version)

4. All UI elements should be interactive

✅ **Checkpoint**: API tab fully rendered

---

## Phase 6: Dashboard Features

### Test 6.1: Navigation and Sidebar

1. Click **Dashboard** (top of app or in sidebar)

2. You should see:
   - Overview cards with stats
   - Charts and graphs
   - Recent activity
   - Quick access buttons

3. Click different sidebar items:
   - **Contacts** → See contact management
   - **Appointments** → See calendar
   - **Invoices** → See invoice management
   - **Communications** → See messages
   - **Projects** → See project list
   - **Analytics** → See reports

✅ **Checkpoint**: All navigation works

---

### Test 6.2: Quick Add Modal

1. Look for **+ New** button (usually in top right or sidebar)

2. Click it

3. A modal should appear with quick add options:
   - New Contact
   - New Appointment
   - New Invoice
   - New Communication

4. Click one to add a new item (test the feature)

✅ **Checkpoint**: Quick add works

---

## 📊 Final Verification Checklist

Go through this checklist to confirm everything works:

### Authentication ✓
- [ ] Can sign in with email/password
- [ ] Can sign up with new email
- [ ] Session persists on page reload
- [ ] Can log out successfully

### Profile Management ✓
- [ ] Can edit first/last name
- [ ] Can upload profile avatar (file)
- [ ] Can set avatar via URL
- [ ] Profile data loads on login

### Company Settings ✓
- [ ] Can edit all company fields
- [ ] Can upload company logo (file)
- [ ] Can set logo via URL
- [ ] Company data loads on login
- [ ] Logo displays correctly

### Data Persistence ✓
- [ ] After logout, data still visible on login with same email
- [ ] No "demo mode" warnings in console (unless intentional)
- [ ] Settings survive page refresh
- [ ] Settings survive browser close/reopen

### Integrations ✓
- [ ] All 8 integrations display
- [ ] Integration links open correctly
- [ ] Can toggle notifications
- [ ] API tab shows keys

### Performance ✓
- [ ] App loads in <5 seconds
- [ ] Uploads complete in <30 seconds
- [ ] No console errors (warnings OK)
- [ ] UI is responsive (no freezing)

---

## 🎯 Expected Results

### ✅ If Everything Works
- Profile and company data persist across sessions
- Avatar and logo uploads work
- All UI features are functional
- Console shows no critical errors
- App feels smooth and responsive

**Conclusion**: App is production-ready with live Supabase backend! 🚀

---

### ⚠️ If Something Fails
- **Avatar upload fails**: Check file size (<2MB) and format (JPG/PNG)
- **Data doesn't persist**: May still be in demo mode (check console)
- **Logo not visible**: Might need to clearing cache again or refresh
- **Integration links broken**: Check internet connection
- **Console errors**: Screenshot and report them

---

## 🔧 Troubleshooting

### Issue: "Upload failed: Demo mode - use local data URL"

**Solution**: This is expected! It means:
1. App is running in demo mode (no live Supabase configured)
2. Data saves locally instead (still works!)
3. This is fine for testing

### Issue: Profile data won't save

**Solution**:
1. Check internet connection
2. Open DevTools (F12) → Network tab
3. Try saving again and watch for network errors
4. If errors appear, screenshot and share them

### Issue: Avatar won't upload despite being under 2MB

**Solution**:
1. Make sure file is actually JPG, PNG, GIF, or WebP
2. Try a different image
3. Check console (F12) for specific error message
4. Try uploading via URL instead

### Issue: Data disappears after logout

**Solution**:
1. Make sure you logged out completely (not just navigated away)
2. Open new incognito/private window
3. Sign in with SAME email (case-sensitive)
4. Wait 5-10 seconds for data to load
5. Refresh page if still missing

---

## 📞 Testing Complete!

If you've completed all phases and checkboxes are checked, **the app is working correctly!**

### What You've Verified:
✅ Real Supabase backend active  
✅ User authentication working  
✅ File uploads functional  
✅ Data persistence across sessions  
✅ All UI features responsive  
✅ Integrations available  

---

## 🚀 Next Steps

- **Share the app** with colleagues to test
- **Report any issues** with detailed console logs
- **Configure your own Supabase project** (optional, for custom backend)
- **Deploy to production** when ready

---

**Happy testing! 🎉**

Questions? Check the console logs (F12) or review the documentation in the repository.
