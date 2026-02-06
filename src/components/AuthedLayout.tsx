import { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import AppLayout from './AppLayout';

interface AuthedLayoutProps {
  children?: ReactNode;
}

export default function AuthedLayout({ children }: AuthedLayoutProps) {
  return <AppLayout>{children ?? <Outlet />}</AppLayout>;
}
