import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
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
  signUp: (email: string, password: string, metadata?: { first_name?: string; last_name?: string; role?: string }) => Promise<{ error: Error | null }>;
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
          return await fetchProfile(userId);
        }
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

  const signIn = async (email: string, password: string) => {
    try {
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
    metadata?: { first_name?: string; last_name?: string; role?: string }
  ) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });

      if (!error && data.user) {
        // Update profile with additional info
        if (metadata) {
          await supabase
            .from('profiles')
            .update({
              first_name: metadata.first_name,
              last_name: metadata.last_name,
              // Creator signups default to owner unless an explicit role is provided (e.g. invite flow).
              role: metadata.role || 'owner',
            })
            .eq('id', data.user.id);
        }
        
        // Run first-time setup
        await setupNewUser(data.user.id, data.user.email || email);
      }

      return { error };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const clearLocalAuthState = () => {
    setSession(null);
    setUser(null);
    setProfile(null);
    setLoading(false);

    if (typeof window !== 'undefined') {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i += 1) {
          const key = window.localStorage.key(i);
          if (!key) continue;
          if (key.startsWith('sb-') && key.includes('auth-token')) {
            keysToRemove.push(key);
          }
        }

        keysToRemove.push('sb-auth-token');

        keysToRemove.forEach((key) => {
          try {
            window.localStorage.removeItem(key);
          } catch {
            // ignore storage cleanup errors
          }
        });
      } catch {
        // ignore storage access errors
      }
    }
  };

  const signOut = async () => {
    clearLocalAuthState();

    try {
      await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Local sign-out timeout')), 5000)),
      ]);
    } catch (error) {
      console.warn('Local sign-out fallback applied:', error);
    }

    try {
      supabase.removeAllChannels();
    } catch (error) {
      console.warn('Failed to remove realtime channels during sign-out:', error);
    }

    clearLocalAuthState();
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
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select('*')
        .single();

      if (error || !data) {
        return { error: error || new Error('Profile update did not persist') };
      }

      setProfile(data as Profile);
      return { error: null };
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
