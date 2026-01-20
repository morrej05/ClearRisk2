import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Upload, Image, FileText, Trash2, Edit2, Link2, X, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getModuleName } from '../../lib/modules/moduleCatalog';
import {
  listAttachments,
  uploadEvidenceFile,
  createAttachmentRow,
  deleteAttachment,
  updateAttachmentCaption,
  updateAttachmentLinks,
  getSignedUrl,
  type Attachment,
} from '../../lib/supabase/attachments';

interface Document {
  id: string;
  title: string;
  document_type: string;
}

interface ModuleInstance {
  id: string;
  module_key: string;
}

interface Action {
  id: string;
  recommended_action: string;
  priority_band: string;
}

export default function DocumentEvidence() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [document, setDocument] = useState<Document | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [modules, setModules] = useState<ModuleInstance[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'module' | 'action'>('all');
  const [selectedModuleKey, setSelectedModuleKey] = useState<string>('');
  const [editingAttachment, setEditingAttachment] = useState<Attachment | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [linkingAttachment, setLinkingAttachment] = useState<Attachment | null>(null);
  const [linkModuleId, setLinkModuleId] = useState('');
  const [linkActionId, setLinkActionId] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  useEffect(() => {
    if (id && organisation?.id) {
      fetchDocument();
      fetchAttachments();
      fetchModules();
      fetchActions();
    }
  }, [id, organisation?.id]);

  const fetchDocument = async () => {
    if (!id || !organisation?.id) return;

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, document_type')
        .eq('id', id)
        .eq('organisation_id', organisation.id)
        .single();

      if (error) throw error;
      setDocument(data);
    } catch (error) {
      console.error('Error fetching document:', error);
      alert('Failed to load document.');
      navigate(-1);
    }
  };

  const fetchAttachments = async () => {
    if (!id) return;

    setIsLoading(true);
    try {
      const data = await listAttachments(id);
      setAttachments(data);
    } catch (error) {
      console.error('Error fetching attachments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchModules = async () => {
    if (!id || !organisation?.id) return;

    try {
      const { data, error } = await supabase
        .from('module_instances')
        .select('id, module_key')
        .eq('document_id', id)
        .eq('organisation_id', organisation.id);

      if (error) throw error;
      setModules(data || []);
    } catch (error) {
      console.error('Error fetching modules:', error);
    }
  };

  const fetchActions = async () => {
    if (!id || !organisation?.id) return;

    try {
      const { data, error } = await supabase
        .from('actions')
        .select('id, recommended_action, priority_band')
        .eq('document_id', id)
        .eq('organisation_id', organisation.id)
        .order('priority_band', { ascending: true });

      if (error) throw error;
      setActions(data || []);
    } catch (error) {
      console.error('Error fetching actions:', error);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !id || !organisation?.id) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const uploadResult = await uploadEvidenceFile(file, organisation.id, id);

        await createAttachmentRow({
          organisation_id: organisation.id,
          document_id: id,
          file_path: uploadResult.file_path,
          file_name: uploadResult.file_name,
          file_type: uploadResult.file_type,
          file_size_bytes: uploadResult.file_size_bytes,
        });
      }

      await fetchAttachments();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to upload: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (!confirm(`Delete ${attachment.file_name}?`)) return;

    try {
      await deleteAttachment(attachment.id);
      await fetchAttachments();
    } catch (error) {
      console.error('Error deleting attachment:', error);
      alert('Failed to delete attachment.');
    }
  };

  const handleSaveCaption = async () => {
    if (!editingAttachment) return;

    try {
      await updateAttachmentCaption(editingAttachment.id, editCaption);
      await fetchAttachments();
      setEditingAttachment(null);
      setEditCaption('');
    } catch (error) {
      console.error('Error updating caption:', error);
      alert('Failed to update caption.');
    }
  };

  const handleSaveLinks = async () => {
    if (!linkingAttachment) return;

    try {
      await updateAttachmentLinks(
        linkingAttachment.id,
        linkModuleId || null,
        linkActionId || null
      );
      await fetchAttachments();
      setLinkingAttachment(null);
      setLinkModuleId('');
      setLinkActionId('');
    } catch (error) {
      console.error('Error updating links:', error);
      alert('Failed to update links.');
    }
  };

  const handlePreview = async (attachment: Attachment) => {
    try {
      const url = await getSignedUrl(attachment.file_path, 3600);
      setPreviewUrl(url);
      setPreviewAttachment(attachment);
    } catch (error) {
      console.error('Error generating preview URL:', error);
      alert('Failed to load preview.');
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      const url = await getSignedUrl(attachment.file_path, 300);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      a.click();
    } catch (error) {
      console.error('Error downloading attachment:', error);
      alert('Failed to download file.');
    }
  };

  const filteredAttachments = attachments.filter((att) => {
    if (filter === 'module') {
      if (!selectedModuleKey) return att.module_instance_id !== null;
      const module = modules.find((m) => m.id === att.module_instance_id);
      return module?.module_key === selectedModuleKey;
    }
    if (filter === 'action') {
      return att.action_id !== null;
    }
    return true;
  });

  const getModuleNameForAttachment = (attachment: Attachment): string => {
    if (!attachment.module_instance_id) return '';
    const module = modules.find((m) => m.id === attachment.module_instance_id);
    return module ? getModuleName(module.module_key) : '';
  };

  const getActionSummaryForAttachment = (attachment: Attachment): string => {
    if (!attachment.action_id) return '';
    const action = actions.find((a) => a.id === attachment.action_id);
    return action ? `[${action.priority_band}] ${action.recommended_action.substring(0, 50)}...` : '';
  };

  if (!document) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-neutral-300 border-t-neutral-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button
            onClick={() => navigate(`/documents/${id}`)}
            className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 font-medium transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Document
          </button>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm">
          <div className="px-6 py-4 border-b border-neutral-200">
            <h1 className="text-2xl font-bold text-neutral-900">Evidence & Attachments</h1>
            <p className="text-sm text-neutral-600 mt-1">{document.title}</p>
          </div>

          <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50">
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-700 transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {isUploading ? 'Uploading...' : 'Upload Files'}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-neutral-700">Filter:</label>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as 'all' | 'module' | 'action')}
                  className="px-3 py-1.5 border border-neutral-300 rounded-lg text-sm"
                >
                  <option value="all">All Attachments</option>
                  <option value="module">Linked to Module</option>
                  <option value="action">Linked to Action</option>
                </select>

                {filter === 'module' && (
                  <select
                    value={selectedModuleKey}
                    onChange={(e) => setSelectedModuleKey(e.target.value)}
                    className="px-3 py-1.5 border border-neutral-300 rounded-lg text-sm"
                  >
                    <option value="">All Modules</option>
                    {[...new Set(modules.map((m) => m.module_key))].map((key) => (
                      <option key={key} value={key}>
                        {getModuleName(key)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="ml-auto text-sm text-neutral-600">
                {filteredAttachments.length} {filteredAttachments.length === 1 ? 'file' : 'files'}
              </div>
            </div>
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-neutral-300 border-t-neutral-900"></div>
              </div>
            ) : filteredAttachments.length === 0 ? (
              <div className="text-center py-12">
                <Image className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
                <p className="text-neutral-600 mb-2">No attachments found</p>
                <p className="text-sm text-neutral-500">Upload photos, images, or PDFs to document evidence</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAttachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="border border-neutral-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        {attachment.file_type.startsWith('image/') ? (
                          <Image className="w-8 h-8 text-neutral-500" />
                        ) : (
                          <FileText className="w-8 h-8 text-neutral-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingAttachment(attachment);
                            setEditCaption(attachment.caption || '');
                          }}
                          className="p-1 text-neutral-500 hover:text-neutral-900 transition-colors"
                          title="Edit caption"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setLinkingAttachment(attachment);
                            setLinkModuleId(attachment.module_instance_id || '');
                            setLinkActionId(attachment.action_id || '');
                          }}
                          className="p-1 text-neutral-500 hover:text-neutral-900 transition-colors"
                          title="Link to module/action"
                        >
                          <Link2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownload(attachment)}
                          className="p-1 text-neutral-500 hover:text-neutral-900 transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(attachment)}
                          className="p-1 text-red-500 hover:text-red-700 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {attachment.file_type.startsWith('image/') && (
                      <button
                        onClick={() => handlePreview(attachment)}
                        className="w-full mb-3 bg-neutral-100 rounded-lg aspect-video flex items-center justify-center text-neutral-500 hover:bg-neutral-200 transition-colors"
                      >
                        Click to preview
                      </button>
                    )}

                    <h3 className="font-medium text-sm text-neutral-900 mb-1 truncate" title={attachment.file_name}>
                      {attachment.file_name}
                    </h3>

                    {attachment.caption && (
                      <p className="text-xs text-neutral-600 mb-2 line-clamp-2">{attachment.caption}</p>
                    )}

                    <div className="space-y-1 text-xs text-neutral-500">
                      {getModuleNameForAttachment(attachment) && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Module:</span>
                          <span className="truncate">{getModuleNameForAttachment(attachment)}</span>
                        </div>
                      )}
                      {getActionSummaryForAttachment(attachment) && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Action:</span>
                          <span className="truncate">{getActionSummaryForAttachment(attachment)}</span>
                        </div>
                      )}
                      <div>
                        {new Date(attachment.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {editingAttachment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Edit Caption</h2>
              <button
                onClick={() => setEditingAttachment(null)}
                className="text-neutral-500 hover:text-neutral-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <textarea
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              placeholder="Add a description or caption..."
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg resize-none"
              rows={4}
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setEditingAttachment(null)}
                className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCaption}
                className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {linkingAttachment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Link Attachment</h2>
              <button
                onClick={() => setLinkingAttachment(null)}
                className="text-neutral-500 hover:text-neutral-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Link to Module</label>
                <select
                  value={linkModuleId}
                  onChange={(e) => setLinkModuleId(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                >
                  <option value="">None</option>
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {getModuleName(module.module_key)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Link to Action</label>
                <select
                  value={linkActionId}
                  onChange={(e) => setLinkActionId(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                >
                  <option value="">None</option>
                  {actions.map((action) => (
                    <option key={action.id} value={action.id}>
                      [{action.priority_band}] {action.recommended_action.substring(0, 60)}
                      {action.recommended_action.length > 60 ? '...' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setLinkingAttachment(null)}
                className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLinks}
                className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-700 transition-colors"
              >
                Save Links
              </button>
            </div>
          </div>
        </div>
      )}

      {previewUrl && previewAttachment && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setPreviewUrl(null);
            setPreviewAttachment(null);
          }}
        >
          <div className="relative max-w-5xl w-full">
            <button
              onClick={() => {
                setPreviewUrl(null);
                setPreviewAttachment(null);
              }}
              className="absolute top-4 right-4 p-2 bg-white rounded-full text-neutral-900 hover:bg-neutral-200 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewUrl}
              alt={previewAttachment.file_name}
              className="max-w-full max-h-[90vh] mx-auto rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="mt-4 text-center text-white">
              <p className="font-medium">{previewAttachment.file_name}</p>
              {previewAttachment.caption && (
                <p className="text-sm text-neutral-300 mt-1">{previewAttachment.caption}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
