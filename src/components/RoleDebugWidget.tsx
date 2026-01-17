import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { UserRole } from '../utils/permissions';

export default function RoleDebugWidget() {
  const { user, userRole, roleError } = useAuth();
  const [dbRole, setDbRole] = useState<UserRole | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDbRole = async () => {
    if (!user) {
      setDbRole(null);
      setDbError('No authenticated user');
      return;
    }

    setLoading(true);
    setDbError(null);

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        setDbError(`${error.message} (${error.code})`);
        setDbRole(null);
      } else if (!data) {
        setDbError('Profile not found in database');
        setDbRole(null);
      } else {
        setDbRole(data.role as UserRole);
        setDbError(null);
      }
    } catch (err) {
      setDbError(err instanceof Error ? err.message : 'Unknown error');
      setDbRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDbRole();
  }, [user?.id]);

  if (!user) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-slate-700">
          <AlertCircle className="w-5 h-5" />
          <span className="font-semibold">Role Debug: No user authenticated</span>
        </div>
      </div>
    );
  }

  const rolesMatch = dbRole && userRole && dbRole === userRole;
  const hasError = roleError || dbError;

  return (
    <div className="bg-white border-2 border-slate-300 rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-900">Role Debug Info</h3>
        </div>
        <button
          onClick={fetchDbRole}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Auth User</p>
            <p className="text-sm font-mono text-slate-900 break-all">{user.id}</p>
            <p className="text-sm text-slate-700 mt-1">{user.email}</p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Status</p>
            <div className="flex items-center gap-2">
              {rolesMatch ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-700">Roles Match</span>
                </>
              ) : hasError ? (
                <>
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span className="text-sm font-medium text-red-700">Error Detected</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-700">Mismatch</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left py-2 px-4 font-semibold text-slate-700">Source</th>
                <th className="text-left py-2 px-4 font-semibold text-slate-700">Role Value</th>
                <th className="text-left py-2 px-4 font-semibold text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 font-medium text-slate-900">Context State</td>
                <td className="py-3 px-4">
                  {userRole ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                      {userRole}
                    </span>
                  ) : (
                    <span className="text-slate-500 italic">null</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  {userRole ? (
                    <span className="text-green-700 text-xs">✓ Loaded</span>
                  ) : (
                    <span className="text-red-700 text-xs">✗ Not loaded</span>
                  )}
                </td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 font-medium text-slate-900">Database Query</td>
                <td className="py-3 px-4">
                  {loading ? (
                    <span className="text-slate-500 italic">Loading...</span>
                  ) : dbRole ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                      {dbRole}
                    </span>
                  ) : (
                    <span className="text-slate-500 italic">null</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  {loading ? (
                    <span className="text-slate-500 text-xs">Querying...</span>
                  ) : dbRole ? (
                    <span className="text-green-700 text-xs">✓ Found</span>
                  ) : (
                    <span className="text-red-700 text-xs">✗ Not found</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {roleError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900 mb-1">Context Error</p>
                <p className="text-sm text-red-700 font-mono">{roleError}</p>
              </div>
            </div>
          </div>
        )}

        {dbError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900 mb-1">Database Error</p>
                <p className="text-sm text-red-700 font-mono">{dbError}</p>
              </div>
            </div>
          </div>
        )}

        {rolesMatch && !hasError && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-900">Everything looks good!</p>
                <p className="text-sm text-green-700 mt-1">
                  Role is correctly loaded as <strong>{userRole}</strong> from the database.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-blue-900 mb-2">Troubleshooting Tips</p>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• If "Context State" shows null but "Database Query" shows a role, try signing out and back in</li>
            <li>• If both show null, check that your user profile exists in the database</li>
            <li>• If there's a database error, check RLS policies allow SELECT where auth.uid() = id</li>
            <li>• Check browser console (F12) for detailed error logs prefixed with [AuthContext]</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
