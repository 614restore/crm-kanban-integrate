import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase, supabaseUrl, isDemoMode, loginClient } from '@/lib/supabase';
import { setupNewUser } from '@/lib/setupCompany';
import type { Session, User } from '@supabase/supabase-js';
import { logAuthState } from '@/lib/authDebug';

export interface Profile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  company_id?: string;
  department?: string;
  phone?: string;
  avatar_url?: string;
  is_active?: boolean;
  must_change_password?: boolean;
  companies?: {
    id?: string;
    name?: string;
    logo_url?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
    email?: string;
    website?: string;
    subscription_plan?: string;
    subscription_status?: string;
    google_review_url?: string;
    [key: string]: any;
  };
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isPasswordReset: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, metadata?: { first_name?: string; last_name?: string; role?: string; company_id?: string; company_name?: string }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  clearPasswordReset: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecoverySession, setIsRecoverySession] = useState(false);

  // Shared promise ref — ensures only ONE profile fetch runs at a time no matter
  // how many callers race (getSession + onAuthStateChange on hard reload).
  const profileFetchPromise = useRef<Promise<Profile | null> | null>(null);

  // True when signed in via a Supabase recovery link OR a temp password
  const isPasswordReset = isRecoverySession || profile?.must_change_password === true;

  // ── Raw profile fetch (no dedup, no retry) ────────────────────────────
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      if (isDemoMode) {
        try {
          const stored = localStorage.getItem(`demo_profile_${userId}`);
          if (stored) return JSON.parse(stored) as Profile;
        } catch { /* ignore */ }
        return null;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) { console.error('Error fetching profile:', error); return null; }

      // Return profile immediately — company data is loaded asynchronously via
      // a separate useEffect below so it never blocks profile.company_id from
      // being available to loadData and the rest of the app.
      return data as Profile;
    } catch (err) {
      console.error('Error fetching profile:', err);
      return null;
    }
  };

  // ── Deduplicated, retrying profile loader ─────────────────────────────
  // Returns the same in-flight promise if called concurrently (fixes reload race).
  // Retries with faster backoff if company_id is missing (only happens for new users).
  const loadProfileOnce = (userId: string, email: string): Promise<Profile | null> => {
    if (profileFetchPromise.current) return profileFetchPromise.current;

    profileFetchPromise.current = (async () => {
      try {
        let profileData = await fetchProfile(userId);

        // Fast path: existing user with company_id — return immediately
        if (profileData?.company_id) {
          return profileData;
        }

        // Slow path: new user or missing company_id — retry with shorter delays
        if (profileData && !profileData.company_id) {
          for (const delay of [300, 500]) {
            await new Promise(r => setTimeout(r, delay));
            profileData = await fetchProfile(userId);
            if (profileData?.company_id) break;
          }
        }

        // Still no company — run first-time setup. On the shared backend someone who
        // signed up but never got a company has no profile row at all, so a missing
        // profile counts too. ensureUserHasCompany refuses if they already have one.
        if (!profileData?.company_id) {
          const ok = await setupNewUser(userId, email);
          if (ok) {
            await new Promise(r => setTimeout(r, 400));
            profileData = await fetchProfile(userId);
          }
          if (!profileData?.company_id) {
            console.error('[Auth] Company setup failed — user will see empty state.');
          }
        }

        return profileData;
      } finally {
        // Clear the shared promise so future sign-ins / refreshes work normally
        profileFetchPromise.current = null;
      }
    })();

    return profileFetchPromise.current;
  };

  useEffect(() => {
    // Log initial auth state for debugging
    if (import.meta.env.DEV) {
      logAuthState();
    }
    
    let recoveryEventFired = false;
    let pendingReset = (() => {
      try { return sessionStorage.getItem('pending_password_reset') === 'true'; } catch { return false; }
    })();

    // Re-check session when tab becomes visible (fixes stale state after idle)
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session?.user) return;
        setSession(session);
        setUser(session.user);
        // Only reload profile if missing — avoids unnecessary refetch on every tab focus
        setProfile(prev => {
          if (!prev) {
            loadProfileOnce(session.user.id, session.user.email || '')
              .then(p => { if (p) setProfile(p); });
          }
          return prev;
        });
      });
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Register auth listener FIRST so PASSWORD_RECOVERY fires before getSession resolves
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        recoveryEventFired = true;
        setSession(session);
        setUser(session?.user ?? null);
        setIsRecoverySession(true);
        setLoading(false);
        try { sessionStorage.removeItem('pending_password_reset'); } catch { /* ignore */ }
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        setSession(session);
        setUser(session?.user ?? null);
        // setSession() (used by loginClient sign-in path) fires TOKEN_REFRESHED.
        // Load the profile if not yet loaded so sign-in completes fully.
        if (session?.user) {
          setProfile(prev => {
            if (!prev) {
              loadProfileOnce(session.user.id, session.user.email || '')
                .then(p => { if (p) { setProfile(p); setLoading(false); } });
            }
            return prev;
          });
        }
        return;
      }

      // USER_UPDATED fires when the admin API changes a user's password/email.
      // Only refresh session — do NOT re-fetch the profile. A concurrent
      // clearPasswordReset() call already cleared must_change_password in memory
      // and a profile re-fetch here could see the stale DB value and revert it.
      if (event === 'USER_UPDATED') {
        setSession(session);
        setUser(session?.user ?? null);
        return;
      }

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        profileFetchPromise.current = null;
        setLoading(false);
        return;
      }

      // Clear stale reset flag on normal sign-in
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && pendingReset && !recoveryEventFired) {
        try { sessionStorage.removeItem('pending_password_reset'); } catch { /* ignore */ }
        pendingReset = false;
      }
      if (recoveryEventFired || pendingReset) return;

      // If a user is signing in, ensure loading stays true while the profile
      // fetches. Without this, a prior SIGNED_OUT (loading=false) + SIGNED_IN
      // sequence briefly renders CRMApp before the profile arrives.
      if (session?.user) setLoading(true);

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Share the same promise with getSession below — only one fetch runs
        const profileData = await loadProfileOnce(session.user.id, session.user.email || '');
        setProfile(profileData);
        // isPasswordReset is derived from profile?.must_change_password — no setter needed

        // Clean up auth URL parameters after successful sign-in
        try {
          if (sessionStorage.getItem('auth_url_cleanup_pending') === 'true') {
            sessionStorage.removeItem('auth_url_cleanup_pending');
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, '', cleanUrl);
          }
        } catch { /* ignore */ }
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    // getSession fires nearly simultaneously with onAuthStateChange on reload.
    // loadProfileOnce deduplicates so only one Supabase query actually runs.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session && pendingReset && !recoveryEventFired) {
        try { sessionStorage.removeItem('pending_password_reset'); } catch { /* ignore */ }
        pendingReset = false;
      }
      if (recoveryEventFired || pendingReset) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const profileData = await loadProfileOnce(session.user.id, session.user.email || '');
        setProfile(profileData);
        // isPasswordReset is derived from profile?.must_change_password — no setter needed
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fail-safe: never block the app forever on auth loading
  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => {
      console.warn('[Auth] Loading timed out — continuing with current session state.');
      setLoading(false);
      // If we're still stuck, force clear any pending auth state
      try {
        sessionStorage.removeItem('pending_password_reset');
        sessionStorage.removeItem('auth_url_cleanup_pending');
      } catch { /* ignore */ }
    }, 12000); // 12s — allows profile.company_id fetch to complete before giving up
    return () => window.clearTimeout(timer);
  }, [loading]);

  // ── Async company loader ─────────────────────────────────────────────
  // Runs after profile.company_id is available. Uses the get_my_company SECURITY
  // DEFINER RPC so it bypasses RLS and never hangs. Non-blocking: profile.company_id
  // is already set, so loadData() in AppLayout fires immediately while this resolves.
  useEffect(() => {
    if (!profile?.company_id || profile.companies || isDemoMode) return;

    let cancelled = false;
    supabase.rpc('get_my_company')
      .then(({ data }) => {
        if (cancelled) return;
        if (data && data.length > 0) {
          setProfile(prev => prev ? { ...prev, companies: data[0] } : null);
        }
      })
      .catch(() => {}); // non-fatal — company branding just won't appear

    return () => { cancelled = true; };
  }, [profile?.company_id]);

  // ── Demo helpers ──────────────────────────────────────────────────────
  const generateDemoUserId = (email: string): string => {
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      const char = email.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const hex = Math.abs(hash).toString(16).padStart(12, '0').slice(-12);
    return `00000000-0000-0000-0000-${hex}`;
  };

  // ── signIn ────────────────────────────────────────────────────────────
  const signIn = async (email: string, password: string) => {
    try {
      if (isDemoMode) {
        const now = new Date().toISOString();
        const demoUserId = generateDemoUserId(email);
        const mockUser = { id: demoUserId, email, app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: now, updated_at: now };
        const mockSession = { access_token: `demo-access-token-${Date.now()}`, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `demo-refresh-token-${Date.now()}`, user: mockUser };
        setSession(mockSession as any);
        setUser(mockUser as any);

        let demoProfile: Profile | null = null;
        try {
          const stored = localStorage.getItem(`demo_profile_${demoUserId}`);
          if (stored) demoProfile = JSON.parse(stored);
        } catch { /* ignore */ }

        if (!demoProfile) {
          demoProfile = { id: demoUserId, email, first_name: email.split('@')[0] || 'Demo', last_name: 'User', role: 'admin', company_id: '00000000-0000-0000-0000-000000000001', is_active: true };
          try { localStorage.setItem(`demo_profile_${demoUserId}`, JSON.stringify(demoProfile)); } catch { /* ignore */ }
        }
        setProfile(demoProfile as any);
        return { error: null };
      }

      // Use session-free loginClient so stale tokens in the main client's
      // localStorage don't block or hang the sign-in attempt.
      const { data, error } = await loginClient.auth.signInWithPassword({ email, password });
      if (!error && data.session) {
        // Propagate the fresh session to the main client, which fires
        // onAuthStateChange and triggers profile loading.
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }
      return { error };
    } catch (err) {
      return { error: err as Error };
    }
  };

  // ── signUp ────────────────────────────────────────────────────────────
  const signUp = async (
    email: string,
    password: string,
    metadata?: { first_name?: string; last_name?: string; role?: string; company_id?: string; company_name?: string }
  ) => {
    try {
      if (isDemoMode) {
        const now = new Date().toISOString();
        const demoUserId = generateDemoUserId(email);
        const mockUser = { id: demoUserId, email, app_metadata: {}, user_metadata: metadata || {}, aud: 'authenticated', created_at: now, updated_at: now };
        const mockSession = { access_token: `demo-access-token-${Date.now()}`, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `demo-refresh-token-${Date.now()}`, user: mockUser };
        const demoProfile = { id: demoUserId, email, first_name: metadata?.first_name || email.split('@')[0] || 'Demo', last_name: metadata?.last_name || 'User', role: metadata?.role || 'admin', company_id: metadata?.company_id || '00000000-0000-0000-0000-000000000001', is_active: true };
        setSession(mockSession as any);
        setUser(mockUser as any);
        setProfile(demoProfile as any);
        try { localStorage.setItem(`demo_profile_${demoUserId}`, JSON.stringify(demoProfile)); } catch { /* ignore */ }
        return { error: null };
      }

      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: metadata } });

      if (!error && data.user) {
        const userRole = metadata?.company_id ? (metadata.role || 'sales') : 'owner';
        await new Promise(resolve => setTimeout(resolve, 500));

        let profileUpdateSuccess = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const profileUpdates: Record<string, unknown> = { first_name: metadata?.first_name, last_name: metadata?.last_name, role: userRole };
          if (metadata?.company_id) profileUpdates.company_id = metadata.company_id;
          const { error: profileError } = await supabase.from('profiles').update(profileUpdates).eq('id', data.user.id);
          if (profileError) {
            console.error(`[Auth] Failed to update profile (attempt ${attempt}):`, profileError);
            if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            profileUpdateSuccess = true;
            break;
          }
        }
        if (!profileUpdateSuccess) console.error('[Auth] Failed to update profile role after all attempts');

        if (!metadata?.company_id) {
          await setupNewUser(
            data.user.id,
            data.user.email || email,
            metadata?.company_name,
            [metadata?.first_name, metadata?.last_name].filter(Boolean).join(' '),
          );
        }

        const freshProfile = await fetchProfile(data.user.id);
        if (freshProfile) setProfile(freshProfile);
      }

      return { error };
    } catch (err) {
      return { error: err as Error };
    }
  };

  // ── signOut ───────────────────────────────────────────────────────────
  const signOut = async () => {
    try {
      setSession(null);
      setUser(null);
      setProfile(null);
      profileFetchPromise.current = null;

      const { error } = await supabase.auth.signOut();
      if (error) console.error('[Auth] Sign out error:', error);

      try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ }
    } catch (err) {
      console.error('[Auth] Sign out failed:', err);
    } finally {
      const basePath = import.meta.env.BASE_URL || '/';
      window.location.replace(basePath);
    }
  };

  // ── resetPassword ─────────────────────────────────────────────────────
  // Temp-password flow only. The edge function sets a temporary password,
  // emails it to the user, and marks must_change_password = true.
  const resetPassword = async (email: string) => {
    try {
      if (!supabaseUrl || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        return { error: new Error('Missing app auth configuration.') };
      }
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12000);
      const res = await fetch(`${supabaseUrl}/functions/v1/temp-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY, 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ email }),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { error: new Error(data?.error || 'Unable to send temporary password right now.') };
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  // ── clearPasswordReset ────────────────────────────────────────────────
  // Called after the user successfully sets a new password so AuthGate
  // immediately re-renders without a hard page reload.
  const clearPasswordReset = () => {
    setIsRecoverySession(false);
    setProfile(prev => (prev ? { ...prev, must_change_password: false } : null));
  };

  // ── updateProfile ─────────────────────────────────────────────────────
  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user logged in') };
    try {
      if (isDemoMode) {
        try {
          const key = `demo_profile_${user.id}`;
          const existing = localStorage.getItem(key);
          const profileData = existing ? JSON.parse(existing) : { id: user.id, email: user.email };
          const updated = { ...profileData, ...updates, updated_at: new Date().toISOString() };
          localStorage.setItem(key, JSON.stringify(updated));
        } catch { /* ignore */ }
        setProfile(prev => (prev ? { ...prev, ...updates } : null));
        return { error: null };
      }

      const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (!error) setProfile(prev => (prev ? { ...prev, ...updates } : null));
      return { error };
    } catch (err) {
      return { error: err as Error };
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, isPasswordReset, signIn, signUp, signOut, resetPassword, updateProfile, clearPasswordReset }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
