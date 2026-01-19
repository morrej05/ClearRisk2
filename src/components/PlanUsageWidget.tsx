import { Users, Database } from 'lucide-react';
import { useTenant } from '../hooks/useTenant';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function PlanUsageWidget() {
  const { tenant } = useTenant();
  const [userCount, setUserCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserCount = async () => {
      if (!tenant?.id) return;

      try {
        const { count, error } = await supabase
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('organisation_id', tenant.id);

        if (error) {
          console.error('[PlanUsageWidget] Error fetching user count:', error);
          return;
        }

        setUserCount(count || 0);
      } catch (err) {
        console.error('[PlanUsageWidget] Exception:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserCount();
  }, [tenant?.id]);

  if (isLoading || !tenant || !tenant.plan) {
    return null;
  }

  const storagePercent = (tenant.storage_used_mb / tenant.plan.max_storage_mb) * 100;
  const usersPercent = (userCount / tenant.plan.max_users) * 100;

  const getStorageColor = () => {
    if (storagePercent >= 100) return 'bg-red-500';
    if (storagePercent >= 80) return 'bg-amber-500';
    return 'bg-blue-500';
  };

  const getUsersColor = () => {
    if (usersPercent >= 100) return 'bg-red-500';
    if (usersPercent >= 80) return 'bg-amber-500';
    return 'bg-blue-500';
  };

  const formatStorageSize = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb} MB`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Plan & Usage</h3>

      <div className="space-y-4">
        {import.meta.env.DEV && (
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <div className="text-xs font-semibold text-blue-900 mb-2">🔧 Dev Diagnostics</div>
            <div className="text-xs font-mono text-blue-800 space-y-1">
              <div>Org loaded: <span className="font-bold text-green-700">✓ Yes</span></div>
              <div>Org ID: {tenant.id.substring(0, 8)}...</div>
              <div>Plan ID: <span className="font-bold">{tenant.plan_id}</span></div>
              <div>Status: {tenant.subscription_status || 'N/A'}</div>
            </div>
          </div>
        )}

        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <div className="text-sm font-medium text-slate-600 mb-1">Current Plan</div>
          <div className="text-xl font-bold text-slate-900">{tenant.plan.name}</div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">Users</span>
            </div>
            <span className="text-sm font-semibold text-slate-900">
              {userCount} / {tenant.plan.max_users}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${getUsersColor()}`}
              style={{ width: `${Math.min(usersPercent, 100)}%` }}
            />
          </div>
          {usersPercent >= 80 && (
            <p className="text-xs text-amber-700 mt-1">
              {usersPercent >= 100 ? 'User limit reached' : 'Approaching user limit'}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">Storage</span>
            </div>
            <span className="text-sm font-semibold text-slate-900">
              {formatStorageSize(tenant.storage_used_mb)} / {formatStorageSize(tenant.plan.max_storage_mb)}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${getStorageColor()}`}
              style={{ width: `${Math.min(storagePercent, 100)}%` }}
            />
          </div>
          {storagePercent >= 80 && (
            <p className="text-xs text-amber-700 mt-1">
              {storagePercent >= 100 ? 'Storage limit reached' : 'Approaching storage limit'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
