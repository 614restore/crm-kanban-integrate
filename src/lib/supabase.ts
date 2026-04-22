import { createClient } from '@supabase/supabase-js';

// Capture recovery token from query string (PKCE flow) or hash (implicit flow)
// BEFORE Supabase processes it, so we can show the reset form immediately
if (typeof window !== 'undefined') {
  try {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    // PKCE flow: ?code=...&type=recovery  OR  Supabase adds type to the redirect_to
    // Implicit flow: #access_token=...&type=recovery
    if (params.get('type') === 'recovery' || hash.includes('type=recovery')) {
      sessionStorage.setItem('pending_password_reset', 'true');
    }
    
    // Clear any stale auth fragments that might cause hangs
    if (params.has('code') || params.has('access_token') || hash.includes('access_token')) {
      // Set a flag to clean URL after auth completes
      sessionStorage.setItem('auth_url_cleanup_pending', 'true');
      
      // Auto-cleanup after 10 seconds if auth doesn't complete
      setTimeout(() => {
        try {
          if (sessionStorage.getItem('auth_url_cleanup_pending') === 'true') {
            sessionStorage.removeItem('auth_url_cleanup_pending');
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, '', cleanUrl);
          }
        } catch { /* ignore */ }
      }, 10000);
    }
  } catch (e) { console.warn('[supabase] Could not parse recovery URL params:', e); }
}

// Environment variable configuration - REQUIRED FOR SECURITY
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const configuredDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

const hasMissingConfig = !supabaseUrl || !supabaseKey;
const hasPlaceholderConfig =
  supabaseUrl?.includes('your-project') || supabaseKey?.includes('your-anon-key');

const demoMode = configuredDemoMode || hasMissingConfig || hasPlaceholderConfig;

// Demo mode check - allows offline development
if (demoMode) {
  if (hasMissingConfig) {
    console.warn(
      '🚧 Running in DEMO MODE: missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable live backend.'
    );
  } else if (hasPlaceholderConfig) {
    console.warn(
      '🚧 Running in DEMO MODE: placeholder Supabase config detected. Configure real credentials to enable live backend.'
    );
  }
}

const supabase = createClient(
  supabaseUrl || 'https://demo.supabase.co', 
  supabaseKey || 'demo-key', 
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: 'sb-auth-token',
      flowType: 'pkce',
    },
    global: {
      headers: {
        'x-client-info': 'crm-kanban-app',
      },
    },
    db: {
      schema: 'public',
    },
  }
);

// Session-free client used only for the login call — prevents stale token
// refresh on the main client from blocking sign-in attempts.
const loginClient = createClient(
  supabaseUrl || 'https://demo.supabase.co',
  supabaseKey || 'demo-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      storageKey: 'sb-login-tmp',
    },
  }
);

// Export demo mode flag for other components to check
export const isDemoMode = demoMode;

export { supabase, supabaseUrl, supabaseKey, loginClient };
