import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserRole, SubscriptionPlan, DisciplineType } from '../utils/permissions';
import { Organisation, UserRole as EntitlementUserRole } from '../utils/entitlements';

interface AuthContextType {
  user: User | null;
  userRole: UserRole | null;
  userPlan: SubscriptionPlan | null;
  disciplineType: DisciplineType | null;
  boltOns: string[];
  maxEditors: number;
  activeEditors: number;
  isPlatformAdmin: boolean;
  canEdit: boolean;
  organisation: Organisation | null;
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
  const [userPlan, setUserPlan] = useState<SubscriptionPlan | null>(null);
  const [disciplineType, setDisciplineType] = useState<DisciplineType | null>(null);
  const [boltOns, setBoltOns] = useState<string[]>([]);
  const [maxEditors, setMaxEditors] = useState<number>(999);
  const [activeEditors, setActiveEditors] = useState<number>(1);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean>(false);
  const [canEdit, setCanEdit] = useState<boolean>(false);
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (userId: string, userEmail: string) => {
    try {
      setRoleError(null);
      console.log('[AuthContext] Fetching user profile for:', userId, userEmail);

      const { data: profile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('role, plan, discipline_type, bolt_ons, max_editors, active_editors, is_platform_admin, can_edit, organisation_id, organisations(*)')
        .eq('id', userId)
        .maybeSingle();

      console.log('[AuthContext] Profile fetch result:', { profile, error: fetchError });

      if (fetchError) {
        const errorMsg = `Database error: ${fetchError.message} (Code: ${fetchError.code})`;
        console.error('[AuthContext] Profile fetch error:', errorMsg, fetchError);
        setRoleError(errorMsg);
        setUserRole(null);
        setUserPlan(null);
        setDisciplineType(null);
        setBoltOns([]);
        setMaxEditors(999);
        setActiveEditors(1);
        setIsPlatformAdmin(false);
        setCanEdit(false);
        setOrganisation(null);
        setLoading(false);
        return;
      }

      if (!profile) {
        console.warn('[AuthContext] User profile not found for:', userId);
        const errorMsg = 'User profile not found. Please contact support.';
        setRoleError(errorMsg);
        setUserRole(null);
        setUserPlan(null);
        setDisciplineType(null);
        setBoltOns([]);
        setMaxEditors(999);
        setActiveEditors(1);
        setIsPlatformAdmin(false);
        setCanEdit(false);
        setOrganisation(null);
        setLoading(false);
        return;
      }

      console.log('[AuthContext] Successfully fetched profile:', profile);
      setUserRole(profile.role as UserRole);
      setUserPlan(profile.plan as SubscriptionPlan);
      setDisciplineType(profile.discipline_type as DisciplineType);
      setBoltOns(Array.isArray(profile.bolt_ons) ? profile.bolt_ons : []);
      setMaxEditors(profile.max_editors || 999);
      setActiveEditors(profile.active_editors || 1);
      setIsPlatformAdmin(profile.is_platform_admin || false);
      setCanEdit(profile.can_edit || false);

      if (profile.organisations) {
        const org = profile.organisations as any;
        setOrganisation({
          id: org.id,
          name: org.name,
          plan_type: org.plan_type,
          discipline_type: org.discipline_type,
          enabled_addons: Array.isArray(org.enabled_addons) ? org.enabled_addons : [],
          max_editors: org.max_editors || 0,
          subscription_status: org.subscription_status || 'inactive',
          stripe_customer_id: org.stripe_customer_id,
          stripe_subscription_id: org.stripe_subscription_id,
          billing_cycle: org.billing_cycle,
          created_at: org.created_at,
          updated_at: org.updated_at,
        });
      } else {
        setOrganisation(null);
      }

      setRoleError(null);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error fetching profile';
      console.error('[AuthContext] Exception in fetchUserRole:', error);
      setRoleError(errorMsg);
      setUserRole(null);
      setUserPlan(null);
      setDisciplineType(null);
      setBoltOns([]);
      setMaxEditors(999);
      setActiveEditors(1);
      setIsPlatformAdmin(false);
      setCanEdit(false);
      setOrganisation(null);
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
          console.log('[AuthContext] Clearing profile state on sign out');
          setUserRole(null);
          setUserPlan(null);
          setDisciplineType(null);
          setBoltOns([]);
          setMaxEditors(999);
          setActiveEditors(1);
          setIsPlatformAdmin(false);
          setCanEdit(false);
          setOrganisation(null);
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
    <AuthContext.Provider value={{
      user,
      userRole,
      userPlan,
      disciplineType,
      boltOns,
      maxEditors,
      activeEditors,
      isPlatformAdmin,
      canEdit,
      organisation,
      roleError,
      loading,
      signIn,
      signUp,
      signOut,
      resetPassword,
      refreshUserRole
    }}>
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
