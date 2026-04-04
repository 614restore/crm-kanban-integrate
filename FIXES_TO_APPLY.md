# Pipeline Status Fix + Desktop Offline Cache

**Issue 1:** Contact shows "Inspection Complete" but Pipeline Progress shows "New Lead"  
**Issue 2:** Desktop app needs contacts cached for offline access

---

## Fix 1: Pipeline Status Mapping

### File: `src/components/crm/PipelineStageTracker.tsx`

**Find this section (around line 69):**

```typescript
export function PipelineStageTracker({ currentStatus, statusChangedAt, inspectionCompleted }: PipelineStageTrackerProps) {
  // Map status to pipeline equivalent
  const mappedStatus = STATUS_MAPPING[currentStatus] || currentStatus;
```

**Replace with:**

```typescript
export function PipelineStageTracker({ currentStatus, statusChangedAt, inspectionCompleted }: PipelineStageTrackerProps) {
  // Normalize status to lowercase for case-insensitive mapping
  const normalizedStatus = currentStatus.toLowerCase().replace(/\s+/g, '_');
  
  // Map status to pipeline equivalent (try both original and normalized)
  const mappedStatus = STATUS_MAPPING[currentStatus] || STATUS_MAPPING[normalizedStatus] || currentStatus;
```

**Then find (around line 82):**

```typescript
  // CRITICAL FIX: If status not found in pipeline, default to first stage instead of -1
  if (currentStageIndex === -1) {
    console.warn(`[PipelineStageTracker] Status "${currentStatus}" (effective: "${effectiveStatus}") not found in pipeline stages. Defaulting to first stage.`);
    currentStageIndex = 0; // Default to "New Lead" instead of breaking the UI
  }
```

**Replace with:**

```typescript
  // CRITICAL FIX: If status not found in pipeline, try to guess the best stage
  if (currentStageIndex === -1) {
    console.group('🔍 PipelineStageTracker: Status Not Found');
    console.log('Original status:', currentStatus);
    console.log('Normalized status:', normalizedStatus);
    console.log('Mapped status:', mappedStatus);
    console.log('Effective status:', effectiveStatus);
    console.log('inspectionCompleted flag:', inspectionCompleted);
    
    // Try to guess stage based on keywords in status
    const statusLower = effectiveStatus.toLowerCase();
    if (statusLower.includes('inspection') && (statusLower.includes('complet') || statusLower.includes('done'))) {
      currentStageIndex = 3; // inspection_completed stage
      console.log('✅ Matched to stage 3 (Inspection Done) via keyword detection');
    } else if (statusLower.includes('estimat')) {
      currentStageIndex = 4; // estimating stage
      console.log('✅ Matched to stage 4 (Creating Estimate) via keyword detection');
    } else if (statusLower.includes('appt') || statusLower.includes('appointment')) {
      currentStageIndex = 2; // appt_set stage
      console.log('✅ Matched to stage 2 (Appointment Set) via keyword detection');
    } else {
      currentStageIndex = 0; // Default to "New Lead"
      console.log('⚠️ No match found, defaulting to stage 0 (New Lead)');
    }
    console.groupEnd();
  }
```

**And add these mappings (around line 35-60):**

```typescript
const STATUS_MAPPING: Record<string, CustomerStatus> = {
  // Lead variants
  'new_lead':             'prospect',
  'contacted':            'lead',

  // Appointment variants
  'appointment_set':      'appt_set',
  'inspection_scheduled': 'appt_set',

  // Inspection variants - ADD THESE:
  'inspection_complete':  'inspection_completed',
  'inspection_completed': 'inspection_completed',
  'inspected':            'inspection_completed',
  'inspection done':      'inspection_completed',
  'inspection_done':      'inspection_completed',

  // Estimate / signed variants
  'estimate_sent':        'estimate_sent',
  'signed_won':           'signed',
  'signed':               'signed',

  // Insurance-specific stages
  'retail':               'estimate_sent',
  'claim_filed':          'appt_set',
  'adjuster_scheduled':   'inspection_completed',
  'supplement_filed':     'estimating',

  // End-state variants
  'paid':                 'completed',
  'payment_received':     'completed',
};
```

