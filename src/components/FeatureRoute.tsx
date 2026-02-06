import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
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

function FullPageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center text-slate-600">
      Loading…
    </div>
  );
}

export default function FeatureRoute({
  feature,
  children,
  redirectTo = '/upgrade',
}: FeatureRouteProps) {
  const location = useLocation();
  const { user, organisation, authInitialized } = useAuth() as any;

  // While auth/org context is hydrating (including during logout transitions),
  // do NOT redirect to dashboard (causes flicker/loops). Show a safe loader.
  if (!authInitialized) return <FullPageLoading />;

  // If not signed in, always go to sign-in (and preserve where they came from)
  if (!user) {
    return (
      <Navigate
        to="/signin"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  // Platform admins bypass all feature gates
  if (isPlatformAdmin(user)) return <>{children}</>;

  // Org context can briefly be null during route changes/refetch.
  // Don't bounce to dashboard; wait for org to hydrate.
  if (!organisation) return <FullPageLoading />;

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
