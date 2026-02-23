import { createClient } from '@supabase/supabase-js';

// Use environment variables with fallback to hardcoded values for development
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aixvqeyviciiehxegtby.databasepad.com';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjZhYTE1YWNiLTkwOTItNDdlOS1iZGY3LTVlNWUzNGIzMjAzNSJ9.eyJwcm9qZWN0SWQiOiJhaXh2cWV5dmljaWllaHhlZ3RieSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzcxNzE3OTY1LCJleHAiOjIwODcwNzc5NjUsImlzcyI6ImZhbW91cy5kYXRhYmFzZXBhZCIsImF1ZCI6ImZhbW91cy5jbGllbnRzIn0.DQi8xUGzvj6168-e2B2sDUWu9hYadi62LHhNF3AnGns';

// Validate configuration
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration. Please check your .env file.');
}

// Initialize Supabase client with lock configuration to prevent timeouts
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Fix LockManager timeout issues
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'sb-auth-token',
    flowType: 'pkce',
  },
  // Increase global timeout to prevent lock timeout errors
  global: {
    headers: {
      'x-client-info': 'crm-kanban-app',
    },
  },
  db: {
    schema: 'public',
  },
});

export { supabase };
