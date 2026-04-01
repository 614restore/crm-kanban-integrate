# WebSocket Connection Spam Fix

## Problem
WebSocket connection to Supabase Realtime was failing with "bad response from server" error, repeating 65+ times.

## Root Cause
In `src/components/AppLayout.tsx`, the `useEffect` that subscribes to Realtime had `loadData` and `requestSoftReload` in its dependency array:

```typescript
}, [profile?.company_id, loadData, requestSoftReload]);
```

Since these functions are recreated on every render, the effect re-ran constantly, creating new WebSocket subscriptions without properly cleaning up old ones. This caused 65+ simultaneous connections.

## Fix Applied
Changed the dependency array to only include `profile?.company_id`:

```typescript
}, [profile?.company_id]);
// eslint-disable-next-line react-hooks/exhaustive-deps
```

Now the subscription only re-initializes when the company_id changes (which is rare), not on every render.

## Result
- WebSocket connections will no longer spam
- Only 1 active Realtime connection per session
- Proper cleanup on unmount or company_id change

## Testing
1. Restart dev server: `npm run dev`
2. Open browser DevTools → Console
3. Look for WebSocket connection messages
4. Should see only 1 connection, not 65+

## Files Modified
- `src/components/AppLayout.tsx` - Fixed useEffect dependency array (line ~590)
