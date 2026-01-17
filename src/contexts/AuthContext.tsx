import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserRole } from '../utils/permissions';

interface AuthContextType {
  user: User | null;
  userRole: UserRole | null;
  roleError: string | null;
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
  const [roleError, setRoleError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (userId: string, userEmail: string) => {
    try {
      setRoleError(null);
      console.log('[AuthContext] Fetching role for user:', userId, userEmail);

      const { data: profile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      console.log('[AuthContext] Profile fetch result:', { profile, error: fetchError });

      if (fetchError) {
        const errorMsg = `Database error: ${fetchError.message} (Code: ${fetchError.code})`;
        console.error('[AuthContext] Role fetch error:', errorMsg, fetchError);
        setRoleError(errorMsg);
        setUserRole(null);
        setLoading(false);
        return;
      }

      if (!profile) {
        console.warn('[AuthContext] User profile not found for:', userId);
        const errorMsg = 'User profile not found. Please contact support.';
        setRoleError(errorMsg);
        setUserRole(null);
        setLoading(false);
        return;
      }

      console.log('[AuthContext] Successfully fetched role:', profile.role);
      setUserRole(profile.role as UserRole);
      setRoleError(null);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error fetching role';
      console.error('[AuthContext] Exception in fetchUserRole:', error);
      setRoleError(errorMsg);
      setUserRole(null);
    } finally {
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
    console.log('[AuthContext] Initializing auth state...');

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[AuthContext] Initial session:', session?.user?.email || 'No user');
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id, session.user.email || '');
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthContext] Auth state changed:', event, session?.user?.email || 'No user');
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          setLoading(true);
          await fetchUserRole(session.user.id, session.user.email || '');
        } else {
          console.log('[AuthContext] Clearing role state on sign out');
          setUserRole(null);
          setRoleError(null);
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
    <AuthContext.Provider value={{ user, userRole, roleError, loading, signIn, signUp, signOut, resetPassword, refreshUserRole }}>
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
