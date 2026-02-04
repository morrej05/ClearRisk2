import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { FileText, Image as ImageIcon, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ModuleActions from '../ModuleActions';

interface Document {
  id: string;
  title: string;
}

interface ModuleInstance {
  id: string;
  document_id: string;
  outcome: string | null;
  assessor_notes: string;
  data: Record<string, any>;
}

interface RE11SupportingDocsFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

export default function RE11SupportingDocsForm({
  moduleInstance,
  document,
  onSaved,
}: RE11SupportingDocsFormProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hasPhotos, setHasPhotos] = useState(false);
  const [hasSitePlan, setHasSitePlan] = useState(false);
  const [photosCount, setPhotosCount] = useState(0);

  useEffect(() => {
    async function loadDocumentationStatus() {
      setLoading(true);
      try {
        const { data: modules, error } = await supabase
          .from('module_instances')
          .select('module_key, data')
          .eq('document_id', moduleInstance.document_id)
          .eq('module_key', 'RE_10_SITE_PHOTOS')
          .maybeSingle();

        if (error) throw error;

        if (modules?.data) {
          const photos = modules.data.photos || [];
          const sitePlan = modules.data.site_plan;

          setHasPhotos(photos.length > 0);
          setPhotosCount(photos.length);
          setHasSitePlan(!!sitePlan);
        }
      } catch (error) {
        console.error('Error loading documentation status:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDocumentationStatus();
  }, [moduleInstance.document_id]);

  const navigateToSitePhotos = () => {
    navigate(`/app/documents/${document.id}?module=RE_10_SITE_PHOTOS`);
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Supporting Documentation
        </h2>
        <p className="text-slate-600">
          Review the status of supporting documentation for this risk engineering assessment.
        </p>
      </div>

      {/* Documentation Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Site Photos Card */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${hasPhotos ? 'bg-green-100' : 'bg-slate-100'}`}>
                <ImageIcon className={`w-6 h-6 ${hasPhotos ? 'text-green-600' : 'text-slate-400'}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Site Photos</h3>
                <p className="text-sm text-slate-500">Photographic evidence</p>
              </div>
            </div>
            {hasPhotos ? (
              <CheckCircle className="w-6 h-6 text-green-600" />
            ) : (
              <XCircle className="w-6 h-6 text-slate-300" />
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-t border-slate-100">
              <span className="text-sm text-slate-600">Status</span>
              {hasPhotos ? (
                <span className="text-sm font-medium text-green-600">
                  {photosCount} {photosCount === 1 ? 'photo' : 'photos'} uploaded
                </span>
              ) : (
                <span className="text-sm font-medium text-slate-400">Not uploaded</span>
              )}
            </div>

            <button
              onClick={navigateToSitePhotos}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <span>{hasPhotos ? 'View & Manage Photos' : 'Upload Photos'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Site Plan Card */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${hasSitePlan ? 'bg-green-100' : 'bg-slate-100'}`}>
                <FileText className={`w-6 h-6 ${hasSitePlan ? 'text-green-600' : 'text-slate-400'}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Site Plan</h3>
                <p className="text-sm text-slate-500">Layout documentation</p>
              </div>
            </div>
            {hasSitePlan ? (
              <CheckCircle className="w-6 h-6 text-green-600" />
            ) : (
              <XCircle className="w-6 h-6 text-slate-300" />
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-t border-slate-100">
              <span className="text-sm text-slate-600">Status</span>
              {hasSitePlan ? (
                <span className="text-sm font-medium text-green-600">Available</span>
              ) : (
                <span className="text-sm font-medium text-slate-400">Not uploaded</span>
              )}
            </div>

            <button
              onClick={navigateToSitePhotos}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <span>{hasSitePlan ? 'View & Manage Site Plan' : 'Upload Site Plan'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Completeness Summary */}
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">Documentation Completeness</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Overall Status</span>
            {hasPhotos && hasSitePlan ? (
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                Complete
              </span>
            ) : (
              <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                Incomplete
              </span>
            )}
          </div>
          <div className="text-sm text-slate-500">
            {hasPhotos && hasSitePlan ? (
              <p>All required supporting documentation has been uploaded.</p>
            ) : (
              <p>
                Please upload {!hasPhotos && !hasSitePlan ? 'site photos and site plan' : !hasPhotos ? 'site photos' : 'site plan'} to complete this section.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Module Actions */}
      {document?.id && moduleInstance?.id && (
        <ModuleActions
          documentId={document.id}
          moduleInstanceId={moduleInstance.id}
        />
      )}
    </div>
  );
}
