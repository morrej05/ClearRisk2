export type UserRole = 'admin' | 'editor' | 'viewer';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Full access including user management, branding, and all survey operations',
  editor: 'Can create, edit, and manage surveys and reports',
  viewer: 'Read-only access to surveys and reports',
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
        canGenerateAISummary: true,
        canExportReports: true,
      };

    case 'editor':
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
        canManageUsers: false,
        canManageBranding: false,
        canAccessAdmin: false,
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
