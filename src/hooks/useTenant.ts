import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface PlanDefinition {
  id: 'solo' | 'team' | 'consultancy';
  name: string;
  max_users: number;
  max_storage_mb: number;
}

export interface Tenant {
  id: string;
  name: string;
  plan_id: string;
  discipline_type: string;
  storage_used_mb: number;
  enabled_addons: string[];
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  billing_cycle?: string | null;
  created_at?: string;
  updated_at?: string;
  plan?: PlanDefinition;
}

export interface TenantWithPlan extends Tenant {
  plan: PlanDefinition;
}

export function useTenant() {
  const { user, organisation, refreshUserRole } = useAuth();
  const [tenant, setTenant] = useState<TenantWithPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTenant = async () => {
    if (!organisation?.id) {
      setTenant(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('organisations')
        .select(`
          *,
          plan:plan_definitions!organisations_plan_id_fkey(*)
        `)
        .eq('id', organisation.id)
        .maybeSingle();

      if (fetchError) {
        console.error('[useTenant] Error fetching tenant:', fetchError);
        setError(fetchError.message);
        setTenant(null);
        return;
      }

      if (!data) {
        console.error('[useTenant] No tenant found for organisation:', organisation.id);
        setError('Organisation not found');
        setTenant(null);
        return;
      }

      const tenantData = data as any;
      const planData = tenantData.plan as PlanDefinition;

      if (!planData) {
        console.error('[useTenant] No plan definition found for tenant');
        setError('Plan definition not found');
        setTenant(null);
        return;
      }

      setTenant({
        id: tenantData.id,
        name: tenantData.name,
        plan_id: tenantData.plan_id,
        discipline_type: tenantData.discipline_type,
        storage_used_mb: tenantData.storage_used_mb || 0,
        enabled_addons: tenantData.enabled_addons || [],
        stripe_customer_id: tenantData.stripe_customer_id,
        stripe_subscription_id: tenantData.stripe_subscription_id,
        billing_cycle: tenantData.billing_cycle,
        created_at: tenantData.created_at,
        updated_at: tenantData.updated_at,
        plan: planData,
      });
    } catch (err) {
      console.error('[useTenant] Exception:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setTenant(null);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePlan = async (newPlanId: 'solo' | 'team' | 'consultancy') => {
    if (!organisation?.id) return;

    try {
      const { error: updateError } = await supabase
        .from('organisations')
        .update({ plan_id: newPlanId })
        .eq('id', organisation.id);

      if (updateError) {
        console.error('[useTenant] Error updating plan:', updateError);
        throw updateError;
      }

      await refreshUserRole();
      await fetchTenant();
    } catch (err) {
      console.error('[useTenant] Exception updating plan:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchTenant();
  }, [organisation?.id]);

  return {
    tenant,
    isLoading,
    error,
    refetch: fetchTenant,
    updatePlan,
  };
}
