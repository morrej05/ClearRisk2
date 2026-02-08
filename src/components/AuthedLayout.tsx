import { Outlet } from 'react-router-dom';
import AppLayout from './AppLayout';

export default function AuthedLayout() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
