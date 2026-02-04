import { useState, useEffect } from 'react';
import { Plus, AlertCircle, ChevronRight, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import AddActionModal from '../actions/AddActionModal';
import ActionDetailModal from '../actions/ActionDetailModal';
import FeedbackModal from '../FeedbackModal';

interface Action {
  id: string;
  recommended_action: string;
  status: string;
  priority_band: string | null;
  target_date: string | null;
  updated_at: string;
  source: string | null;
  owner_user_id: string | null;
  document: {
    id: string;
    title: string;
    document_type: string;
  } | null;
  module_instance: {
    id: string;
    module_key: string;
    outcome: string | null;
  } | null;
  owner: {
    id: string;
    name: string | null;
  } | null;
  attachment_count: number;
}

interface ModuleActionsProps {
  documentId: string;
  moduleInstanceId: string;
  buttonLabel?: string;
}

const isValidUUID = (id: string | undefined | null): boolean => {
  if (!id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

export default function ModuleActions({ documentId, moduleInstanceId, buttonLabel = 'Add Action' }: ModuleActionsProps) {
  const { user } = useAuth();
  const [actions, setActions] = useState<Action[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [documentStatus, setDocumentStatus] = useState<string>('draft');
  const [documentType, setDocumentType] = useState<string | null>(null);
  const [actionToDelete, setActionToDelete] = useState<string | null>(null);
  const [moduleKey, setModuleKey] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
    autoClose?: boolean;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
    autoClose: false,
  });

  useEffect(() => {
    if (!isValidUUID(documentId)) {
      console.warn('ModuleActions: Invalid documentId provided:', documentId);
      setIsLoading(false);
      return;
    }
    if (!isValidUUID(moduleInstanceId)) {
      console.warn('ModuleActions: Invalid moduleInstanceId provided:', moduleInstanceId);
      setIsLoading(false);
      return;
    }
    fetchActions();
    fetchDocumentStatus();
    fetchModuleKey();
  }, [moduleInstanceId, documentId]);

  const fetchActions = async () => {
    if (!isValidUUID(moduleInstanceId)) {
      console.error('ModuleActions.fetchActions: Invalid moduleInstanceId:', moduleInstanceId);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('actions')
        .select(`
          *,
          document:documents!actions_document_id_fkey(id,title,document_type),
          module_instance:module_instances(id,module_key,outcome),
          owner:user_profiles(id,name)
        `)
        .eq('module_instance_id', moduleInstanceId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const actionIds = (data || []).map((a) => a.id);
      let attachmentCounts: Record<string, number> = {};

      if (actionIds.length > 0) {
        const { data: attachmentData } = await supabase
          .from('attachments')
          .select('action_id')
          .in('action_id', actionIds)
          .not('action_id', 'is', null);

        attachmentData?.forEach((att) => {
          if (att.action_id) {
            attachmentCounts[att.action_id] = (attachmentCounts[att.action_id] || 0) + 1;
          }
        });
      }

      const actionsWithAttachments = (data || []).map((action) => ({
        ...action,
        attachment_count: attachmentCounts[action.id] || 0,
      }));

      setActions(actionsWithAttachments);
    } catch (error) {
      console.error('Error fetching actions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDocumentStatus = async () => {
    if (!isValidUUID(documentId)) {
      console.error('ModuleActions.fetchDocumentStatus: Invalid documentId:', documentId);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('status, document_type')
        .eq('id', documentId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setDocumentStatus(data.status);
        setDocumentType(data.document_type);
      }
    } catch (error) {
      console.error('Error fetching document status:', error);
    }
  };

  const fetchModuleKey = async () => {
    if (!isValidUUID(moduleInstanceId)) {
      console.error('ModuleActions.fetchModuleKey: Invalid moduleInstanceId:', moduleInstanceId);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('module_instances')
        .select('module_key')
        .eq('id', moduleInstanceId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setModuleKey(data.module_key);
      }
    } catch (error) {
      console.error('Error fetching module key:', error);
    }
  };

  const handleDeleteAction = async (actionId: string) => {
    if (documentStatus !== 'draft') {
      setFeedback({
        isOpen: true,
        type: 'warning',
        title: 'Cannot delete action',
        message: 'Actions can only be deleted when the document is in Draft status.',
        autoClose: false,
      });
      return;
    }

    if (!user?.id) {
      setFeedback({
        isOpen: true,
        type: 'error',
        title: 'User not found',
        message: 'Unable to identify user. Please refresh the page and try again.',
        autoClose: false,
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('actions')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', actionId);

      if (error) throw error;

      setActionToDelete(null);
      fetchActions();

      setFeedback({
        isOpen: true,
        type: 'success',
        title: 'Action deleted',
        message: 'The action has been successfully removed.',
        autoClose: true,
      });
    } catch (error) {
      console.error('Error deleting action:', error);
      setFeedback({
        isOpen: true,
        type: 'error',
        title: 'Delete failed',
        message: 'Unable to delete the action. Please try again.',
        autoClose: false,
      });
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
      case 'closed':
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

  const isDeletable = documentStatus === 'draft';
  const hasValidIds = isValidUUID(documentId) && isValidUUID(moduleInstanceId);

  if (!hasValidIds) {
    return (
      <div className="bg-red-50 rounded-lg border border-red-200 p-6 mt-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-red-900 mb-1">Invalid Module Configuration</h3>
            <p className="text-sm text-red-700">
              Cannot load actions: Missing or invalid document ID or module instance ID.
            </p>
            <div className="mt-2 text-xs font-mono text-red-600 space-y-1">
              <div>documentId: {documentId || '(missing)'}</div>
              <div>moduleInstanceId: {moduleInstanceId || '(missing)'}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // RE documents: only RE-9 Recommendations (RE_13_RECOMMENDATIONS) shows actions
  if (documentType === 'RE') {
    if (moduleKey === 'RE_13_RECOMMENDATIONS') {
      // RE-9 Recommendations: show full actions UI
    } else {
      // All other RE modules: no footer at all
      return null;
    }
  }

  // Non-RE documents (FRA, FSD, DSEAR): show actions UI
  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-neutral-900">Actions from this Module</h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white font-medium rounded-lg hover:bg-neutral-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {buttonLabel}
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
            Click "{buttonLabel}" to create a recommended action for this module
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
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-700 uppercase tracking-wider">
                  Actions
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
                  <td
                    className="px-4 py-3 cursor-pointer"
                    onClick={() => setSelectedAction(action)}
                  >
                    <div className="text-sm text-neutral-900 max-w-lg hover:text-neutral-600 transition-colors">
                      {action.recommended_action}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-600">
                    {formatDate(action.target_date)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedAction(action)}
                        className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
                        title="View details"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      {isDeletable && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionToDelete(action.id);
                          }}
                          className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          title="Delete action"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
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

      {selectedAction && (
        <ActionDetailModal
          action={selectedAction}
          onClose={() => setSelectedAction(null)}
          onActionUpdated={() => {
            fetchActions();
          }}
        />
      )}

      {actionToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-neutral-900 mb-3">Delete Action?</h3>
            <p className="text-neutral-700 mb-6">
              This will permanently delete this action and all its attachments. This cannot be undone.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setActionToDelete(null)}
                className="px-4 py-2 text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteAction(actionToDelete)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {!isDeletable && actions.length > 0 && (
        <p className="text-xs text-neutral-500 mt-3 italic">
          Document is issued — actions cannot be deleted. You can close them instead.
        </p>
      )}

      <FeedbackModal
        isOpen={feedback.isOpen}
        onClose={() => setFeedback({ ...feedback, isOpen: false })}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        autoClose={feedback.autoClose}
      />
    </div>
  );
}
