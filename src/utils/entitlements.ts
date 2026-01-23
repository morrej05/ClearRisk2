/**
 * Role Definitions and Responsibilities
 *
 * ADMIN (Organisation Admin):
 * - Manage organisation settings
 * - Manage users within their organisation
 * - Configure client branding
 * - View and upgrade subscription plans
 * - Access all features within their organisation's plan limits
 *
 * PLATFORM ADMIN (Platform Administrator):
 * - All admin permissions, plus:
 * - Manage all organisations across the platform
 * - Configure platform-wide settings
 * - Manage subscription plans and feature flags
 * - Impersonate organisations for support purposes
 * - Access global analytics and reporting
 * - Bypass all feature gates and subscription checks
 *
 * Note: Platform Admin is NOT a separate role, it's a flag on admin users.
 * A Platform Admin must have role === 'admin' AND is_platform_admin === true.
 */

export type PlanType = 'free' | 'core' | 'professional' | 'enterprise';
export type DisciplineType = 'engineering' | 'assessment' | 'both';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'inactive';
export type UserRole = 'admin' | 'surveyor' | 'viewer';

export function isDev(): boolean {
  return import.meta.env.DEV === true;
}

export interface Organisation {
  id: string;
  name: string;
  plan_type: PlanType;
  plan_id?: string;
  discipline_type: DisciplineType;
  enabled_addons: string[];
  max_editors: number;
  subscription_status: SubscriptionStatus;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  billing_cycle?: 'monthly' | 'annual' | null;
  created_at?: string;
  updated_at?: string;
}

export interface User {
  id: string;
  role: UserRole;
  is_platform_admin: boolean;
  can_edit: boolean;
  name?: string | null;
  organisation_id?: string | null;
}

export interface UserWithOrg extends User {
  organisation?: Organisation;
}

export function isOrgAdmin(user: User): boolean {
  return user.role === 'admin';
}

export function isPlatformAdmin(user: User): boolean {
  return user.role === 'admin' && user.is_platform_admin === true;
}

export function getPlanTier(org: Organisation): 'free' | 'solo' | 'core' | 'professional' | 'enterprise' {
  const planId = org?.plan_id ?? org?.plan_type ?? '';
  const planStr = planId.toString().trim().toLowerCase();

  if (planStr === 'solo' || planStr === 'free') return 'solo';
  if (planStr === 'core') return 'core';
  if (planStr === 'professional' || planStr === 'pro' || planStr === 'team') return 'professional';
  if (planStr === 'enterprise' || planStr === 'consultancy') return 'enterprise';

  return 'free';
}

export function isPaidActive(org?: Organisation | null): boolean {
  const status = org?.subscription_status;
  return status === 'active' || status === 'trialing';
}

export function canEdit(user: User, org?: Organisation | null): boolean {
  if (isPlatformAdmin(user)) {
    return true;
  }

  if (user.role === 'viewer') {
    return false;
  }

  if (!user.can_edit) {
    return false;
  }

  if (!org) {
    return false;
  }

  const tier = getPlanTier(org);
  const isActiveSubscription = isPaidActive(org) || tier === 'enterprise';

  return isActiveSubscription;
}

export function canAccessProFeatures(user: User, org?: Organisation | null): boolean {
  if (isPlatformAdmin(user)) {
    return true;
  }

  if (!org) {
    return false;
  }

  const tier = getPlanTier(org);
  const isProOrEnterprise = tier === 'professional' || tier === 'enterprise';
  const isActive = isPaidActive(org) || tier === 'enterprise';

  return isProOrEnterprise && isActive;
}

export function canAccessExplosionSafety(user?: User | null, org?: Organisation | null): boolean {
  if (user && isPlatformAdmin(user)) {
    return true;
  }

  if (!org) {
    return false;
  }

  // DEV override so we can test flows without subscription wiring
  if (isDev()) {
    return true;
  }

  const tier = getPlanTier(org);
  const isProOrEnterprise = tier === 'professional' || tier === 'enterprise';
  const isActive = isPaidActive(org) || tier === 'enterprise';

  return isProOrEnterprise && isActive;
}

