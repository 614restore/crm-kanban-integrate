import { createClient } from '@supabase/supabase-js';

// Environment variable configuration - REQUIRED FOR SECURITY
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';

// Demo mode check - allows offline development
if (demoMode) {
  console.log('🚧 Running in DEMO MODE - using mock data instead of Supabase');
}

// Validate required environment variables (unless in demo mode)
if (!demoMode && (!supabaseUrl || !supabaseKey)) {
  throw new Error(
    'Missing Supabase configuration. Please check your environment variables:\n' +
    '- VITE_SUPABASE_URL\n' +
    '- VITE_SUPABASE_ANON_KEY\n\n' +
    'Copy .env.example to .env.local and configure your Supabase credentials.\n' +
    'Or set VITE_DEMO_MODE=true for offline development.'
  );
}

// Security check: Ensure we're not using placeholder values (unless in demo mode)
if (!demoMode && (supabaseUrl?.includes('your-project') || supabaseKey?.includes('your-anon-key'))) {
  throw new Error(
    'Placeholder values detected in environment variables. Please configure real Supabase credentials in your .env.local file.'
  );
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
