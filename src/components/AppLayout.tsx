import { ReactNode } from 'react';
import PrimaryNavigation from './PrimaryNavigation';
import BillingStatusBanner from './BillingStatusBanner';
import { useAuth } from '../contexts/AuthContext';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, loading, authInitialized, organisation } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <PrimaryNavigation />
      <BillingStatusBanner />

      {/* TEMP DEBUG OVERLAY */}
      <div className="fixed bottom-2 right-2 z-50 text-xs bg-black/80 text-white px-3 py-2 rounded">
        <div>authInitialized: {String(authInitialized)}</div>
        <div>loading: {String(loading)}</div>
        <div>user: {user ? 'YES' : 'NO'}</div>
        <div>org: {organisation ? 'YES' : 'NO'}</div>
      </div>

      {children}
    </div>
  );
}
