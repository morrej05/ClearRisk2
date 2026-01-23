import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function PlatformLayout({ children }: { children: ReactNode }) {
  const loc = useLocation();

  const nav = [
    { to: '/platform', label: 'Overview' },
    { to: '/platform/orgs', label: 'Organisations' },
    { to: '/platform/users', label: 'Users' },
    { to: '/platform/flags', label: 'Feature Flags' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="border-b border-slate-800 bg-slate-950">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-sm">
            <span className="font-semibold">Platform</span>
          </div>
          <Link to="/dashboard" className="text-sm text-slate-200 hover:text-white">
            Exit Platform
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-12 gap-6">
        <aside className="col-span-12 md:col-span-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2">
            {nav.map((n) => {
              const active = loc.pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={[
                    'block px-3 py-2 rounded-lg text-sm',
                    active ? 'bg-white text-slate-950' : 'text-slate-200 hover:bg-slate-800',
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
