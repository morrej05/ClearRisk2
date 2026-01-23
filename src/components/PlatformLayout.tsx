import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Shield, Building2, Users, CreditCard, Flag } from 'lucide-react';

interface PlatformLayoutProps {
  children: ReactNode;
}

export default function PlatformLayout({ children }: PlatformLayoutProps) {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { label: 'Organisations', path: '/platform/organisations', icon: Building2 },
    { label: 'Users', path: '/platform/users', icon: Users },
    { label: 'Plans', path: '/platform/plans', icon: CreditCard },
    { label: 'Feature Flags', path: '/platform/features', icon: Flag },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside className="w-64 bg-slate-900 border-r-4 border-amber-500 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3 text-white">
            <Shield className="w-6 h-6 text-amber-500" />
            <h2 className="text-lg font-bold">Platform</h2>
          </div>
          <p className="text-sm text-slate-400 mt-2">
            Global Administration
          </p>
        </div>

        <div className="bg-amber-500 text-amber-950 px-4 py-3 text-sm font-medium flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Platform-wide changes
        </div>

        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive(item.path)
                      ? 'bg-amber-500 text-slate-900'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <Link
            to="/dashboard"
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Exit Platform
          </Link>
        </div>
      </aside>

      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
