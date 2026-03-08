import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isDemoMode } from '@/lib/supabase';
import { setupNewUser } from '@/lib/setupCompany';
import type { Session, User } from '@supabase/supabase-js';

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
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Detect recovery token — captured in supabase.ts before Supabase clears the hash
  const [isPasswordReset, setIsPasswordReset] = useState(() => {
    try {
      return sessionStorage.getItem('pending_password_reset') === 'true';
    } catch (_) { return false; }
  });

  // Fetch user profile
  const fetchProfile = async (userId: string) => {
    try {
      // In demo mode, try to load from localStorage first
      if (isDemoMode) {
        try {
          const demoProfileKey = `demo_profile_${userId}`;
          const stored = localStorage.getItem(demoProfileKey);
          if (stored) {
            const profileData = JSON.parse(stored);
            return profileData as Profile;
          }
        } catch (localStorageError) {
          console.warn('[Auth] Failed to load profile from localStorage:', localStorageError);
        }
        // In demo mode, if no stored profile, return null instead of hitting Supabase
        return null;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      return data as Profile;
    } catch (err) {
      console.error('Error fetching profile:', err);
      return null;
    }
  };

  // Ensure user has a company set up
  const ensureUserSetup = async (userId: string, userEmail: string) => {
    try {
      // Get current profile
      const profileData = await fetchProfile(userId);
      
      // If user doesn't have a company, set one up automatically
      if (profileData && !profileData.company_id) {
        const setupSuccess = await setupNewUser(userId, userEmail);
        
        if (setupSuccess) {
          const updatedProfile = await fetchProfile(userId);
          if (!updatedProfile?.company_id) {
            console.warn('⚠️ Setup reported success but no company_id found, retrying...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retryProfile = await fetchProfile(userId);
            if (!retryProfile?.company_id) {
              console.error('❌ Company setup failed even after retry');
            }
            return retryProfile;
          }
          return updatedProfile;
        } else {
          console.error('❌ Company setup failed');
        }
      } else if (profileData?.company_id) {
        // company_id already set, nothing to do
      }
      
      return profileData;
    } catch (err) {
      console.error('Error in ensureUserSetup:', err);
      return await fetchProfile(userId);
    }
  };

  useEffect(() => {
    let profileFetchInProgress = false;
    let recoveryEventFired = false;
    const pendingReset = (() => { try { return sessionStorage.getItem('pending_password_reset') === 'true'; } catch(_) { return false; } })();

    const loadProfile = async (userId: string, email: string) => {
      if (profileFetchInProgress) return;
      profileFetchInProgress = true;
      try {
        const profileData = await ensureUserSetup(userId, email);
        setProfile(profileData);
      } finally {
        profileFetchInProgress = false;
      }
    };

    // Re-check session when tab becomes visible again (fixes stale state after idle)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
          if (session?.user) {
            setSession(session);
            setUser(session.user);
            // Only reload profile if we don't already have one (avoids full re-init on every tab focus)
            setProfile(prev => {
              if (!prev) {
                loadProfile(session.user.id, session.user.email || '');
              }
              return prev;
            });
          }
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set up onAuthStateChange FIRST so PASSWORD_RECOVERY fires before getSession resolves
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {

      // Handle password recovery — show reset form instead of app
      if (event === 'PASSWORD_RECOVERY') {
        recoveryEventFired = true;
        setSession(session);
        setUser(session?.user ?? null);
        setIsPasswordReset(true);
        setLoading(false);
        try { sessionStorage.removeItem('pending_password_reset'); } catch (_) { /* ignore */ }
        return;
      }

      // For token refreshes, just update the session/user objects.
      if (event === 'TOKEN_REFRESHED') {
        setSession(session);
        setUser(session?.user ?? null);
        return;
      }

      // On explicit sign-out, clear everything
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      // For SIGNED_IN, INITIAL_SESSION, USER_UPDATED, etc.
      // Don't override if we're in a recovery flow
      if (recoveryEventFired || pendingReset) return;
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await loadProfile(session.user.id, session.user.email || '');
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    // Get initial session — skip everything if this is a password reset
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // If pending reset or recovery already fired, don't interfere — wait for PASSWORD_RECOVERY event
      if (recoveryEventFired || pendingReset) return;

      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await loadProfile(session.user.id, session.user.email || '');
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
      console.warn('Auth loading timed out; continuing with current session state.');
      setLoading(false);
    }, 12000);

    return () => window.clearTimeout(timer);
  }, [loading]);

  // Generate consistent demo user ID from email for data persistence across sessions
  const generateDemoUserId = (email: string): string => {
    // Create a deterministic hash from email to generate consistent UUID
    // This ensures the same email always gets the same user ID
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      const char = email.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    // Convert hash to hex and pad to 12 chars
    const hex = Math.abs(hash).toString(16).padStart(12, '0').slice(-12);
    return `00000000-0000-0000-0000-${hex}`;
  };

  const signIn = async (email: string, password: string) => {
    try {
      // Demo mode authentication - accept any credentials
      if (isDemoMode) {
        const now = new Date().toISOString();
        // Generate consistent demo user ID based on email so data persists across sessions
        const demoUserId = generateDemoUserId(email);
        
        // Create mock session for demo mode
        const mockUser = {
          id: demoUserId,
          email: email,
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: now,
          updated_at: now,
        };
        
        const mockSession = {
          access_token: `demo-access-token-${Date.now()}`,
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: `demo-refresh-token-${Date.now()}`,
          user: mockUser,
        };

        setSession(mockSession as any);
        setUser(mockUser as any);
        
        // Try to load existing profile from localStorage first
        let demoProfile: Profile | null = null;
        try {
          const demoProfileKey = `demo_profile_${demoUserId}`;
          const stored = localStorage.getItem(demoProfileKey);
          if (stored) {
            demoProfile = JSON.parse(stored);
          }
        } catch (loadError) {
          console.warn('[Auth] Failed to load demo profile from localStorage:', loadError);
        }

        // If no existing profile, create a new one
        if (!demoProfile) {
          demoProfile = {
            id: demoUserId,
            email: email,
            first_name: email.split('@')[0] || 'Demo',
            last_name: 'User',
            role: 'admin',
            company_id: '00000000-0000-0000-0000-000000000001',
            is_active: true,
          };
          
          // Save new demo profile to localStorage
          try {
            const demoProfileKey = `demo_profile_${demoUserId}`;
            localStorage.setItem(demoProfileKey, JSON.stringify(demoProfile));
          } catch (storageError) {
            console.warn('[Auth] Failed to save demo profile to localStorage:', storageError);
          }
        }

        setProfile(demoProfile as any);
        return { error: null };
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    metadata?: { first_name?: string; last_name?: string; role?: string; company_id?: string; company_name?: string }
  ) => {
    try {
      if (isDemoMode) {
        const now = new Date().toISOString();
        // Generate consistent demo user ID based on email
        const demoUserId = generateDemoUserId(email);

        const mockUser = {
          id: demoUserId,
          email,
          app_metadata: {},
          user_metadata: metadata || {},
          aud: 'authenticated',
          created_at: now,
          updated_at: now,
        };

        const mockSession = {
          access_token: `demo-access-token-${Date.now()}`,
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: `demo-refresh-token-${Date.now()}`,
          user: mockUser,
        };

        const demoProfile = {
          id: demoUserId,
          email,
          first_name: metadata?.first_name || email.split('@')[0] || 'Demo',
          last_name: metadata?.last_name || 'User',
          role: metadata?.role || 'admin',
          company_id: metadata?.company_id || '00000000-0000-0000-0000-000000000001',
          is_active: true,
        };

        setSession(mockSession as any);
        setUser(mockUser as any);
        setProfile(demoProfile as any);

        // Save demo profile to localStorage
        try {
          const demoProfileKey = `demo_profile_${demoUserId}`;
          localStorage.setItem(demoProfileKey, JSON.stringify(demoProfile));
        } catch (storageError) {
          console.warn('[Auth] Failed to save demo profile to localStorage:', storageError);
        }

        return { error: null };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });

      if (!error && data.user) {
        // Determine the role:
        // - If signing up via invite (has company_id), use provided role
        // - If creating new company (no company_id), assign 'owner' role
        const userRole = metadata?.company_id 
          ? (metadata.role || 'sales')  // Invite signup: use provided role or default to sales
          : 'owner';                     // New company signup: always owner
        
        
        // Wait briefly for the database trigger to create the profile row
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Update profile with additional info (retry up to 3 times)
        let profileUpdateSuccess = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const profileUpdates: Record<string, unknown> = {
              first_name: metadata?.first_name,
              last_name: metadata?.last_name,
              role: userRole,
            };
          // Only set company_id if provided (invite signup) — don't overwrite trigger-created company_id
          if (metadata?.company_id) {
            profileUpdates.company_id = metadata.company_id;
          }
          const { error: profileError, count } = await supabase
            .from('profiles')
            .update(profileUpdates)
            .eq('id', data.user.id);
          
          if (profileError) {
            console.error(`[Auth] Failed to update profile (attempt ${attempt}):`, profileError);
            if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            profileUpdateSuccess = true;
            break;
          }
        }
        
        if (!profileUpdateSuccess) {
          console.error('[Auth] Failed to update profile role after all attempts');
        }
        
        // Only run first-time setup if NOT signing up via invite
        // (invite signup means they're joining an existing company)
        if (!metadata?.company_id) {
          await setupNewUser(data.user.id, data.user.email || email, metadata?.company_name);
        }
        
        // Re-fetch and set profile so the UI immediately reflects the correct role
        const freshProfile = await fetchProfile(data.user.id);
        if (freshProfile) {
          setProfile(freshProfile);
        }
      }

      return { error };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    try {
      
      // Clear all state immediately to provide instant feedback
      setSession(null);
      setUser(null);
      setProfile(null);
      
      // Clear localStorage and sessionStorage
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (storageError) {
        console.warn('[Auth] Failed to clear storage:', storageError);
      }
      
      // Call Supabase signOut (don't wait for it if it fails)
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[Auth] Sign out error:', error);
      }
    } catch (err) {
      console.error('[Auth] Sign out failed:', err);
    } finally {
      // Always redirect and reload, regardless of success/failure
      // Use correct base path for GitHub Pages
      const basePath = import.meta.env.BASE_URL || '/';
      
      // Force a hard reload to the base path to ensure clean state
      window.location.replace(basePath);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}reset-password`,
      });
      return { error };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user logged in') };

    try {
      // In demo mode, save profile updates to localStorage
      if (isDemoMode) {
        try {
          const demoProfileKey = `demo_profile_${user.id}`;
          const existing = localStorage.getItem(demoProfileKey);
          const profileData = existing ? JSON.parse(existing) : { id: user.id, email: user.email };
          const updated = { ...profileData, ...updates, updated_at: new Date().toISOString() };
          localStorage.setItem(demoProfileKey, JSON.stringify(updated));
          setProfile((prev) => (prev ? { ...prev, ...updates } : null));
          return { error: null };
        } catch (localStorageError) {
          console.warn('[Auth] Failed to save profile to localStorage:', localStorageError);
          // Even if localStorage fails, update state and return success
          setProfile((prev) => (prev ? { ...prev, ...updates } : null));
          return { error: null };
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (!error) {
        setProfile((prev) => (prev ? { ...prev, ...updates } : null));
      }

      return { error };
    } catch (err) {
      return { error: err as Error };
    }
  };

  // Force reload profile from database (useful after subscription updates)
  const refreshProfile = async () => {
    if (!user) return;
    
    try {
      const freshProfile = await fetchProfile(user.id);
      if (freshProfile) {
        setProfile(freshProfile);
      }
    } catch (err) {
      console.error('[Auth] Failed to refresh profile:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        isPasswordReset,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
