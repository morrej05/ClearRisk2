import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

function FullPageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center text-slate-600">
      Loading…
    </div>
  );
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const { user, authInitialized, loading } = useAuth();

  // During bootstrap / refresh, never render nothing and never redirect
  if (!authInitialized || loading) {
    return <FullPageLoading />;
  }

  // If logged out, always go to sign-in and preserve where they were headed
  if (!user) {
    return (
      <Navigate
        to="/signin"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return <>{children}</>;
}
