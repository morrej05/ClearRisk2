import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut } from 'lucide-react';
import { isFeatureEnabled } from '../utils/featureFlags';
import { getRolePermissions } from '../utils/permissions';
import { canAccessPlatformSettings } from '../utils/entitlements';

export default function PrimaryNavigation() {
  const location = useLocation();
  const { signOut, userRole, user } = useAuth();
  const permissions = getRolePermissions(userRole);

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', show: true },
    { label: 'Assessments', path: '/assessments', show: true },
    { label: 'Reports', path: '/reports', show: true },
    { label: 'Impairments', path: '/impairments', show: isFeatureEnabled('IMPAIRMENTS_ENABLED') },
    { label: 'Library', path: '/library', show: true },
    { label: 'Admin', path: '/admin', show: permissions.canAccessAdmin && !canAccessPlatformSettings(user as any) },
    { label: 'Platform', path: '/platform', show: user && canAccessPlatformSettings(user as any) },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <nav className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <div className="text-xl font-bold text-slate-900">EZIRisk</div>

            <div className="flex items-center gap-1">
              {navItems.filter(item => item.show).map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive(item.path)
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}
