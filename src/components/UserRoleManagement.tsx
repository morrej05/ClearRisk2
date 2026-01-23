import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserRole } from '../utils/permissions';
import { Users, AlertCircle, CheckCircle, Shield } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  created_at: string;
}

export default function UserRoleManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: true });

      if (usersError) throw usersError;

      const { data: { user: currentUser } } = await supabase.auth.getUser();

      const enrichedUsers: UserProfile[] = (usersData || []).map(user => {
        let email = 'Unknown';

        if (currentUser && user.id === currentUser.id) {
          email = currentUser.email || 'Unknown';
        } else {
          email = user.name;
        }

        return {
          id: user.id,
          email: email,
          role: user.role as UserRole,
          name: user.name || email,
          created_at: user.created_at
        };
      });

      setUsers(enrichedUsers);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (newRole === 'admin') {
      if (!confirm('Are you sure you want to grant Admin privileges? This gives full organization access.')) {
        return;
      }
    }

    try {
      setUpdatingUserId(userId);
      setError(null);
      setSuccessMessage(null);

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (updateError) throw updateError;

      setUsers(users.map(u =>
        u.id === userId ? { ...u, role: newRole } : u
      ));

      setSuccessMessage(`User role updated to ${newRole}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error updating role:', err);
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'surveyor':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'viewer':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getRoleDisplayName = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'surveyor':
        return 'Surveyor';
      case 'viewer':
        return 'Viewer';
      default:
        return role;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg">
            <Users className="w-6 h-6 text-slate-700" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">User Role Management</h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Manage user roles and permissions across the platform
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="mx-6 mt-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-green-900">{successMessage}</p>
        </div>
      )}

      <div className="p-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Role Hierarchy</p>
              <ul className="space-y-1 text-blue-800">
                <li><strong>Super Admin:</strong> Full platform access, can manage all settings and users</li>
                <li><strong>Org Admin:</strong> Can manage users and surveys within organization</li>
                <li><strong>Surveyor:</strong> Can create and edit their own surveys</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto -mx-6 px-6">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">User</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Email</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Current Role</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Change Role</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <p className="text-sm font-medium text-slate-900">{user.name}</p>
                    <p className="text-xs text-slate-500 font-mono whitespace-nowrap">{user.id.slice(0, 8)}...</p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-sm text-slate-700 max-w-[200px] truncate">{user.email}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${getRoleBadgeColor(user.role)}`}>
                      {getRoleDisplayName(user.role)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                      disabled={updatingUserId === user.id}
                      className="text-sm border border-slate-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="surveyor">Surveyor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-sm text-slate-600">
                      {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600">No users found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
