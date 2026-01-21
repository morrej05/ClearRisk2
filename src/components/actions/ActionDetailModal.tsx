import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ExternalLink, FileText, Layers, Paperclip, Camera, Upload, AlertCircle, CheckCircle, Clock, XCircle, ArrowLeft, Download, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { uploadEvidenceFile, createAttachmentRow } from '../../lib/supabase/attachments';

interface ActionDetailModalProps {
  action: {
    id: string;
    recommended_action: string;
    status: string;
    priority_band: string | null;
    target_date: string | null;
    owner_user_id: string | null;
    updated_at: string;
    source: string | null;
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
  };
  onClose: () => void;
  onActionUpdated: () => void;
  returnTo?: string;
}

interface Attachment {
  id: string;
  file_name: string;
  file_type: string;
  file_path: string;
  file_size_bytes: number | null;
  caption: string | null;
  taken_at: string | null;
  created_at: string;
}

export default function ActionDetailModal({
  action,
  onClose,
  onActionUpdated,
  returnTo,
}: ActionDetailModalProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { organisation, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const returnToPath = returnTo || (location.state as any)?.returnTo || null;

  const [status, setStatus] = useState(action.status);
  const [isUpdating, setIsUpdating] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(true);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [documentStatus, setDocumentStatus] = useState<string>('draft');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetchAttachments();
    fetchDocumentStatus();
  }, [action.id]);

  const fetchAttachments = async () => {
    setIsLoadingAttachments(true);
    try {
      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('action_id', action.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error('Error fetching attachments:', error);
    } finally {
      setIsLoadingAttachments(false);
    }
  };

  const fetchDocumentStatus = async () => {
    if (!action.document?.id) return;

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('status')
        .eq('id', action.document.id)
        .single();

      if (error) throw error;
      if (data) setDocumentStatus(data.status);
    } catch (error) {
      console.error('Error fetching document status:', error);
    }
  };

  const handleDeleteAction = async () => {
    try {
      await supabase.from('attachments').delete().eq('action_id', action.id);

      const { error: actionError } = await supabase
        .from('actions')
        .delete()
        .eq('id', action.id);

      if (actionError) throw actionError;

      onActionUpdated();
      onClose();
    } catch (error) {
      console.error('Error deleting action:', error);
      alert('Failed to delete action. Please try again.');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!organisation?.id) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('actions')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', action.id);

      if (error) throw error;

      setStatus(newStatus);
      onActionUpdated();
    } catch (error) {
      console.error('Error updating action status:', error);
      alert('Failed to update action status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleGoToDocument = () => {
    if (!action.document?.id) return;
    const documentType = action.document.document_type;
    let from = '/common-dashboard';

    if (documentType === 'DSEAR') {
      from = '/dashboard/explosion';
    } else if (documentType === 'FRA' || documentType === 'FSD') {
      from = '/dashboard/fire';
    }

    navigate(`/documents/${action.document.id}?from=${from}`, {
      state: { returnTo: returnToPath || '/dashboard/actions' }
    });
  };

  const handleGoToModule = () => {
    if (!action.document?.id || !action.module_instance?.id) return;
    navigate(`/documents/${action.document.id}/workspace?m=${action.module_instance.id}`, {
      state: { returnTo: returnToPath || '/dashboard/actions' }
    });
  };

  const handleBackToActions = () => {
    onClose();
    setTimeout(() => {
      if (returnToPath) {
        navigate(returnToPath);
      } else {
        navigate('/dashboard/actions');
      }
    }, 0);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!organisation?.id || !action.document?.id) {
      alert('Organisation or document not found');
      return;
    }

    setIsUploadingFiles(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        const filePath = await uploadEvidenceFile(
          file,
          organisation.id,
          action.document.id
        );

        await createAttachmentRow({
          organisation_id: organisation.id,
          document_id: action.document.id,
          module_instance_id: action.module_instance?.id || null,
          action_id: action.id,
          file_path: filePath,
          file_name: file.name,
          file_type: file.type,
          file_size_bytes: file.size,
          uploaded_by: user?.id || null,
        });
      }

      fetchAttachments();
      onActionUpdated();
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Failed to upload files');
    } finally {
      setIsUploadingFiles(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getStatusIcon = (statusValue: string) => {
    switch (statusValue) {
      case 'open':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'deferred':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'not_applicable':
        return <XCircle className="w-4 h-4 text-neutral-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-neutral-600" />;
    }
  };

  const getStatusColor = (statusValue: string) => {
    switch (statusValue) {
      case 'open':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'complete':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'deferred':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'not_applicable':
        return 'bg-neutral-100 text-neutral-600 border-neutral-300';
      default:
        return 'bg-neutral-100 text-neutral-600 border-neutral-300';
    }
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'P1':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'P2':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'P3':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'P4':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      default:
        return 'bg-neutral-100 text-neutral-600 border-neutral-300';
    }
  };

  const formatStatus = (statusValue: string) => {
    return statusValue.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('evidence')
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file');
    }
  };

  const isOverdue =
    action.target_date &&
    action.status !== 'complete' &&
    action.target_date < new Date().toISOString().split('T')[0];

  const isInfoGap = action.source === 'info_gap' || action.module_instance?.outcome === 'info_gap';
  const isDeletable = documentStatus === 'draft';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center">
              <FileText className="w-5 h-5 text-neutral-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900">Action Details</h2>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-bold rounded border ${getPriorityColor(
                    action.priority_band
                  )}`}
                >
                  {action.priority_band || 'No Priority'}
                </span>
                {isInfoGap && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded border border-amber-300">
                    <AlertCircle className="w-3 h-3" />
                    <span className="text-xs font-medium">⚠ Info gap</span>
                  </div>
                )}
                {isOverdue && (
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded">
                    OVERDUE
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDeletable && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                title="Delete action"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-neutral-700 mb-2">Recommended Action</h3>
            <p className="text-neutral-900 text-base">{action.recommended_action}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-neutral-700 mb-2">Status</h3>
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={isUpdating}
                className={`w-full px-3 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${getStatusColor(
                  status
                )} focus:outline-none focus:ring-2 focus:ring-neutral-500 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="complete">Complete</option>
                <option value="deferred">Deferred</option>
                <option value="not_applicable">Not Applicable</option>
              </select>
            </div>

            <div>
              <h3 className="text-sm font-medium text-neutral-700 mb-2">Due Date</h3>
              <div className="flex items-center gap-2 h-full">
                {getStatusIcon(status)}
                <span className="text-neutral-900 font-medium">
                  {formatDate(action.target_date)}
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-neutral-700 mb-2">Owner</h3>
              <p className="text-neutral-900">{action.owner?.name || 'Unassigned'}</p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-neutral-700 mb-2">Last Updated</h3>
              <p className="text-neutral-900">{formatDate(action.updated_at)}</p>
            </div>
          </div>

          <div className="border-t border-neutral-200 pt-4">
            <h3 className="text-sm font-medium text-neutral-700 mb-3">Navigation</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleBackToActions}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Actions Register
              </button>
              <button
                type="button"
                onClick={handleGoToDocument}
                disabled={!action.document}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-neutral-900 text-white rounded-md hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <FileText className="w-3.5 h-3.5" />
                Go to Document
              </button>
              <button
                type="button"
                onClick={handleGoToModule}
                disabled={!action.module_instance}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white text-neutral-700 border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <Layers className="w-3.5 h-3.5" />
                Go to Module
              </button>
              {action.document && (
                <button
                  type="button"
                  onClick={() => navigate(`/documents/${action.document!.id}/evidence`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white text-neutral-700 border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors font-medium"
                >
                  <Camera className="w-3.5 h-3.5" />
                  View All Evidence
                </button>
              )}
            </div>

            {action.document && (
              <div className="mt-3 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                <div className="text-sm font-medium text-neutral-700">
                  {action.document.title}
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  {action.document.document_type}
                  {action.module_instance?.module_key &&
                    ` • ${action.module_instance.module_key}`}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-neutral-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-neutral-700">
                Evidence ({attachments.length})
              </h3>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingFiles}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-4 h-4" />
                  {isUploadingFiles ? 'Uploading...' : 'Add Evidence'}
                </button>
              </div>
            </div>

            {isLoadingAttachments ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-neutral-300 border-t-neutral-900"></div>
              </div>
            ) : attachments.length === 0 ? (
              <div className="text-center py-8 bg-neutral-50 rounded-lg border border-neutral-200">
                <Camera className="w-12 h-12 text-neutral-400 mx-auto mb-2" />
                <p className="text-neutral-500 text-sm">No evidence attached yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-start gap-3 p-3 bg-neutral-50 rounded-lg border border-neutral-200 hover:border-neutral-300 transition-colors"
                  >
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded flex items-center justify-center">
                      {attachment.file_type.startsWith('image/') ? (
                        <Camera className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Paperclip className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">
                        {attachment.file_name}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {formatFileSize(attachment.file_size_bytes)} •{' '}
                        {formatDate(attachment.created_at)}
                      </p>
                      {attachment.caption && (
                        <p className="text-xs text-neutral-600 mt-1 line-clamp-2">
                          {attachment.caption}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDownload(attachment)}
                        className="inline-flex items-center gap-1 mt-2 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 bg-neutral-50">
          {!isDeletable && (
            <p className="text-xs text-neutral-500 italic mr-auto">
              Document is issued — this action cannot be deleted. You can close it instead.
            </p>
          )}
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-neutral-900 mb-3">Delete Action?</h3>
            <p className="text-neutral-700 mb-6">
              This will permanently delete this action and all its attachments. This cannot be undone.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAction}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
