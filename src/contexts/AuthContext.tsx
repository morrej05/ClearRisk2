import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserRole } from '../utils/permissions';

interface AuthContextType {
  user: User | null;
  userRole: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  refreshUserRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const ensureUserProfile = async (userId: string, userEmail: string): Promise<UserRole> => {
    try {
      const { data: profile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (profile && !fetchError) {
        return profile.role as UserRole;
      }

      if (!profile) {
        console.warn('User profile not found, creating default profile for user:', userId);

        const { data: newProfile, error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            id: userId,
            email: userEmail,
            role: 'surveyor'
          })
          .select('role')
          .single();

        if (newProfile && !insertError) {
          console.log('Created new user profile with role:', newProfile.role);
          return newProfile.role as UserRole;
        } else {
          console.error('Failed to create user profile:', insertError);
          throw new Error('Failed to create user profile');
        }
      }

      throw new Error('Failed to fetch user profile');
    } catch (err) {
      console.error('Error in ensureUserProfile:', err);
      throw err;
    }
  };

  const fetchUserRole = async (userId: string, userEmail: string) => {
    const timeoutId = setTimeout(() => {
      console.error('Role fetch timeout after 5 seconds');
      setUserRole('surveyor');
      setLoading(false);
    }, 5000);

    try {
      const role = await ensureUserProfile(userId, userEmail);
      clearTimeout(timeoutId);
      setUserRole(role);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Failed to fetch user role:', error);
      setUserRole('surveyor');
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const refreshUserRole = async () => {
    if (user) {
      setLoading(true);
      await fetchUserRole(user.id, user.email || '');
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id, session.user.email || '');
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          setLoading(true);
          await fetchUserRole(session.user.id, session.user.email || '');
        } else {
          setUserRole(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, userRole, loading, signIn, signUp, signOut, resetPassword, refreshUserRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
