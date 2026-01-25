import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Plus, Eye, Trash2, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import CreateDocumentModal from '../../components/documents/CreateDocumentModal';
import { Button, Badge, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, PageHeader, EmptyState } from '../../components/ui/DesignSystem';

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

export default function FireSafetyDashboard() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (organisation?.id) {
      fetchDocuments();
    }
  }, [organisation?.id]);

  const fetchDocuments = async () => {
    if (!organisation?.id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('organisation_id', organisation.id)
        .in('document_type', ['FRA', 'FSD'])
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

  const getStatusBadgeVariant = (status: string): 'neutral' | 'success' | 'warning' => {
    switch (status) {
      case 'issued':
        return 'success';
      case 'superseded':
        return 'warning';
      default:
        return 'neutral';
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

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate('/common-dashboard')}
          className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 font-medium transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <PageHeader
          title="Fire Safety"
          subtitle="Manage Fire Risk Assessments and Fire Strategy Documents"
          actions={
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-5 h-5 mr-2" />
              Create Document
            </Button>
          }
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-neutral-200 border-t-red-600"></div>
          </div>
        ) : documents.length === 0 ? (
          <div className="bg-white rounded-lg border border-neutral-200 p-12">
            <EmptyState
              title="No fire safety documents yet"
              description="Create your first FRA or FSD to get started"
              action={
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Document
                </Button>
              }
            />
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
            <Table>
              <TableHead>
                <tr>
                  <TableHeader>Title</TableHeader>
                  <TableHeader>Type</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Version</TableHeader>
                  <TableHeader>Assessment Date</TableHeader>
                  <TableHeader>Assessor</TableHeader>
                  <TableHeader>Last Updated</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </tr>
              </TableHead>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow
                    key={doc.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/documents/${doc.id}?from=/dashboard/fire`)}
                  >
                    <TableCell>
                      <div className="font-medium text-neutral-900">{doc.title}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="info">{doc.document_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(doc.status)}>
                        {doc.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-neutral-600">v{doc.version}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-neutral-600">{formatDate(doc.assessment_date)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-neutral-600">{doc.assessor_name || '—'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-neutral-600">{formatDate(doc.updated_at)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/documents/${doc.id}?from=/dashboard/fire`)}
                          className="text-neutral-600 hover:text-neutral-900 transition-colors"
                          title="Open Document"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {doc.status === 'draft' && (
                          <button
                            onClick={() => setDeleteConfirmId(doc.id)}
                            className="text-neutral-600 hover:text-red-600 transition-colors"
                            title="Delete Document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateDocumentModal
          onClose={() => setShowCreateModal(false)}
          onDocumentCreated={handleDocumentCreated}
          allowedTypes={['FRA', 'FSD']}
        />
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-neutral-200 max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">Delete Document</h3>
            <p className="text-neutral-600 mb-6">
              Are you sure you want to delete this document? This action cannot be undone and will remove all associated modules and actions.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDeleteDocument(deleteConfirmId)}
              >
                Delete Document
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
