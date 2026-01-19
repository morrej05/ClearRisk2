export type PlanType = 'free' | 'core' | 'professional' | 'enterprise';
export type DisciplineType = 'engineering' | 'assessment' | 'both';
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'inactive';
export type UserRole = 'admin' | 'surveyor' | 'viewer';

export interface Organisation {
  id: string;
  name: string;
  plan_type: PlanType;
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

export function canEdit(user: User, org: Organisation): boolean {
  if (user.role === 'viewer') {
    return false;
  }

  if (!user.can_edit) {
    return false;
  }

  const isActiveSubscription = org.subscription_status === 'active' || org.plan_type === 'enterprise';

  return isActiveSubscription;
}

export function canAccessProFeatures(org: Organisation): boolean {
  const isProOrEnterprise = org.plan_type === 'professional' || org.plan_type === 'enterprise';
  const isActive = org.subscription_status === 'active' || org.plan_type === 'enterprise';

  return isProOrEnterprise && isActive;
}

export function hasAddon(org: Organisation, addonKey: string): boolean {
  if (org.plan_type === 'enterprise') {
    return true;
  }

  return org.enabled_addons.includes(addonKey);
}

export function canSwitchDiscipline(org: Organisation): boolean {
  return org.plan_type === 'enterprise' && org.discipline_type === 'both';
}

export function canAccessAdmin(user: User): boolean {
  return isOrgAdmin(user);
}

export function canAccessPlatformSettings(user: User): boolean {
  return isPlatformAdmin(user);
}

export function canViewData(org: Organisation): boolean {
  return true;
}

export function canExportData(org: Organisation): boolean {
  return true;
}

export function isSubscriptionActive(org: Organisation): boolean {
  return org.subscription_status === 'active' || org.plan_type === 'enterprise';
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

export function canCreateSurveys(user: User, org: Organisation): boolean {
  return canEdit(user, org);
}

export function canDeleteSurveys(user: User): boolean {
  return isOrgAdmin(user);
}

export function canIssueSurveys(user: User, org: Organisation): boolean {
  return canEdit(user, org);
}

export function canAccessPillarB(user: User, org: Organisation): boolean {
  if (isPlatformAdmin(user)) {
    return true;
  }

  const planId = (org as any)?.plan_id ?? org?.plan_type ?? (org as any)?.plan ?? '';
  const planStr = planId.toString().trim().toLowerCase();

  const hasAccess =
    planStr === 'team' ||
    planStr === 'consultancy' ||
    planStr === 'professional' ||
    planStr === 'pro' ||
    planStr === 'professional_plan' ||
    planStr === 'pro_plan' ||
    planStr === 'enterprise';

  if (import.meta.env.DEV) {
    console.log('[PillarB] org plan_id:', planStr, 'hasAccess:', hasAccess, 'raw org:', org);
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
