import { useState, useEffect } from 'react';
import { X, Paperclip, Download, Trash2, Image as ImageIcon, Eye, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getSignedUrl, isValidAttachment } from '../../lib/supabase/attachments';

interface EvidencePanelProps {
  actionId: string;
  onClose: () => void;
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
  uploaded_by: string | null;
}

export default function EvidencePanel({ actionId, onClose }: EvidencePanelProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  useEffect(() => {
    fetchAttachments();
  }, [actionId]);

  const fetchAttachments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('action_id', actionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAttachments(data || []);

      const imageAttachments = (data || []).filter(att => att.file_type.startsWith('image/')).slice(0, 10);
      const urlPromises = imageAttachments.map(async (att) => {
        try {
          const url = await getSignedUrl(att.file_path, 3600);
          return { id: att.id, url };
        } catch (error) {
          console.error('Error generating thumbnail URL:', error);
          return null;
        }
      });

      const results = await Promise.all(urlPromises);
      const urlMap: Record<string, string> = {};
      results.forEach(result => {
        if (result) {
          urlMap[result.id] = result.url;
        }
      });
      setThumbnailUrls(urlMap);
    } catch (error) {
      console.error('Error fetching attachments:', error);
    } finally {
      setIsLoading(false);
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

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isImage = (fileType: string) => {
    return fileType.startsWith('image/');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Action Evidence</h2>
            <p className="text-sm text-neutral-600 mt-1">
              {attachments.length} {attachments.length === 1 ? 'attachment' : 'attachments'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-neutral-300 border-t-neutral-900"></div>
            </div>
          ) : attachments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
                <Paperclip className="w-8 h-8 text-neutral-400" />
              </div>
              <p className="text-neutral-500 text-lg mb-2">No evidence found</p>
              <p className="text-neutral-400 text-sm">
                Evidence added to this action will appear here
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="border border-neutral-200 rounded-lg p-4 hover:border-neutral-300 transition-colors"
                >
                  {isImage(attachment.file_type) && thumbnailUrls[attachment.id] && (
                    <div className="mb-3">
                      <button
                        onClick={() => handlePreview(attachment)}
                        disabled={!isValidAttachment(attachment)}
                        className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <img
                          src={thumbnailUrls[attachment.id]}
                          alt={attachment.file_name}
                          className="w-full max-h-32 object-cover rounded-lg border border-neutral-200 hover:border-neutral-400 transition-colors"
                        />
                      </button>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      {isImage(attachment.file_type) ? (
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-blue-600" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-neutral-100 rounded-lg flex items-center justify-center">
                          <Paperclip className="w-6 h-6 text-neutral-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm text-neutral-900 truncate">
                        {attachment.file_name}
                      </h3>
                      <p className="text-xs text-neutral-500 mt-1">
                        {formatFileSize(attachment.file_size_bytes)} • {formatDate(attachment.created_at)}
                      </p>
                      {!isValidAttachment(attachment) && (
                        <div className="flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          <span className="text-xs text-amber-600 font-medium">Bad file reference</span>
                        </div>
                      )}
                      {attachment.caption && (
                        <p className="text-sm text-neutral-700 mt-2 line-clamp-2">
                          {attachment.caption}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => handlePreview(attachment)}
                          disabled={!isValidAttachment(attachment)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 rounded-md hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownload(attachment)}
                          disabled={!isValidAttachment(attachment)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-neutral-200 p-4 bg-neutral-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {previewUrl && previewAttachment && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-[60] flex items-center justify-center p-4"
          onClick={() => {
            setPreviewUrl(null);
            setPreviewAttachment(null);
          }}
        >
          <div className="relative max-w-6xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="text-white">
                <p className="font-medium">{previewAttachment.file_name}</p>
                <p className="text-sm text-neutral-300">
                  {formatFileSize(previewAttachment.file_size_bytes)}
                </p>
              </div>
              <button
                onClick={() => {
                  setPreviewUrl(null);
                  setPreviewAttachment(null);
                }}
                className="text-white hover:text-neutral-300 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div
              className="flex-1 flex items-center justify-center overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {previewAttachment.file_type.startsWith('image/') ? (
                <img
                  src={previewUrl}
                  alt={previewAttachment.file_name}
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              ) : previewAttachment.file_type === 'application/pdf' ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-[80vh] bg-white rounded-lg"
                  title={previewAttachment.file_name}
                />
              ) : (
                <div className="text-center text-white">
                  <Paperclip className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg mb-2">Preview not available for this file type</p>
                  <button
                    onClick={() => handleDownload(previewAttachment)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Download to view
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
