import { createClient } from '@supabase/supabase-js';

// Environment variable configuration - REQUIRED FOR SECURITY
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate required environment variables
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase configuration. Please check your environment variables:\n' +
    '- VITE_SUPABASE_URL\n' +
    '- VITE_SUPABASE_ANON_KEY\n\n' +
    'Copy .env.example to .env.local and configure your Supabase credentials.'
  );
}

// Security check: Ensure we're not using placeholder values
if (supabaseUrl.includes('your-project') || supabaseKey.includes('your-anon-key')) {
  throw new Error(
    'Placeholder values detected in environment variables. Please configure real Supabase credentials in your .env.local file.'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
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
});

export { supabase, supabaseUrl, supabaseKey };
