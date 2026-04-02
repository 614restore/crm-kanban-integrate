# Refresh Data Loss Issue - Analysis & Fix

**Date**: April 2, 2026  
**Issue**: Web app sometimes shows error or missing data on refresh until user logs out and back in

## Root Causes Identified

### 1. **Race Condition on Refresh**
When the page refreshes, there's a race between:
- `App.tsx` visibility handler (line 81-94) calling `supabase.auth.getSession()` and `queryClient.invalidateQueries()`
- `authContext.tsx` calling `getSession()` and `onAuthStateChange()` (lines 130-228)
- `AppLayout.tsx` data loading triggered by `profile.company_id` (line 947-951)

If auth session validation fails in `App.tsx` (line 85-86), it immediately signs the user out, causing data to disappear even though the session might still be valid.

### 2. **Aggressive Session Invalidation**
In `src/App.tsx` line 84-86:
```typescript
const { error } = await supabase.auth.getSession();
if (error) {
  await supabase.auth.signOut(); // ❌ Too aggressive!
}
```

This signs users out on ANY session error, including:
- Temporary network errors
- Rate limiting
- Supabase API hiccups

### 3. **Cache Issues on Visibility Change**
When tab becomes visible, `AppLayout.tsx` calls `requestSoftReload()` after 5+ minutes idle (line 960-982). However, if the auth session check fails, the data is cleared but no error is shown to the user.

### 4. **Missing Error Boundaries**
While there's an `ErrorBoundary` component, errors in data loading don't always trigger it because they're caught and silently handled in various try-catch blocks.

## The Fix

### Fix 1: Make Session Error Handling More Resilient
**File**: `src/App.tsx`

Change from aggressive sign-out to retry logic:

```typescript
useEffect(() => {
  const handleVisibilityChange = async () => {
    if (document.visibilityState === 'visible') {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        // Only sign out if there's no session AND no error
        // (error might be temporary network issue)
        if (!data?.session && !error) {
          await supabase.auth.signOut();
        } else if (!error) {
          // Session is valid, invalidate queries to refresh data
          queryClient.invalidateQueries();
        }
        // If there's an error, do nothing - let the user continue
        // Auth context will handle expired sessions via onAuthStateChange
      } catch (err) {
        console.warn('Session check failed on visibility change:', err);
        // Don't sign out on error - could be temporary
      }
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, []);
```

### Fix 2: Add Grace Period for Data Loading
**File**: `src/components/AppLayout.tsx`

The current timeout logic (line 996-1013) is good but could be improved:

```typescript
// Current: Fail-safe timeout at 45 seconds
// Issue: If loadData fails, it sets isLoading=false but might not set isInitialized=true

// Add to loadData catch block (around line 703):
catch (err) {
  console.error('loadData failed:', err);
  dispatch({ type: 'SET_LOADING', payload: false });
  dispatch({ type: 'SET_INITIALIZED', payload: true }); // ← ADD THIS
  // Show user-friendly error instead of blank screen
  toast.error('Failed to load data. Please refresh or contact support.');
}
```

### Fix 3: Better Cache Validation
**File**: `src/components/AppLayout.tsx` (around line 490)

Add cache invalidation check:

```typescript
const cached = !silent ? readDataCache(profile.company_id) : null;
if (cached) {
  // Validate cache isn't stale (older than 1 hour)
  const cacheAge = Date.now() - (cached.timestamp || 0);
  if (cacheAge < 60 * 60 * 1000) {
    dispatch({ type: 'INITIALIZE_DATA', payload: cached as any });
  } else {
    // Cache too old, clear it
    clearDataCache(profile.company_id);
  }
}
```

### Fix 4: Add Loading State Indicator
When data is being refreshed in background, show a subtle indicator instead of clearing the screen.

## Implementation Plan

1. ✅ **Immediate**: Update `App.tsx` session error handling (most critical)
2. ⏳ **High Priority**: Add cache timestamp validation
3. ⏳ **Medium**: Improve error handling in loadData
4. ⏳ **Low**: Add refresh indicator UI

## Testing Steps

After applying fixes:

1. **Test Normal Refresh**:
   - Load app with data
   - Hard refresh (Cmd+R / Ctrl+R)
   - Data should remain visible or reload smoothly

2. **Test Session Expiry**:
   - Load app
   - Wait for session to expire (or manually clear auth token)
   - Refresh page
   - Should show login screen, not blank screen or error

3. **Test Network Error**:
   - Load app
   - Disconnect internet
   - Refresh page
   - Should show cached data + offline indicator

4. **Test Idle Recovery**:
   - Load app
   - Switch tabs for 10+ minutes
   - Return to app
   - Data should refresh without clearing screen

## Quick Fix (Immediate)

For immediate relief, users can:
1. Keep the tab open (don't refresh)
2. If data disappears, close tab completely and reopen
3. Clear browser cache if issue persists: Settings → Clear browsing data → Cached images and files

## Related Files

- `src/App.tsx` - Main app visibility handler
- `src/lib/authContext.tsx` - Auth session management
- `src/components/AppLayout.tsx` - Data loading and caching
- `src/lib/database.ts` - Database queries

## Prevention

To prevent this in the future:
1. Add integration tests for page refresh scenarios
2. Monitor error logs for session errors
3. Add metrics for "blank screen on load" incidents
4. Consider adding a "Retry" button when data fails to load
