export type UserRole = 'super_admin' | 'org_admin' | 'surveyor';

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  org_admin: 'Organization Admin',
  surveyor: 'Surveyor',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  super_admin: 'Platform-wide access including sector weightings, recommendation library, and all system settings',
  org_admin: 'Organization management including user management, branding, and all survey operations',
  surveyor: 'Can create, edit, and manage surveys and reports',
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
  canAccessSuperAdmin: boolean;
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
      canAccessSuperAdmin: false,
      canManageSectorWeightings: false,
      canManageRecommendationLibrary: false,
      canManagePlatformSettings: false,
      canGenerateAISummary: false,
      canExportReports: false,
    };
  }

  switch (role) {
    case 'super_admin':
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
        canAccessSuperAdmin: true,
        canManageSectorWeightings: true,
        canManageRecommendationLibrary: true,
        canManagePlatformSettings: true,
        canGenerateAISummary: true,
        canExportReports: true,
      };

    case 'org_admin':
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
        canAccessSuperAdmin: false,
        canManageSectorWeightings: false,
        canManageRecommendationLibrary: false,
        canManagePlatformSettings: false,
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
        canAccessSuperAdmin: false,
        canManageSectorWeightings: false,
        canManageRecommendationLibrary: false,
        canManagePlatformSettings: false,
        canGenerateAISummary: true,
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
