import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Shield, Edit2, X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserRole, ROLE_LABELS, ROLE_DESCRIPTIONS } from '../utils/permissions';

interface UserProfile {
  id: string;
  role: UserRole;
  name: string | null;
  email?: string;
  created_at: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('viewer');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<UserRole>('viewer');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: true });

      if (profilesError) throw profilesError;

      const { data: authUsers } = await supabase.auth.admin.listUsers();

      const usersWithEmails = (profilesData || []).map(profile => {
        const authUser = authUsers?.users.find(u => u.id === profile.id);
        return {
          ...profile,
          email: authUser?.email,
        };
      });

      setUsers(usersWithEmails);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUserEmail.trim()) {
      alert('Email is required');
      return;
    }

    setIsAddingUser(true);
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: newUserEmail.trim(),
        password: Math.random().toString(36).slice(-12) + 'Aa1!',
        options: {
          data: {
            name: newUserName.trim() || newUserEmail.trim(),
          },
        },
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({ role: newUserRole })
          .eq('id', authData.user.id);

        if (profileError) throw profileError;
      }

      setShowAddModal(false);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserRole('viewer');
      fetchUsers();
    } catch (error: any) {
      console.error('Error adding user:', error);
      alert(error.message || 'Failed to add user. Please try again.');
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      setEditingUserId(null);
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Failed to update user role. Please try again.');
    }
  };

  const handleDeleteUser = async (userId: string, userEmail?: string) => {
    if (!confirm(`Are you sure you want to delete user ${userEmail || 'this user'}? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      if (authError) throw authError;

      setUsers(users.filter(u => u.id !== userId));
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user. Please try again.');
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'editor':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'viewer':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-slate-900"></div>
          <span className="ml-3 text-slate-600">Loading users...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-900">User Management</h2>
          <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">
            {users.length} {users.length === 1 ? 'user' : 'users'}
          </span>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                      <span className="text-sm font-medium text-slate-600">
                        {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-slate-900">
                      {user.name || 'Unnamed User'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {user.email || '—'}
                </td>
                <td className="px-6 py-4">
                  {editingUserId === user.id ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={editingRole}
                        onChange={(e) => setEditingRole(e.target.value as UserRole)}
                        className="text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-500"
                      >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        onClick={() => handleUpdateRole(user.id, editingRole)}
                        className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Save"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingUserId(null)}
                        className="p-1 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-semibold ${getRoleBadgeColor(user.role)}`}>
                        <Shield className="w-3 h-3" />
                        {ROLE_LABELS[user.role]}
                      </span>
                      <button
                        onClick={() => {
                          setEditingUserId(user.id);
                          setEditingRole(user.role);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                        title="Edit role"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {formatDate(user.created_at)}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => handleDeleteUser(user.id, user.email)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete user"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 mb-2">No users found</p>
          <p className="text-sm text-slate-500">Add your first user to get started</p>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Add New User</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 text-slate-900"
                >
                  <option value="viewer">Viewer - Read-only access</option>
                  <option value="editor">Editor - Can create and edit surveys</option>
                  <option value="admin">Admin - Full access</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  {ROLE_DESCRIPTIONS[newUserRole]}
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                disabled={isAddingUser}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUser}
                disabled={isAddingUser}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingUser ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add User
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
