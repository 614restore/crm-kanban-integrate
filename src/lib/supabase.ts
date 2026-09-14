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

// supabase-js coordinates auth token refresh with a Web Locks lock
// ("lock:sb-auth-token"). In some sessions that lock is acquired and never
// released, and then every subsequent write hangs forever waiting on it
// (reads that already ran are unaffected) — the "stuck on Saving..." bug.
// Replace it with an in-memory promise-chain lock: it still serializes token
// operations within this tab, but never touches navigator.locks, so it can
// never deadlock.
let authLockChain: Promise<unknown> = Promise.resolve();
const inMemoryAuthLock = <R,>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
  const run = authLockChain.then(() => fn());
  authLockChain = run.then(() => undefined, () => undefined);
  return run;
};

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
      lock: inMemoryAuthLock,
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
// Copied from QuoteMGR src/lib/supabase.ts: used by the copied quote screens.
type AbortableTask<T> = (signal: AbortSignal) => Promise<T>;

export const runWithTimeout = <T>(
  task: AbortableTask<T>,
  timeoutMs = 12000
): Promise<T> => {
  // Pass a signal for API compatibility (callers call .abortSignal(signal))
  // but the signal is never fired — requests run to completion in the background.
  const controller = new AbortController();
  // Wrap in Promise.resolve() so we always have a full Promise — not just a
  // PromiseLike. The @supabase/postgrest-js builder implements PromiseLike
  // (only .then(), no .catch()), so calling .catch() on it directly throws
  // "r.catch is not a function". Promise.resolve() normalises any PromiseLike
  // into a real Promise with both .then() and .catch().
  const taskPromise = Promise.resolve(task(controller.signal));

  // Prevent an unhandled rejection if the timeout wins and the task later fails.
  taskPromise.catch(() => undefined);

  return new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      const err = new Error('The operation was aborted.');
      err.name = 'AbortError';
      reject(err);
    }, timeoutMs);

    taskPromise.then(
      (value) => { globalThis.clearTimeout(timeoutId); resolve(value); },
      (error) => { globalThis.clearTimeout(timeoutId); reject(error); },
    );
  });
};

export const isDemoMode = demoMode;

export { supabase, supabaseUrl, supabaseKey, loginClient };
