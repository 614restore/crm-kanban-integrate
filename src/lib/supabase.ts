import { createClient } from '@supabase/supabase-js';

// Environment variable configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const configuredDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

const hasMissingConfig = !supabaseUrl || !supabaseKey;
const hasPlaceholderConfig =
  supabaseUrl?.includes('your-project') || supabaseKey?.includes('your-anon-key');

const demoMode = configuredDemoMode || hasMissingConfig || hasPlaceholderConfig;

if (demoMode) {
  if (hasMissingConfig) {
    console.warn('🚧 Running in DEMO MODE: missing Supabase config.');
  } else if (hasPlaceholderConfig) {
    console.warn('🚧 Running in DEMO MODE: placeholder Supabase config detected.');
  }
}

// Safe localStorage wrapper — falls back to in-memory if storage is unavailable
// (private browsing on some iOS versions can throw on storage writes)
const safeStorage = (() => {
  if (typeof window === 'undefined') return undefined;
  try {
    window.localStorage.setItem('__sb_storage_test__', '1');
    window.localStorage.removeItem('__sb_storage_test__');
    return window.localStorage;
  } catch {
    // Fall back to in-memory storage (session-only — lost on tab close)
    const mem: Record<string, string> = {};
    return {
      getItem: (key: string) => mem[key] ?? null,
      setItem: (key: string, value: string) => { mem[key] = value; },
      removeItem: (key: string) => { delete mem[key]; },
    };
  }
})();

const supabase = createClient(
  supabaseUrl || 'https://demo.supabase.co',
  supabaseKey || 'demo-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: safeStorage,
      flowType: 'implicit',
    },
    db: {
      schema: 'public',
    },
  }
);

export const isDemoMode = demoMode;
export { supabase, supabaseUrl, supabaseKey };
