import { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import AppLayout from './AppLayout';

interface AuthedLayoutProps {
  children?: ReactNode;
}

export default function AuthedLayout({ children }: AuthedLayoutProps) {
  return (
    <ProtectedRoute>
      <AppLayout>
        {children ?? <Outlet />}
      </AppLayout>
    </ProtectedRoute>
  );
}
