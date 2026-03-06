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
  } catch (_) { /* ignore */ }
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
      autoRefreshToken: !demoMode,
      persistSession: !demoMode,
      detectSessionInUrl: !demoMode,
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
