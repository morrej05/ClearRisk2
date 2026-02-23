import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  ArrowLeft,
  Upload,
  Image as ImageIcon,
  FileText,
  Trash2,
  Edit2,
  Download,
  AlertCircle,
  Lock,
  X,
  Save,
  Unlink,
  Filter,
  Link as LinkIcon,
  Info,
} from 'lucide-react';
import {
  getDocumentStatus,
  getDocumentAttachments,
  uploadAttachment,
  deleteAttachment as deleteAttachmentUtil,
  updateAttachmentCaption,
  downloadAttachment,
  formatFileSize,
  getFileIcon,
  isDocumentLocked,
  type Attachment,
  type DocumentStatus,
} from '../../utils/evidenceManagement';
import { unlinkAttachmentFromAction, unlinkAttachmentFromModule } from '../../lib/supabase/attachments';
import { supabase } from '../../lib/supabase';

type FilterType = 'all' | 'unlinked' | 'section' | 'action';

interface ModuleInstance {
  id: string;
  module_key: string;
}

interface Action {
  id: string;
  reference_number: string | null;
  recommended_action: string;
}

export default function DocumentEvidenceV2() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { organisation, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documentStatus, setDocumentStatus] = useState<DocumentStatus | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [modules, setModules] = useState<ModuleInstance[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [editingAttachment, setEditingAttachment] = useState<Attachment | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [linkingAttachment, setLinkingAttachment] = useState<string | null>(null);

  const isLocked = documentStatus ? isDocumentLocked(documentStatus.issue_status) : false;

  useEffect(() => {
    if (id && organisation?.id) {
      loadData();
    }
  }, [id, organisation?.id]);

  const loadData = async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const [status, attachs, modulesData, actionsData] = await Promise.all([
        getDocumentStatus(id),
        getDocumentAttachments(id),
        loadModules(),
        loadActions(),
      ]);

      setDocumentStatus(status);
      setAttachments(attachs);
      setModules(modulesData);
      setActions(actionsData);

      loadThumbnails(attachs);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load evidence data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadModules = async (): Promise<ModuleInstance[]> => {
    if (!id || !organisation?.id) return [];

    try {
      const { data, error } = await supabase
        .from('module_instances')
        .select('id, module_key')
        .eq('document_id', id)
        .eq('organisation_id', organisation.id)
        .order('module_key', { ascending: true });

      if (error) {
        console.error('Error loading modules:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Error loading modules:', err);
      return [];
    }
  };

  const loadActions = async (): Promise<Action[]> => {
    if (!id || !organisation?.id) return [];

    try {
      const { data, error } = await supabase
        .from('actions')
        .select('id, reference_number, recommended_action')
        .eq('document_id', id)
        .eq('organisation_id', organisation.id)
        .order('reference_number', { ascending: true });

      if (error) {
        console.error('Error loading actions:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Error loading actions:', err);
      return [];
    }
  };

  const loadThumbnails = async (attachs: Attachment[]) => {
    const imageAttachments = attachs.filter(att => att.file_type.startsWith('image/'));
    const thumbs: Record<string, string> = {};

    for (const att of imageAttachments) {
      try {
        const { data, error } = await supabase.storage
          .from('evidence')
          .createSignedUrl(att.file_path, 3600);

        if (error) {
          console.warn(`Failed to load thumbnail for ${att.file_name}:`, error);
          continue;
        }

        if (data?.signedUrl) {
          thumbs[att.id] = data.signedUrl;
        }
      } catch (err) {
        console.warn(`Exception loading thumbnail for ${att.file_name}:`, err);
      }
    }

    setThumbnails(thumbs);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !id || !organisation?.id || !documentStatus) return;

    if (isLocked) {
      alert('Cannot add evidence to an issued or superseded document. Create a new version to add evidence.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        const result = await uploadAttachment(
          organisation.id,
          id,
          documentStatus.base_document_id,
          file,
          uploadCaption || undefined
        );

        if (!result.success) {
          throw new Error(result.error || 'Upload failed');
        }
      }

      setUploadCaption('');
      await loadData();

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload evidence');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!id) return;

    if (isLocked) {
      alert('Cannot delete evidence from an issued or superseded document.');
      return;
    }

    if (!confirm('Are you sure you want to delete this evidence? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await deleteAttachmentUtil(attachmentId, id);

      if (!result.success) {
        throw new Error(result.error || 'Delete failed');
      }

      await loadData();
    } catch (err: any) {
      console.error('Delete error:', err);
      alert(err.message || 'Failed to delete evidence');
    }
  };

  const handleStartEditCaption = (attachment: Attachment) => {
    if (isLocked) {
      alert('Cannot edit evidence on an issued or superseded document.');
      return;
    }

    setEditingAttachment(attachment);
    setEditCaption(attachment.caption || '');
  };

  const handleSaveCaption = async () => {
    if (!editingAttachment || !id) return;

    try {
      const result = await updateAttachmentCaption(editingAttachment.id, id, editCaption);

      if (!result.success) {
        throw new Error(result.error || 'Update failed');
      }

      setEditingAttachment(null);
      setEditCaption('');
      await loadData();
    } catch (err: any) {
      console.error('Update error:', err);
      alert(err.message || 'Failed to update caption');
    }
  };

  const handleCancelEdit = () => {
    setEditingAttachment(null);
    setEditCaption('');
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      await downloadAttachment(attachment.file_path, attachment.file_name);
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download file');
    }
  };

  const handleUnlinkFromAction = async (attachmentId: string) => {
    if (isLocked) {
      alert('Cannot modify evidence on an issued or superseded document.');
      return;
    }

    if (!confirm('Unlink this evidence from its action? The file will remain available and linked to its section.')) {
      return;
    }

    try {
      await unlinkAttachmentFromAction(attachmentId);
      await loadData();
    } catch (err: any) {
      console.error('Unlink error:', err);
      alert(err.message || 'Failed to unlink evidence from action');
    }
  };

  const handleUnlinkFromModule = async (attachmentId: string) => {
    if (isLocked) {
      alert('Cannot modify evidence on an issued or superseded document.');
      return;
    }

    if (!confirm('Unlink this evidence from its section/module? The file will remain available but unlinked.')) {
      return;
    }

    try {
      await unlinkAttachmentFromModule(attachmentId);
      await loadData();
    } catch (err: any) {
      console.error('Unlink error:', err);
      alert(err.message || 'Failed to unlink evidence from module');
    }
  };

  const handleLinkToModule = async (attachmentId: string, moduleInstanceId: string) => {
    if (isLocked) {
      alert('Cannot modify evidence on an issued or superseded document.');
      return;
    }

    try {
      const { error } = await supabase
        .from('attachments')
        .update({ module_instance_id: moduleInstanceId })
        .eq('id', attachmentId);

      if (error) throw error;

      setLinkingAttachment(null);
      await loadData();
    } catch (err: any) {
      console.error('Link error:', err);
      alert(err.message || 'Failed to link evidence to module');
    }
  };

  const handleLinkToAction = async (attachmentId: string, actionId: string) => {
    if (isLocked) {
      alert('Cannot modify evidence on an issued or superseded document.');
      return;
    }

    try {
      const { error } = await supabase
        .from('attachments')
        .update({ action_id: actionId })
        .eq('id', attachmentId);

      if (error) throw error;

      setLinkingAttachment(null);
      await loadData();
    } catch (err: any) {
      console.error('Link error:', err);
      alert(err.message || 'Failed to link evidence to action');
    }
  };

  const filteredAttachments = attachments.filter((att) => {
    switch (filterType) {
      case 'unlinked':
        return !att.module_instance_id && !att.action_id;
      case 'section':
        return att.module_instance_id && !att.action_id;
      case 'action':
        return att.action_id;
      default:
        return true;
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-neutral-300 border-t-neutral-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => navigate(`/documents/${id}`)}
            className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Overview
          </button>

          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-6 h-6 text-neutral-700" />
                <h1 className="text-2xl font-bold text-neutral-900">
                  Evidence & Attachments ({attachments.length})
                  {documentStatus && (
                    <span className="text-lg font-normal text-neutral-600 ml-2">
                      — v{documentStatus.version_number}
                    </span>
                  )}
                </h1>
              </div>
              {documentStatus && (
                <span
                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    documentStatus.issue_status === 'issued'
                      ? 'bg-green-100 text-green-700'
                      : documentStatus.issue_status === 'draft'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  {documentStatus.issue_status}
                </span>
              )}
            </div>

            {!isLocked && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {isUploading ? 'Uploading...' : 'Upload Evidence'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-blue-900 mb-1">DocumentEvidenceV2 Debug Info</p>
              <div className="text-sm text-blue-800 space-y-1">
                <p>Total attachments loaded: {attachments.length}</p>
                <p>Modules loaded: {modules.length}</p>
                <p>Actions loaded: {actions.length}</p>
                <p>Thumbnails loaded: {Object.keys(thumbnails).length}</p>
              </div>
            </div>
          </div>
        </div>

        {isLocked && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-900 mb-1">Evidence Locked</p>
                <p className="text-sm text-amber-800">
                  This document is {documentStatus?.issue_status} and evidence is locked. Evidence cannot be added, edited, or deleted. To add new evidence, create a new version of this document.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-900">Error</p>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!isLocked && (
          <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-6">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Upload Caption (optional)
            </label>
            <input
              type="text"
              value={uploadCaption}
              onChange={(e) => setUploadCaption(e.target.value)}
              placeholder="Add a description for your evidence..."
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          onChange={handleFileSelect}
          className="hidden"
        />

        {attachments.length > 0 && (
          <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-neutral-600" />
              <span className="text-sm font-medium text-neutral-700">Filter:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    filterType === 'all'
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  All ({attachments.length})
                </button>
                <button
                  onClick={() => setFilterType('unlinked')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    filterType === 'unlinked'
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  Unlinked ({attachments.filter(a => !a.module_instance_id && !a.action_id).length})
                </button>
                <button
                  onClick={() => setFilterType('section')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    filterType === 'section'
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  By Section ({attachments.filter(a => a.module_instance_id && !a.action_id).length})
                </button>
                <button
                  onClick={() => setFilterType('action')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    filterType === 'action'
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  By Action ({attachments.filter(a => a.action_id).length})
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
          {filteredAttachments.length === 0 && attachments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-600 font-medium">No evidence uploaded</p>
              <p className="text-sm text-neutral-500 mt-1">
                {isLocked
                  ? 'This document has no evidence attached'
                  : 'Upload photos, PDFs, or other evidence files to support this document'}
              </p>
            </div>
          ) : filteredAttachments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-600 font-medium">No evidence matches this filter</p>
              <p className="text-sm text-neutral-500 mt-1">
                Try selecting a different filter to see other attachments
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-200">
              {filteredAttachments.map((attachment) => (
                <div key={attachment.id} className="p-4 hover:bg-neutral-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      {attachment.file_type.startsWith('image/') && thumbnails[attachment.id] ? (
                        <img
                          src={thumbnails[attachment.id]}
                          alt={attachment.file_name}
                          className="w-14 h-14 object-cover rounded border border-neutral-200"
                          style={{ width: '56px', height: '56px' }}
                        />
                      ) : attachment.file_type.startsWith('image/') ? (
                        <div className="w-14 h-14 bg-neutral-100 rounded border border-neutral-200 flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-neutral-400" />
                        </div>
                      ) : (
                        <FileText className="w-10 h-10 text-neutral-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-neutral-900 truncate">
                            {attachment.file_name}
                          </p>
                          <p className="text-sm text-neutral-600 mt-1">
                            {formatFileSize(attachment.file_size_bytes)} •{' '}
                            {new Date(attachment.created_at).toLocaleDateString()}
                          </p>

                          {editingAttachment?.id === attachment.id ? (
                            <div className="mt-2 flex items-center gap-2">
                              <input
                                type="text"
                                value={editCaption}
                                onChange={(e) => setEditCaption(e.target.value)}
                                placeholder="Add caption..."
                                className="flex-1 px-3 py-1.5 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                autoFocus
                              />
                              <button
                                onClick={handleSaveCaption}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Save"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="p-1.5 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            attachment.caption && (
                              <p className="text-sm text-neutral-700 mt-2 italic">
                                {attachment.caption}
                              </p>
                            )
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDownload(attachment)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {!isLocked && (
                            <>
                              <button
                                onClick={() => handleStartEditCaption(attachment)}
                                className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
                                title="Edit caption"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              {attachment.action_id && (
                                <button
                                  onClick={() => handleUnlinkFromAction(attachment.id)}
                                  className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                  title="Unlink from action"
                                >
                                  <Unlink className="w-4 h-4" />
                                </button>
                              )}

                              {attachment.module_instance_id && (
                                <button
                                  onClick={() => handleUnlinkFromModule(attachment.id)}
                                  className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                  title="Unlink from section/module"
                                >
                                  <Unlink className="w-4 h-4" />
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteAttachment(attachment.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete permanently"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => setLinkingAttachment(linkingAttachment === attachment.id ? null : attachment.id)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Link to section/action"
                              >
                                <LinkIcon className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {!isLocked && linkingAttachment === attachment.id && (
                        <div className="mt-3 pt-3 border-t border-neutral-200">
                          <p className="text-xs font-medium text-neutral-700 mb-2">LINKING</p>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-neutral-700 mb-1">
                                Link to Module/Section
                              </label>
                              {modules.length === 0 ? (
                                <p className="text-xs text-neutral-500 italic">No modules/sections found</p>
                              ) : (
                                <select
                                  value={attachment.module_instance_id || ''}
                                  onChange={(e) => e.target.value && handleLinkToModule(attachment.id, e.target.value)}
                                  className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                  <option value="">Select module...</option>
                                  {modules.map(mod => (
                                    <option key={mod.id} value={mod.id}>
                                      {mod.module_key}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-neutral-700 mb-1">
                                Link to Action
                              </label>
                              {actions.length === 0 ? (
                                <p className="text-xs text-neutral-500 italic">No actions found</p>
                              ) : (
                                <select
                                  value={attachment.action_id || ''}
                                  onChange={(e) => e.target.value && handleLinkToAction(attachment.id, e.target.value)}
                                  className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                  <option value="">Select action...</option>
                                  {actions.map(action => {
                                    const truncatedAction = action.recommended_action?.substring(0, 60) || 'Untitled';
                                    const label = action.reference_number
                                      ? `${action.reference_number} — ${truncatedAction}`
                                      : truncatedAction;
                                    return (
                                      <option key={action.id} value={action.id}>
                                        {label}
                                      </option>
                                    );
                                  })}
                                </select>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
