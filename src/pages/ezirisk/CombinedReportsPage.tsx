import { Link, useLocation } from 'react-router-dom';
import AppLayout from '../../components/AppLayout';

export default function CombinedReportsPage() {
  const location = useLocation();

  const subNavItems = [
    { label: 'Issued Reports', path: '/reports' },
    { label: 'Combined Reports', path: '/reports/combined' },
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
        </div>

        <div className="mb-6 border-b border-slate-200">
          <nav className="flex gap-6">
            {subNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive(item.path)
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Combined Reports</h2>
          <p className="text-sm text-slate-600">Combined reports will be listed here.</p>
        </div>
      </div>
    </AppLayout>
  );
}
