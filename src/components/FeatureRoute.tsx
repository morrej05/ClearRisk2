import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isPlatformAdmin } from '../utils/entitlements';
import {
  canAccessRiskEngineering,
  canAccessExplosionSafety,
  isSubscriptionActive,
} from '../utils/entitlements';

type FeatureKey = 'riskEngineering' | 'explosionSafety';

interface FeatureRouteProps {
  feature: FeatureKey;
  children: ReactNode;
  redirectTo?: string;
}

export default function FeatureRoute({
  feature,
  children,
  redirectTo = '/upgrade',
}: FeatureRouteProps) {
  const { user, organisation, authInitialized } = useAuth() as any;

  if (!authInitialized) return null;
  if (!user) return <Navigate to="/signin" replace />;

  // Platform admins bypass all feature gates
  if (isPlatformAdmin(user)) return <>{children}</>;

  // Must have org context
  if (!organisation) return <Navigate to="/dashboard" replace />;

  // Enforce active subscription for paid features
  if (!isSubscriptionActive(organisation)) {
    return <Navigate to={redirectTo} replace />;
  }

  let allowed = false;

  if (feature === 'riskEngineering') {
    allowed = canAccessRiskEngineering(organisation);
  } else if (feature === 'explosionSafety') {
    allowed = canAccessExplosionSafety(user, organisation);
  }

  if (!allowed) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