export function hasAddon(user: User, org?: Organisation | null, addonKey?: string): boolean {
  if (isPlatformAdmin(user)) {
    return true;
  }

  if (!org || !addonKey) {
    return false;
  }

  const tier = getPlanTier(org);
  if (tier === 'enterprise') {
    return true;
  }

  return org.enabled_addons?.includes(addonKey) ?? false;
}

export function canSwitchDiscipline(user: User, org?: Organisation | null): boolean {
  if (isPlatformAdmin(user)) {
    return true;
  }

  if (!org) {
    return false;
  }

  const tier = getPlanTier(org);
  return tier === 'enterprise' && org.discipline_type === 'both';
}

export function canAccessAdmin(user: User): boolean {
  return isOrgAdmin(user);
}

export function canAccessPlatformSettings(user: User): boolean {
  return isPlatformAdmin(user);
}

export function canViewData(org?: Organisation | null): boolean {
  return true;
}

export function canExportData(org?: Organisation | null): boolean {
  return true;
}

export function isSubscriptionActive(org?: Organisation | null): boolean {
  if (!org) {
    return false;
  }
  return isPaidActive(org) || getPlanTier(org) === 'enterprise';
}

export function shouldShowUpgradePrompts(user: User, org?: Organisation | null): boolean {
  if (isPlatformAdmin(user)) {
    return false;
  }

  if (!org) {
    return true;
  }

  const tier = getPlanTier(org);
  if (tier === 'professional' || tier === 'enterprise') {
    return false;
  }

  return true;
}

export function needsActiveSubscription(user: User, org?: Organisation | null): boolean {
  if (isPlatformAdmin(user)) {
    return false;
  }

  if (!org) {
    return true;
  }

  const tier = getPlanTier(org);
  if (tier === 'enterprise') {
    return false;
  }

  return !isPaidActive(org);
}

export function getMaxEditors(plan: PlanType): number {
  switch (plan) {
    case 'free':
      return 0;
    case 'core':
      return 1;
    case 'professional':
      return 3;
    case 'enterprise':
      return 10;
    default:
      return 0;
  }
}

export function canManageUsers(user: User): boolean {
  return isOrgAdmin(user);
}

export function canManageBranding(user: User): boolean {
  return isOrgAdmin(user);
}

export function canCreateSurveys(user: User, org?: Organisation | null): boolean {
  return canEdit(user, org);
}

export function canDeleteSurveys(user: User): boolean {
  return isOrgAdmin(user);
}

export function canIssueSurveys(user: User, org?: Organisation | null): boolean {
  return canEdit(user, org);
}

export function canAccessPillarB(user: User, org?: Organisation | null): boolean {
  if (isPlatformAdmin(user)) {
    return true;
  }

  if (!org) {
    return false;
  }

  // Check for plan_id first (new field), fallback to plan_type (old field)
  const planId = org?.plan_id ?? org?.plan_type ?? (org as any)?.plan ?? '';
  const planStr = planId.toString().trim().toLowerCase();

  // All valid plans can access assessments
  const validPlans = [
    'solo',
    'team',
    'consultancy',
    'free',
    'core',
    'professional',
    'pro',
    'professional_plan',
    'pro_plan',
    'enterprise'
  ];

  const hasAccess = validPlans.includes(planStr) && planStr !== '';

  if (import.meta.env.DEV) {
    console.log('[PillarB/Assessments] 🔑 Access check:', {
      userId: user.id,
      orgId: org?.id,
      plan_id: org?.plan_id,
      plan_type: org?.plan_type,
      resolved: planStr,
      hasAccess,
      isPlatformAdmin: isPlatformAdmin(user)
    });
  }

  return hasAccess;
}

export function getPlanDisplayName(plan: PlanType | string): string {
  const planStr = plan.toString().toLowerCase();

  if (planStr === 'solo' || planStr === 'free') {
    return 'Solo';
  }
  if (planStr === 'team' || planStr === 'professional' || planStr === 'pro' || planStr === 'core') {
    return 'Team';
  }
  if (planStr === 'consultancy' || planStr === 'enterprise') {
    return 'Consultancy';
  }

  return 'Solo';
}

