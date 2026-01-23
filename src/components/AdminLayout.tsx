import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { organisation } = useAuth() as any;
  const loc = useLocation();

  const nav = [
    { to: '/admin', label: 'Overview' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/branding', label: 'Branding' },
    { to: '/admin/billing', label: 'Plan & Billing' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">Admin</span>
            {organisation?.name ? <span> · {organisation.name}</span> : null}
          </div>
          <Link to="/dashboard" className="text-sm text-slate-700 hover:text-slate-900">
            Exit Admin
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-12 gap-6">
        <aside className="col-span-12 md:col-span-3">
          <div className="bg-white border rounded-xl p-2">
            {nav.map((n) => {
              const active = loc.pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={[
                    'block px-3 py-2 rounded-lg text-sm',
                    active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100',
                  ].join(' ')}
                >
                  {n.label}
                </Link>
              );
            })}
          </div>
        </aside>

        <main className="col-span-12 md:col-span-9">{children}</main>
      </div>
    </div>
  );
}
