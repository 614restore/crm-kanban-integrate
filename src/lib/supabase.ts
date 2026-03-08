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

const isLocalHost =
  typeof window !== 'undefined'
    ? ['localhost', '127.0.0.1'].includes(window.location.hostname)
    : true;

// Only auto-fallback to demo mode in local development.
// In production, require explicit VITE_DEMO_MODE=true to prevent silent fake-data sessions.
const shouldAutoFallbackToDemo = isLocalHost && (hasMissingConfig || hasPlaceholderConfig);
const demoMode = configuredDemoMode || shouldAutoFallbackToDemo;

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
} else if (hasMissingConfig || hasPlaceholderConfig) {
  console.error(
    '❌ Supabase config is missing/placeholder in a non-local environment. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for production builds.'
  );
}

const supabase = createClient(
  supabaseUrl || 'https://demo.supabase.co', 
  supabaseKey || 'demo-key', 
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // hash routing on GH Pages conflicts with URL session detection
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: 'sb-auth-token',
      flowType: 'pkce',
    },
    global: {
      fetch: async (input, init) => {
        const timeoutMs = 15000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const externalSignal = init?.signal;
        const onAbort = () => controller.abort();

        if (externalSignal) {
          if (externalSignal.aborted) {
            clearTimeout(timeoutId);
            throw new Error(`Supabase request aborted before start`);
          }
          externalSignal.addEventListener('abort', onAbort, { once: true });
        }

        try {
          return await fetch(input, {
            ...init,
            signal: controller.signal,
          });
        } catch (error) {
          if (controller.signal.aborted) {
            throw new Error(`Supabase request timed out after ${Math.round(timeoutMs / 1000)}s`);
          }
          throw error;
        } finally {
          clearTimeout(timeoutId);
          if (externalSignal) {
            externalSignal.removeEventListener('abort', onAbort);
          }
        }
      },
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
