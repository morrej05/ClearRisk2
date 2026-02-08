import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut } from 'lucide-react';
import { isFeatureEnabled } from '../utils/featureFlags';
import { canAccessAdmin, canAccessPlatformSettings } from '../utils/entitlements';
import { useState } from 'react';

export default function PrimaryNavigation() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [logoError, setLogoError] = useState(false);

  const isActive = (path: string) => {
    if (path === '/dashboard') {
  return location.pathname === '/dashboard' || location.pathname.startsWith('/dashboard/');
}
    return location.pathname.startsWith(path);
  };

  const userObj = user ? { ...user, role: (user as any).role, is_platform_admin: (user as any).is_platform_admin } : null;

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', show: true },
    { label: 'Assessments', path: '/assessments', show: true },
    { label: 'Reports', path: '/library', show: false },
    { label: 'Impairments', path: '/impairments', show: isFeatureEnabled('IMPAIRMENTS_ENABLED') },
    { label: 'Library', path: '/library', show: true },
    { label: 'Admin', path: '/admin', show: userObj ? canAccessAdmin(userObj) : false },
    { label: 'Platform', path: '/super-admin', show: userObj ? canAccessPlatformSettings(userObj) : false },
  ];


  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <nav className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link
              to="/dashboard"
              className="flex items-center transition-opacity hover:opacity-80"
            >
              {!logoError ? (
                <img
                  src="/ezirisk-logo-primary.svg"
                  alt="EziRisk"
                  className="h-8"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="flex items-center gap-1">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-700 to-blue-500 rounded flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <span className="text-xl font-bold text-slate-900">EziRisk</span>
                </div>
              )}
            </Link>

            {import.meta.env.DEV && user ? (
              <div className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">
                role: {String((user as any).role)} · platform: {String((user as any).is_platform_admin)}
              </div>
            ) : null}

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
