import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import { Plus, X, Upload, Image as ImageIcon, FileText, AlertCircle } from 'lucide-react';
import OutcomePanel from '../OutcomePanel';
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

interface Photo {
  id: string;
  storage_path: string;
  caption: string;
  uploaded_at: string;
}

interface SitePlan {
  storage_path: string;
  description: string;
  uploaded_at: string;
}

interface RE10SitePhotosFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

export default function RE10SitePhotosForm({
  moduleInstance,
  document,
  onSaved,
}: RE10SitePhotosFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingSitePlan, setUploadingSitePlan] = useState(false);
  const d = moduleInstance.data || {};

  const [photos, setPhotos] = useState<Photo[]>(d.photos || []);
  const [sitePlan, setSitePlan] = useState<SitePlan | null>(d.site_plan || null);
  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const handlePhotoUpload = async (file: File) => {
    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `photo_${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${moduleInstance.document_id}/${moduleInstance.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('evidence')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const photo: Photo = {
        id: crypto.randomUUID(),
        storage_path: filePath,
        caption: '',
        uploaded_at: new Date().toISOString(),
      };

      setPhotos([...photos, photo]);
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSitePlanUpload = async (file: File) => {
    setUploadingSitePlan(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `site_plan_${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${moduleInstance.document_id}/${moduleInstance.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('evidence')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setSitePlan({
        storage_path: filePath,
        description: '',
        uploaded_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error uploading site plan:', error);
      alert('Failed to upload site plan. Please try again.');
    } finally {
      setUploadingSitePlan(false);
    }
  };

  const removePhoto = (photoId: string) => {
    setPhotos(photos.filter((p) => p.id !== photoId));
  };

  const updatePhotoCaption = (photoId: string, caption: string) => {
    setPhotos(photos.map((p) => (p.id === photoId ? { ...p, caption } : p)));
  };

  const removeSitePlan = () => {
    setSitePlan(null);
  };

  const updateSitePlanDescription = (description: string) => {
    if (sitePlan) {
      setSitePlan({ ...sitePlan, description });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = sanitizeModuleInstancePayload({
        data: { photos, site_plan: sitePlan },
        outcome,
        assessor_notes: assessorNotes,
      });

      const { error } = await supabase
        .from('module_instances')
        .update(payload)
        .eq('id', moduleInstance.id);

      if (error) throw error;
      onSaved();
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 px-6 py-6 max-w-5xl mx-auto">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Site Photos & Site Plan</p>
            <p className="text-blue-800">
              Upload general site photographs and site plan documentation to support the assessment.
              Site photos have no limit, while the site plan is a single document (PDF or image).
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Site Photos ({photos.length})</h3>
          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            <Upload className="w-4 h-4" />
            Upload Photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingPhoto}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePhotoUpload(file);
                e.target.value = '';
              }}
            />
          </label>
        </div>

        {uploadingPhoto && (
          <div className="text-sm text-blue-600">Uploading photo...</div>
        )}

        {photos.length > 0 ? (
          <div className="grid grid-cols-3 gap-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative bg-slate-50 border border-slate-200 rounded-lg overflow-hidden"
              >
                <div className="aspect-video bg-slate-100 flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-slate-400" />
                </div>
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id)}
                  className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="p-3">
                  <textarea
                    value={photo.caption}
                    onChange={(e) => updatePhotoCaption(photo.id, e.target.value)}
                    rows={2}
                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Photo caption..."
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500">
            No site photos uploaded yet
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Site Plan</h3>
          {!sitePlan && (
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
              <Upload className="w-4 h-4" />
              Upload Site Plan
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                disabled={uploadingSitePlan}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleSitePlanUpload(file);
                  e.target.value = '';
                }}
              />
            </label>
          )}
        </div>

        {uploadingSitePlan && (
          <div className="text-sm text-blue-600">Uploading site plan...</div>
        )}

        {sitePlan ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-200 rounded flex items-center justify-center">
                  <FileText className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Site Plan Document</p>
                  <p className="text-xs text-slate-500">
                    Uploaded {new Date(sitePlan.uploaded_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={removeSitePlan}
                className="text-red-600 hover:text-red-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description
              </label>
              <textarea
                value={sitePlan.description}
                onChange={(e) => updateSitePlanDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Describe the site plan document..."
              />
            </div>
          </div>
        ) : (
          <div className="text-center py-8 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500">
            No site plan uploaded yet
          </div>
        )}
      </div>

      <OutcomePanel
        outcome={outcome}
        assessorNotes={assessorNotes}
        onOutcomeChange={setOutcome}
        onNotesChange={setAssessorNotes}
      />

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {document?.id && moduleInstance?.id && (
        <ModuleActions documentId={document.id} moduleInstanceId={moduleInstance.id} />
      )}
    </div>
  );
}
