import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Users, Palette, CreditCard, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const { organisation } = useAuth();

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { label: 'Users', path: '/admin/users', icon: Users },
    { label: 'Branding', path: '/admin/branding', icon: Palette },
    { label: 'Billing & Plan', path: '/admin/billing', icon: CreditCard },
    { label: 'Organisation Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Admin</h2>
          {organisation?.name && (
            <p className="text-sm text-slate-600 mt-1">{organisation.name}</p>
          )}
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
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-200">
          <Link
            to="/dashboard"
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 font-medium rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Exit Admin
          </Link>
        </div>
      </aside>

      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
