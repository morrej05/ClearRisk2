import { ReactNode } from 'react';
import ProtectedRoute from './ProtectedRoute';
import AppLayout from './AppLayout';

interface AuthedLayoutProps {
  children: ReactNode;
}

export default function AuthedLayout({ children }: AuthedLayoutProps) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}
