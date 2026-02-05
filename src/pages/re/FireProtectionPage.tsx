import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import FireProtectionForm from '../../components/re/FireProtectionForm';

export default function FireProtectionPage() {
  const { id: documentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<any>(null);

  useEffect(() => {
    if (!documentId) return;

    async function loadDocument() {
      const { data: doc } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .maybeSingle();
      setDocument(doc);
    }

    loadDocument();
  }, [documentId]);

  if (!documentId) {
    return (
      <div className="p-8">
        <div className="text-slate-600">Invalid document ID</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/documents/${documentId}`)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold text-slate-900">RE-06: Fire Protection</h1>
              <p className="text-sm text-slate-600 mt-1">{document?.title || 'Risk Engineering Assessment'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <FireProtectionForm documentId={documentId} />
      </div>
    </div>
  );
}
