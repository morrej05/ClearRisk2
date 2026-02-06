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

  // Always render something while auth/profile is hydrating
  if (!authInitialized || loading) {
    return <FullPageLoading />;
  }

  // ✅ Only gate on actual sign-in state
  if (!user) {
    return (
      <Navigate
        to="/signin"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  // ✅ If user exists, never redirect from here
  return <>{children}</>;
}
