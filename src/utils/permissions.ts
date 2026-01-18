export type UserRole = 'admin' | 'surveyor' | 'viewer';

export type SubscriptionPlan = 'free' | 'core' | 'professional' | 'enterprise';

export type DisciplineType = 'engineering' | 'assessment' | 'both';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  surveyor: 'Surveyor',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Full access including user management, billing, and all survey operations',
  surveyor: 'Can create, edit, and manage surveys within plan limits',
  viewer: 'Read-only access to surveys and reports',
};

export const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  free: 'Free',
  core: 'Core',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

export const PLAN_DESCRIPTIONS: Record<SubscriptionPlan, string> = {
  free: 'Basic features with limited functionality',
  core: 'Essential features for small teams (1 editor)',
  professional: 'Advanced features for growing teams (3 editors)',
  enterprise: 'Complete solution with premium features (10 editors)',
};

export const DISCIPLINE_LABELS: Record<DisciplineType, string> = {
  engineering: 'Fire Engineering',
  assessment: 'Fire Risk Assessment',
  both: 'Both Disciplines',
};

export interface PlanLimits {
  maxEditors: number;
  canSwitchDiscipline: boolean;
  hasSmartRecommendations: boolean;
  hasBoltOns: boolean;
}

export const getPlanLimits = (plan: SubscriptionPlan | null): PlanLimits => {
  switch (plan) {
    case 'core':
      return {
        maxEditors: 1,
        canSwitchDiscipline: false,
        hasSmartRecommendations: false,
        hasBoltOns: false,
      };
    case 'professional':
      return {
        maxEditors: 3,
        canSwitchDiscipline: false,
        hasSmartRecommendations: true,
        hasBoltOns: false,
      };
    case 'enterprise':
      return {
        maxEditors: 10,
        canSwitchDiscipline: true,
        hasSmartRecommendations: true,
        hasBoltOns: true,
      };
    case 'free':
    default:
      return {
        maxEditors: 999,
        canSwitchDiscipline: false,
        hasSmartRecommendations: false,
        hasBoltOns: false,
      };
  }
};

export interface RolePermissions {
  canViewSurveys: boolean;
  canCreateSurveys: boolean;
  canEditSurveys: boolean;
  canDeleteSurveys: boolean;
  canIssueSurveys: boolean;
  canResurvey: boolean;
  canGenerateExternalLink: boolean;
  canEditSurveyText: boolean;
  canGeneratePortfolioSummary: boolean;
  canManageUsers: boolean;
  canManageBranding: boolean;
  canAccessAdmin: boolean;
  canManageSectorWeightings: boolean;
  canManageRecommendationLibrary: boolean;
  canManagePlatformSettings: boolean;
  canGenerateAISummary: boolean;
  canExportReports: boolean;
}

export const getRolePermissions = (role: UserRole | null): RolePermissions => {
  if (!role) {
    return {
      canViewSurveys: false,
      canCreateSurveys: false,
      canEditSurveys: false,
      canDeleteSurveys: false,
      canIssueSurveys: false,
      canResurvey: false,
      canGenerateExternalLink: false,
      canEditSurveyText: false,
      canGeneratePortfolioSummary: false,
      canManageUsers: false,
      canManageBranding: false,
      canAccessAdmin: false,
      canManageSectorWeightings: false,
      canManageRecommendationLibrary: false,
      canManagePlatformSettings: false,
      canGenerateAISummary: false,
      canExportReports: false,
    };
  }

  switch (role) {
    case 'admin':
      return {
        canViewSurveys: true,
        canCreateSurveys: true,
        canEditSurveys: true,
        canDeleteSurveys: true,
        canIssueSurveys: true,
        canResurvey: true,
        canGenerateExternalLink: true,
        canEditSurveyText: true,
        canGeneratePortfolioSummary: true,
        canManageUsers: true,
        canManageBranding: true,
        canAccessAdmin: true,
        canManageSectorWeightings: true,
        canManageRecommendationLibrary: true,
        canManagePlatformSettings: true,
        canGenerateAISummary: true,
        canExportReports: true,
      };

    case 'surveyor':
      return {
        canViewSurveys: true,
        canCreateSurveys: true,
        canEditSurveys: true,
        canDeleteSurveys: false,
        canIssueSurveys: false,
        canResurvey: false,
        canGenerateExternalLink: false,
        canEditSurveyText: true,
        canGeneratePortfolioSummary: false,
        canManageUsers: false,
        canManageBranding: false,
        canAccessAdmin: false,
        canManageSectorWeightings: false,
        canManageRecommendationLibrary: false,
        canManagePlatformSettings: false,
        canGenerateAISummary: true,
        canExportReports: true,
      };

    case 'viewer':
      return {
        canViewSurveys: true,
        canCreateSurveys: false,
        canEditSurveys: false,
        canDeleteSurveys: false,
        canIssueSurveys: false,
        canResurvey: false,
        canGenerateExternalLink: false,
        canEditSurveyText: false,
        canGeneratePortfolioSummary: false,
        canManageUsers: false,
        canManageBranding: false,
        canAccessAdmin: false,
        canManageSectorWeightings: false,
        canManageRecommendationLibrary: false,
        canManagePlatformSettings: false,
        canGenerateAISummary: false,
        canExportReports: true,
      };

    default:
      return getRolePermissions(null);
  }
};

export const hasPermission = (
  role: UserRole | null,
  permission: keyof RolePermissions
): boolean => {
  const permissions = getRolePermissions(role);
  return permissions[permission];
};

export const canPerformAction = (
  role: UserRole | null,
  action: keyof RolePermissions
): boolean => {
  return hasPermission(role, action);
};

export interface PlanFeatures {
  hasSmartRecommendations: boolean;
  hasFRAModule: boolean;
  hasAdvancedAnalytics: boolean;
}

export const getPlanFeatures = (plan: SubscriptionPlan | null): PlanFeatures => {
  if (!plan) {
    return {
      hasSmartRecommendations: false,
      hasFRAModule: false,
      hasAdvancedAnalytics: false,
    };
  }

  switch (plan) {
    case 'free':
    case 'core':
      return {
        hasSmartRecommendations: false,
        hasFRAModule: false,
        hasAdvancedAnalytics: false,
      };

    case 'professional':
      return {
        hasSmartRecommendations: true,
        hasFRAModule: false,
        hasAdvancedAnalytics: true,
      };

    case 'enterprise':
      return {
        hasSmartRecommendations: true,
        hasFRAModule: true,
        hasAdvancedAnalytics: true,
      };

    default:
      return getPlanFeatures(null);
  }
};

export const hasPlanFeature = (
  plan: SubscriptionPlan | null,
  feature: keyof PlanFeatures
): boolean => {
  const features = getPlanFeatures(plan);
  return features[feature];
};

export const canAccessSmartRecommendations = (plan: SubscriptionPlan | null): boolean => {
  return hasPlanFeature(plan, 'hasSmartRecommendations');
};

export const canAccessFRAModule = (plan: SubscriptionPlan | null): boolean => {
  return hasPlanFeature(plan, 'hasFRAModule');
};

export const canSwitchDiscipline = (plan: SubscriptionPlan | null): boolean => {
  const limits = getPlanLimits(plan);
  return limits.canSwitchDiscipline;
};

export const hasBoltOnAccess = (plan: SubscriptionPlan | null): boolean => {
  const limits = getPlanLimits(plan);
  return limits.hasBoltOns;
};
