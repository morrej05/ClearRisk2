import { Link, useLocation } from 'react-router-dom';

export default function ReportsPage() {
  const location = useLocation();

  const subNavItems = [
    { label: 'Issued Reports', path: '/reports' },
    { label: 'Combined Reports', path: '/reports/combined' },
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
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

        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Report Reference
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Client / Site
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Discipline
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Issue Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Version
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                    No issued reports found
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
  );
}
