import { useState, useEffect } from 'react';
import { Plus, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import AddActionModal from '../actions/AddActionModal';

interface Action {
  id: string;
  recommended_action: string;
  status: string;
  priority_band: string | null;
  target_date: string | null;
  updated_at: string;
}

interface ModuleActionsProps {
  documentId: string;
  moduleInstanceId: string;
}

export default function ModuleActions({ documentId, moduleInstanceId }: ModuleActionsProps) {
  const [actions, setActions] = useState<Action[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchActions();
  }, [moduleInstanceId]);

  const fetchActions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('actions')
        .select('*')
        .eq('module_instance_id', moduleInstanceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActions(data || []);
    } catch (error) {
      console.error('Error fetching actions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'P1':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'P2':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'P3':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'P4':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-neutral-100 text-neutral-600 border-neutral-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-700';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700';
      case 'complete':
        return 'bg-green-100 text-green-700';
      case 'deferred':
        return 'bg-amber-100 text-amber-700';
      case 'not_applicable':
        return 'bg-neutral-100 text-neutral-600';
      default:
        return 'bg-neutral-100 text-neutral-600';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-neutral-900">Actions from this Module</h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white font-medium rounded-lg hover:bg-neutral-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Action
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-neutral-300 border-t-neutral-900"></div>
        </div>
      ) : actions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="w-12 h-12 text-neutral-300 mb-3" />
          <p className="text-neutral-500 text-sm">No actions added yet</p>
          <p className="text-neutral-400 text-xs">
            Click "Add Action" to create a recommended action for this module
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                  Due Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {actions.map((action) => (
                <tr key={action.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-bold rounded border ${getPriorityColor(
                        action.priority_band
                      )}`}
                    >
                      {action.priority_band || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                        action.status
                      )}`}
                    >
                      {formatStatus(action.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-neutral-900 max-w-lg">
                      {action.recommended_action}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-600">
                    {formatDate(action.target_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <AddActionModal
          documentId={documentId}
          moduleInstanceId={moduleInstanceId}
          onClose={() => setShowAddModal(false)}
          onActionCreated={() => {
            setShowAddModal(false);
            fetchActions();
          }}
        />
      )}
    </div>
  );
}
