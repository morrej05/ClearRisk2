import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Plus, Eye, Trash2, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { canAccessExplosionSafety } from '../../utils/entitlements';
import CreateDocumentModal from '../../components/documents/CreateDocumentModal';

interface Document {
  id: string;
  document_type: string;
  title: string;
  status: string;
  version: number;
  assessment_date: string;
  updated_at: string;
  assessor_name: string | null;
}

export default function ExplosionDashboard() {
  const navigate = useNavigate();
  const { organisation, user, userRole, isPlatformAdmin } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const userObj = user && organisation ? {
    id: user.id,
    role: userRole,
    is_platform_admin: isPlatformAdmin,
    can_edit: true
  } : null;

  const hasExplosionAccess = userObj && organisation ? canAccessExplosionSafety(userObj, organisation) : false;

  useEffect(() => {
    if (organisation?.id && hasExplosionAccess) {
      fetchDocuments();
    } else {
      setIsLoading(false);
    }
  }, [organisation?.id, hasExplosionAccess]);

  const fetchDocuments = async () => {
    if (!organisation?.id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('organisation_id', organisation.id)
        .eq('document_type', 'DSEAR')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDocumentCreated = () => {
    setShowCreateModal(false);
    fetchDocuments();
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;

      setDeleteConfirmId(null);
      fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document. It may be issued or have associated data.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-neutral-100 text-neutral-700';
      case 'issued':
        return 'bg-green-100 text-green-700';
      case 'superseded':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-neutral-100 text-neutral-600';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (!hasExplosionAccess) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <button
              onClick={() => navigate('/common-dashboard')}
              className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 font-medium transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>

            <h1 className="text-3xl font-bold text-neutral-900">Explosion Safety</h1>
            <p className="text-neutral-600 mt-1">DSEAR & ATEX Assessments</p>
          </div>

          <div className="bg-white rounded-lg border-2 border-amber-200 p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-neutral-900 mb-2">Pro Feature</h2>
            <p className="text-neutral-600 mb-6 max-w-md mx-auto">
              Explosion Safety assessments (DSEAR & ATEX) are available on Pro and Enterprise plans.
              Upgrade to unlock this feature.
            </p>
            <button
              onClick={() => navigate('/upgrade')}
              className="px-6 py-3 bg-neutral-900 text-white font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
            >
              Upgrade to Pro
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button
            onClick={() => navigate('/common-dashboard')}
            className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 font-medium transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">Explosion Safety</h1>
              <p className="text-neutral-600 mt-1">Manage DSEAR and ATEX assessments</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white font-medium rounded-lg hover:bg-neutral-800 transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" />
              Create DSEAR Document
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-neutral-300 border-t-neutral-900"></div>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-lg border border-neutral-200">
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-neutral-400" />
            </div>
            <p className="text-neutral-500 text-lg mb-2">No DSEAR documents yet</p>
            <p className="text-neutral-400 text-sm mb-4">
              Create your first DSEAR assessment to get started
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white font-medium rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Document
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                      Version
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                      Assessment Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                      Assessor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                      Last Updated
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {documents.map((doc) => (
                    <tr
                      key={doc.id}
                      className="hover:bg-neutral-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/documents/${doc.id}?from=/dashboard/explosion`)}
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-neutral-900">{doc.title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                          {doc.document_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(doc.status)}`}>
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                        v{doc.version}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                        {formatDate(doc.assessment_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                        {doc.assessor_name || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                        {formatDate(doc.updated_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => navigate(`/documents/${doc.id}?from=/dashboard/explosion`)}
                            className="text-blue-600 hover:text-blue-900 transition-colors"
                            title="Open Document"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {doc.status === 'draft' && (
                            <button
                              onClick={() => setDeleteConfirmId(doc.id)}
                              className="text-red-600 hover:text-red-900 transition-colors"
                              title="Delete Document"
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
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateDocumentModal
          onClose={() => setShowCreateModal(false)}
          onDocumentCreated={handleDocumentCreated}
          allowedTypes={['DSEAR']}
        />
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-neutral-900 mb-2">Delete Document</h3>
            <p className="text-neutral-600 mb-4">
              Are you sure you want to delete this document? This action cannot be undone and will remove all associated modules and actions.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteDocument(deleteConfirmId)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Delete Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