---

## Fix 2: Desktop Offline Cache

### Create new file: `src/lib/offlineCache.ts`

```typescript
// Offline Cache for Desktop App
// Ensures contacts and data stay loaded even when offline

import { Contact } from './crmData';

const CACHE_VERSION = 'v1';
const CACHE_KEYS = {
  contacts: `crm_contacts_${CACHE_VERSION}`,
  lastSync: `crm_last_sync_${CACHE_VERSION}`,
  userProfile: `crm_user_profile_${CACHE_VERSION}`,
  companyId: `crm_company_id_${CACHE_VERSION}`,
} as const;

// Check if we're running in Tauri (desktop app)
export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

// Save contacts to localStorage (desktop persistent cache)
export function cacheContacts(contacts: Contact[]): void {
  try {
    localStorage.setItem(CACHE_KEYS.contacts, JSON.stringify(contacts));
    localStorage.setItem(CACHE_KEYS.lastSync, new Date().toISOString());
    console.log(`[OfflineCache] Cached ${contacts.length} contacts`);
  } catch (error) {
    console.error('[OfflineCache] Failed to cache contacts:', error);
  }
}

// Load contacts from localStorage
export function getCachedContacts(): Contact[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.contacts);
    if (!cached) return null;
    
    const contacts = JSON.parse(cached) as Contact[];
    const lastSync = localStorage.getItem(CACHE_KEYS.lastSync);
    
    console.log(`[OfflineCache] Loaded ${contacts.length} contacts from cache (last sync: ${lastSync})`);
    return contacts;
  } catch (error) {
    console.error('[OfflineCache] Failed to load cached contacts:', error);
    return null;
  }
}

// Cache user profile
export function cacheUserProfile(profile: { id: string; email: string; firstName?: string; lastName?: string }): void {
  try {
    localStorage.setItem(CACHE_KEYS.userProfile, JSON.stringify(profile));
  } catch (error) {
    console.error('[OfflineCache] Failed to cache user profile:', error);
  }
}

// Get cached user profile
export function getCachedUserProfile() {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.userProfile);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('[OfflineCache] Failed to load cached user profile:', error);
    return null;
  }
}

// Cache company ID
export function cacheCompanyId(companyId: string): void {
  try {
    localStorage.setItem(CACHE_KEYS.companyId, companyId);
  } catch (error) {
    console.error('[OfflineCache] Failed to cache company ID:', error);
  }
}

// Get cached company ID
export function getCachedCompanyId(): string | null {
  try {
    return localStorage.getItem(CACHE_KEYS.companyId);
  } catch (error) {
    console.error('[OfflineCache] Failed to load cached company ID:', error);
    return null;
  }
}

// Clear all cache
export function clearCache(): void {
  try {
    Object.values(CACHE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    console.log('[OfflineCache] Cache cleared');
  } catch (error) {
    console.error('[OfflineCache] Failed to clear cache:', error);
  }
}

// Get last sync time
export function getLastSyncTime(): Date | null {
  try {
    const lastSync = localStorage.getItem(CACHE_KEYS.lastSync);
    return lastSync ? new Date(lastSync) : null;
  } catch (error) {
    console.error('[OfflineCache] Failed to get last sync time:', error);
    return null;
  }
}

// Check if cache is stale (older than 1 hour)
export function isCacheStale(): boolean {
  const lastSync = getLastSyncTime();
  if (!lastSync) return true;
  
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return lastSync < oneHourAgo;
}

export const offlineCache = {
  isDesktopApp,
  cacheContacts,
  getCachedContacts,
  cacheUserProfile,
  getCachedUserProfile,
  cacheCompanyId,
  getCachedCompanyId,
  clearCache,
  getLastSyncTime,
  isCacheStale,
};
```

---

## Fix 3: Integrate Offline Cache

### File: `src/components/crm/ContactList.tsx`

**Add import at top:**

```typescript
import { offlineCache } from '@/lib/offlineCache';
```

**Find where contacts are loaded (in useEffect), add caching:**

