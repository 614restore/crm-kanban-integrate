import { createClient } from '@supabase/supabase-js';

const projectUrl = 'https://qgvuzrvpyyrrulhwlzma.supabase.co';
const projectAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFndnV6cnZweXlycnVsaHdsem1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzOTU0OTksImV4cCI6MjA4Njk3MTQ5OX0.kQVOflThF52iRCl-VApsGZFwzSMJXdvocIa-7y0NX8M';

const configuredUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const configuredKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const urlLooksLegacy = !!configuredUrl && configuredUrl.includes('databasepad.com');
const keyLooksLegacy = !!configuredKey && configuredKey.includes('aixvqeyviciiehxegtby');

// Guardrail: force known-good Supabase project when stale legacy env values are present.
const supabaseUrl = !configuredUrl || urlLooksLegacy ? projectUrl : configuredUrl;
const supabaseKey = !configuredKey || keyLooksLegacy ? projectAnonKey : configuredKey;

if (urlLooksLegacy || keyLooksLegacy) {
  console.warn('Legacy backend config detected in env; using Supabase project defaults.');
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration. Please check your environment values.');
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

export { supabase };
