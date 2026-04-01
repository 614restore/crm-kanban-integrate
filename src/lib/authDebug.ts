// Auth debugging utilities
export function logAuthState() {
  if (typeof window === 'undefined') return;
  
  console.group('🔍 Auth Debug Info');
  
  try {
    // Check URL parameters
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    console.log('URL params:', Object.fromEntries(params.entries()));
    console.log('URL hash:', hash);
    
    // Check session storage
    console.log('Session storage keys:', Object.keys(sessionStorage));
    console.log('pending_password_reset:', sessionStorage.getItem('pending_password_reset'));
    console.log('auth_url_cleanup_pending:', sessionStorage.getItem('auth_url_cleanup_pending'));
    
    // Check local storage for auth token
    const authKeys = Object.keys(localStorage).filter(k => k.includes('auth') || k.includes('supabase'));
    console.log('Auth-related localStorage keys:', authKeys);
    
    // Check for stuck auth state
    const sbAuthToken = localStorage.getItem('sb-auth-token');
    if (sbAuthToken) {
      try {
        const parsed = JSON.parse(sbAuthToken);
        console.log('Auth token exists, expires_at:', new Date(parsed.expires_at * 1000).toISOString());
      } catch {
        console.log('Auth token exists but could not parse');
      }
    } else {
      console.log('No auth token found');
    }
  } catch (e) {
    console.error('Error reading auth state:', e);
  }
  
  console.groupEnd();
}

export function clearStuckAuthState() {
  if (typeof window === 'undefined') return;
  
  console.log('🧹 Clearing potentially stuck auth state...');
  
  try {
    sessionStorage.removeItem('pending_password_reset');
    sessionStorage.removeItem('auth_url_cleanup_pending');
    
    // Clean URL
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);
    
    console.log('✅ Auth state cleared');
  } catch (e) {
    console.error('❌ Failed to clear auth state:', e);
  }
}