```typescript
useEffect(() => {
  async function loadContacts() {
    try {
      setLoading(true);
      
      // Try to load from cache first (desktop only)
      if (offlineCache.isDesktopApp()) {
        const cached = offlineCache.getCachedContacts();
        if (cached && cached.length > 0) {
          console.log('[Desktop] Using cached contacts while fetching fresh data');
          // Use cached data immediately (prevents blank screen)
          setContacts(cached);
        }
      }
      
      // Fetch fresh data from server
      const freshContacts = await db.getContacts(companyId);
      setContacts(freshContacts);
      
      // Cache for offline use (desktop only)
      if (offlineCache.isDesktopApp()) {
        offlineCache.cacheContacts(freshContacts);
      }
      
    } catch (error) {
      console.error('Failed to load contacts:', error);
      
      // If online fetch fails, use cache (desktop only)
      if (offlineCache.isDesktopApp()) {
        const cached = offlineCache.getCachedContacts();
        if (cached) {
          console.warn('[Desktop] Using cached contacts (offline mode)');
          setContacts(cached);
          toast.warning('Offline mode - showing cached data');
        }
      }
    } finally {
      setLoading(false);
    }
  }
  
  loadContacts();
}, [companyId]);
```

---

## Testing

### Test Pipeline Fix:

1. Open desktop app
2. Open browser console (Cmd+Option+I on Mac)
3. Navigate to Mary J Caldwell contact
4. Look at console logs - should see:
   ```
   ✅ Matched to stage 3 (Inspection Done) via keyword detection
   ```
5. Pipeline Progress should now show "Inspection Done" instead of "New Lead"

### Test Offline Cache:

1. Open desktop app
2. Load contacts (should see in console):
   ```
   [OfflineCache] Cached 50 contacts
   ```
3. Close and reopen desktop app
4. Should see immediately (even before server loads):
   ```
   [Desktop] Using cached contacts while fetching fresh data
   [OfflineCache] Loaded 50 contacts from cache
   ```
5. Turn off WiFi
6. Reload contacts
7. Should see:
   ```
   [Desktop] Using cached contacts (offline mode)
   ```
   And toast message: "Offline mode - showing cached data"

---

## Commit & Deploy

### After making changes:

```bash
# Commit fixes on main branch
git add src/components/crm/PipelineStageTracker.tsx
git add src/lib/offlineCache.ts
git add src/components/crm/ContactList.tsx
git commit -m "Fix pipeline status mapping and add desktop offline cache

- Added case-insensitive status mapping for pipeline tracker
- Added keyword-based fallback matching for unmapped statuses
- Created offline cache system for desktop app
- Contacts now persist in localStorage on desktop
- Desktop app loads cached data immediately on startup
- Falls back to cache when offline

Fixes: Pipeline showing 'New Lead' for 'Inspection Complete' status
Fixes: Desktop app losing data on reload"

git push origin main
```

### Deploy to platforms:

**Web (Automatic):**
- Vercel auto-deploys from main branch
- Live in 1-2 minutes

**Desktop:**
```bash
git checkout desktop-tauri
git merge main
npm run tauri:dev
# Test the fixes work
git push origin desktop-tauri
```

**iOS:**
```bash
npx cap sync ios
npx cap open ios
# Build in Xcode
```

---

## Expected Results

✅ **Pipeline Progress:** Shows correct stage based on contact status  
✅ **Offline Desktop:** Contacts load instantly from cache  
✅ **Offline Mode:** Desktop works without internet connection  
✅ **Performance:** Faster load times on desktop (cache is instant)  

---

## Disk Space Issue

**You got "ENOSPC: no space left on device" error.**

**To fix:**

1. **Check disk space:**
   ```bash
   df -h
   ```

2. **Clear some space:**
   ```bash
   # Clear npm cache
   npm cache clean --force
   
   # Remove node_modules and reinstall
   rm -rf node_modules
   npm install
   
   # Clear Xcode derived data (if you have Xcode)
   rm -rf ~/Library/Developer/Xcode/DerivedData
   
   # Empty trash
   # Finder → Empty Trash
   ```

3. **Check what's using space:**
   ```bash
   du -sh * | sort -h
   ```

---

**After freeing up space, apply the fixes above manually by editing the files!**

*verified by vibecheck*
