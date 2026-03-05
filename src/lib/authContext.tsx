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
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, metadata?: { first_name?: string; last_name?: string; role?: string; company_id?: string }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile
  const fetchProfile = async (userId: string) => {
    try {
      // In demo mode, try to load from localStorage first
      if (isDemoMode) {
        console.log('[Auth] Demo mode - loading profile from localStorage');
        try {
          const demoProfileKey = `demo_profile_${userId}`;
          const stored = localStorage.getItem(demoProfileKey);
          if (stored) {
            const profileData = JSON.parse(stored);
            console.log('[Auth] Demo profile loaded from localStorage');
            return profileData as Profile;
          }
        } catch (localStorageError) {
          console.warn('[Auth] Failed to load profile from localStorage:', localStorageError);
        }
        // In demo mode, if no stored profile, return null instead of hitting Supabase
        console.log('[Auth] Demo mode - no stored profile found, returning null');
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
        console.log('User has no company, running automatic setup...');
        const setupSuccess = await setupNewUser(userId, userEmail);
        
        if (setupSuccess) {
          // Fetch profile again to get the new company_id
          const updatedProfile = await fetchProfile(userId);
          if (updatedProfile?.company_id) {
            console.log('✅ Company setup successful, company_id:', updatedProfile.company_id);
          } else {
            console.warn('⚠️ Setup reported success but no company_id found, retrying...');
            // Retry once after a brief delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retryProfile = await fetchProfile(userId);
            if (retryProfile?.company_id) {
              console.log('✅ Company setup successful on retry, company_id:', retryProfile.company_id);
            } else {
              console.error('❌ Company setup failed even after retry');
            }
            return retryProfile;
          }
          return updatedProfile;
        } else {
          console.error('❌ Company setup failed');
        }
      } else if (profileData?.company_id) {
        console.log('✓ User already has company_id:', profileData.company_id);
      }
      
      return profileData;
    } catch (err) {
      console.error('Error in ensureUserSetup:', err);
      return await fetchProfile(userId);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const profileData = await ensureUserSetup(session.user.id, session.user.email || '');
        setProfile(profileData);
      }
      
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const profileData = await ensureUserSetup(session.user.id, session.user.email || '');
        setProfile(profileData);
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
            console.log('[Auth] Loaded existing demo profile from localStorage');
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
            console.log('[Auth] New demo profile saved to localStorage');
          } catch (storageError) {
            console.warn('[Auth] Failed to save demo profile to localStorage:', storageError);
          }
        }

        setProfile(demoProfile as any);
        console.log('✅ Demo mode sign-in successful:', email);
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
    metadata?: { first_name?: string; last_name?: string; role?: string; company_id?: string }
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
          console.log('[Auth] Demo profile saved to localStorage during signup');
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
        
        // Update profile with additional info
        await supabase
          .from('profiles')
          .update({
            first_name: metadata?.first_name,
            last_name: metadata?.last_name,
            role: userRole,
            company_id: metadata?.company_id, // Set company_id if provided (invite signup)
          })
          .eq('id', data.user.id);
        
        // Only run first-time setup if NOT signing up via invite
        // (invite signup means they're joining an existing company)
        if (!metadata?.company_id) {
          await setupNewUser(data.user.id, data.user.email || email);
        }
      }

      return { error };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    try {
      console.log('[Auth] Signing out...');
      
      // Clear all state immediately to provide instant feedback
      setSession(null);
      setUser(null);
      setProfile(null);
      
      // Clear localStorage and sessionStorage
      try {
        localStorage.clear();
        sessionStorage.clear();
        console.log('[Auth] Cleared all browser storage');
      } catch (storageError) {
        console.warn('[Auth] Failed to clear storage:', storageError);
      }
      
      // Call Supabase signOut (don't wait for it if it fails)
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[Auth] Sign out error:', error);
      } else {
        console.log('[Auth] Sign out successful');
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
        redirectTo: `${window.location.origin}/reset-password`,
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
        console.log('[Auth] Demo mode - saving profile updates locally');
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

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updateProfile,
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
