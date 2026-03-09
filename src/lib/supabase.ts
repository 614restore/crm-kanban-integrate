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
      // On Vercel (real paths), we must detect the session from the URL so that
      // email confirmation and password-reset links work. On GitHub Pages we use
      // hash routing, which conflicts with URL session detection — so we disable
      // it there by setting VITE_HASH_ROUTING=true in the GH Pages build.
      detectSessionInUrl: import.meta.env.VITE_HASH_ROUTING !== 'true',
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

// Export demo mode flag for other components to check
export const isDemoMode = demoMode;

export { supabase, supabaseUrl, supabaseKey };
