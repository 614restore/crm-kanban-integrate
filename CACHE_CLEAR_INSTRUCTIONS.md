# Browser Cache Issue - Quick Fix

## Problem
After the branding update and deployment, your profile info and team data aren't showing up.

## Root Cause
Browser cache is serving the old version of the app, causing data loading issues.

## Solution - Try these in order:

### 1. Hard Refresh (Try this first)
**Mac:** Press `Cmd + Shift + R`  
**Windows/Linux:** Press `Ctrl + Shift + F5`

### 2. Clear Site Data
1. Open browser DevTools (F12 or right-click > Inspect)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Click "Clear site data" or "Clear storage"
4. Refresh the page

### 3. Clear Browser Cache Completely
**Chrome:**
1. Go to Settings > Privacy and security > Clear browsing data
2. Select "Cached images and files"
3. Click "Clear data"
4. Go back to https://614restore.github.io/crm-kanban-integrate/

**Safari:**
1. Preferences > Advanced > Check "Show Develop menu"
2. Develop > Empty Caches
3. Reload the page

**Firefox:**
1. Settings > Privacy & Security > Clear Data
2. Check "Cached Web Content"
3. Click "Clear"

### 4. Check Console for Errors
1. Open DevTools (F12)
2. Go to **Console** tab
3. Look for any red error messages
4. Share the errors if you see any

### 5. Check if logged in
1. Make sure you're logged in with jeffrey@614restore.com
2. Try logging out and back in

### 6. Check Supabase Connection
The app connects to: `https://qgvuzrvpyyrrulhwlzma.supabase.co`

If you see errors about "Failed to fetch profile" or connection errors, it might be a Supabase issue.

## What Should You See After Clearing Cache
✅ "614 Restore" branding on login page  
✅ Your profile info (name, email, role)  
✅ Team members visible in Team section  
✅ Company name: 614 Restore (not TrussCTR)

## Still Not Working?
Let me know what errors you see in the browser console (F12 > Console tab).
