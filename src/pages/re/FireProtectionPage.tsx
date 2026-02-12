import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function FireProtectionPage() {
  const { id: documentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function redirectToModule() {
      if (!documentId) {
        setError('No document ID provided');
        return;
      }

      try {
        const { data: moduleInstances, error: queryError } = await supabase
          .from('module_instances')
          .select('id')
          .eq('document_id', documentId)
          .eq('module_key', 'RE_06_FIRE_PROTECTION')
          .maybeSingle();

        if (queryError) {
          console.error('[FireProtectionPage] Query error:', queryError);
          setError('Failed to load Fire Protection module');
          return;
        }

        if (!moduleInstances) {
          setError('Fire Protection module not found for this document');
          return;
        }

        navigate(`/documents/${documentId}/workspace?m=${moduleInstances.id}`, { replace: true });
      } catch (err) {
        console.error('[FireProtectionPage] Redirect error:', err);
        setError('An unexpected error occurred');
      }
    }

    redirectToModule();
  }, [documentId, navigate]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle className="w-6 h-6" />
              <h1 className="text-xl font-semibold">Unable to Load Fire Protection</h1>
            </div>
            <p className="text-slate-600 mb-6">{error}</p>
            <Link
              to={`/documents/${documentId}/workspace`}
              className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Return to Document Workspace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
        <p className="text-slate-600 text-lg">Opening Fire Protection...</p>
      </div>
    </div>
  );
}