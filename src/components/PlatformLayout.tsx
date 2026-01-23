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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-slate-700 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-slate-900 text-white px-2 py-0.5 text-xs font-semibold">
              Platform
            </span>
          </div>
          <Link to="/dashboard" className="text-sm text-slate-700 hover:text-slate-900">
            Exit Platform
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
