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
      // Demo mode authentication
      const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
      if (isDemoMode && email === 'demo@example.com' && password === 'password') {
        // Create mock session for demo mode
        const mockUser = {
          id: 'demo-user-id',
          email: 'demo@example.com',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        const mockSession = {
          access_token: 'demo-access-token',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: 'demo-refresh-token',
          user: mockUser,
        };

        setSession(mockSession as any);
        setUser(mockUser as any);
        
        // Create demo profile
        const demoProfile = {
          id: 'demo-user-id',
          email: 'demo@example.com',
          first_name: 'Demo',
          last_name: 'User',
          role: 'admin',
          company_id: 'demo-company',
          is_active: true,
        };
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
              role: metadata.role || 'sales',
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

  const signOut = async () => {
    try {
      console.log('[Auth] Signing out...');
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[Auth] Sign out error:', error);
        throw error;
      }
      console.log('[Auth] Sign out successful');
      setSession(null);
      setUser(null);
      setProfile(null);
      // Clear any cached data
      window.location.href = '/';
    } catch (err) {
      console.error('[Auth] Sign out failed:', err);
      // Force logout by clearing state even if API call fails
      setSession(null);
      setUser(null);
      setProfile(null);
      window.location.href = '/';
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
