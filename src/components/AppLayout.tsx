import { ReactNode } from 'react';
import PrimaryNavigation from './PrimaryNavigation';
import BillingStatusBanner from './BillingStatusBanner';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <PrimaryNavigation />
      <BillingStatusBanner />
      {children}
    </div>
  );
}
