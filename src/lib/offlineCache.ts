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

// Export for use in components
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