export function getSubscriptionStatusDisplayName(status: SubscriptionStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'trialing':
      return 'Trial';
    case 'past_due':
      return 'Past Due';
    case 'canceled':
      return 'Canceled';
    case 'inactive':
      return 'Inactive';
    default:
      return 'Unknown';
  }
}

export const PLAN_FEATURES = {
  solo: {
    name: 'Solo',
    maxEditors: 1,
    proFeatures: false,
    addons: false,
    disciplineSwitching: false,
    description: '1 user, basic features'
  },
  team: {
    name: 'Team',
    maxEditors: 5,
    proFeatures: true,
    addons: true,
    disciplineSwitching: false,
    description: '5 users, AI features'
  },
  consultancy: {
    name: 'Consultancy',
    maxEditors: 999,
    proFeatures: true,
    addons: true,
    disciplineSwitching: true,
    description: 'Unlimited users and features'
  },
  free: {
    name: 'Solo',
    maxEditors: 1,
    proFeatures: false,
    addons: false,
    disciplineSwitching: false,
    description: '1 user, basic features'
  },
  core: {
    name: 'Solo',
    maxEditors: 1,
    proFeatures: false,
    addons: false,
    disciplineSwitching: false,
    description: '1 user, basic features'
  },
  professional: {
    name: 'Team',
    maxEditors: 5,
    proFeatures: true,
    addons: true,
    disciplineSwitching: false,
    description: '5 users, AI features'
  },
  enterprise: {
    name: 'Consultancy',
    maxEditors: 999,
    proFeatures: true,
    addons: true,
    disciplineSwitching: true,
    description: 'Unlimited users and features'
  }
};

export const ADDON_KEYS = {
  FRA_FORM: 'fra_form',
  BCM_FORM: 'bcm_form',
  ATEX_FORM: 'atex_form',
  ASEAR_FORM: 'asear_form'
};

export const ADDON_DISPLAY_NAMES = {
  [ADDON_KEYS.FRA_FORM]: 'Fire Risk Assessment',
  [ADDON_KEYS.BCM_FORM]: 'Business Continuity Management',
  [ADDON_KEYS.ATEX_FORM]: 'ATEX Assessment',
  [ADDON_KEYS.ASEAR_FORM]: 'ASEAR Assessment'
};

export const ENTITLEMENTS = {
  core: {
    canAccessRiskEngineering: false,
    canGenerateAiExecutiveSummary: false,
    canShareWithClients: false,
    canUseApprovalWorkflow: false,
  },
  professional: {
    canAccessRiskEngineering: true,
    canGenerateAiExecutiveSummary: true,
    canShareWithClients: true,
    canUseApprovalWorkflow: true,
  },
};

export function canAccessRiskEngineering(org?: Organisation | null): boolean {
  if (!org) {
    return false;
  }

  const tier = getPlanTier(org);

  if (tier === 'enterprise') return true;
  if (tier === 'professional') return ENTITLEMENTS.professional.canAccessRiskEngineering;

  return false;
}

export function canGenerateAiSummary(org?: Organisation | null): boolean {
  if (!org) {
    return false;
  }

  const tier = getPlanTier(org);

  if (tier === 'enterprise') return true;
  if (tier === 'professional') return ENTITLEMENTS.professional.canGenerateAiExecutiveSummary;

  return false;
}

export function canShareWithClients(org?: Organisation | null): boolean {
  if (!org) {
    return false;
  }

  const tier = getPlanTier(org);

  if (tier === 'enterprise') return true;
  if (tier === 'professional') return ENTITLEMENTS.professional.canShareWithClients;

  return false;
}

export function canUseApprovalWorkflow(org?: Organisation | null): boolean {
  if (!org) {
    return false;
  }

  const tier = getPlanTier(org);

  if (tier === 'enterprise') return true;
  if (tier === 'professional') return ENTITLEMENTS.professional.canUseApprovalWorkflow;

  return false;
}
