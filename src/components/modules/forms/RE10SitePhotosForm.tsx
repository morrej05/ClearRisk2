import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import { Plus, X, Upload, Image as ImageIcon, FileText, AlertCircle } from 'lucide-react';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';
import FloatingSaveBar from './FloatingSaveBar';

// Upload limits
const MAX_FILE_SIZE_MB = 15;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_BATCH_FILES = 20;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic'];

// Helper to get signed URLs for private storage
async function getSignedUrl(path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('evidence')
      .createSignedUrl(path, 600); // 10 minute expiry

    if (error) throw error;
    return data.signedUrl;
  } catch (error) {
    console.error('Error creating signed URL:', error);
    return null;
  }
}

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
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const d = moduleInstance.data || {};

  const [photos, setPhotos] = useState<Photo[]>(d.photos || []);
  const [sitePlan, setSitePlan] = useState<SitePlan | null>(d.site_plan || null);
  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  // Track signed URLs for display
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [sitePlanUrl, setSitePlanUrl] = useState<string | null>(null);

  // Load signed URLs when photos or site plan change
  useEffect(() => {
    async function loadSignedUrls() {
      // Load photo URLs
      const urls: Record<string, string> = {};
      for (const photo of photos) {
        if (photo.storage_path) {
          const url = await getSignedUrl(photo.storage_path);
          if (url) urls[photo.id] = url;
        }
      }
      setPhotoUrls(urls);

      // Load site plan URL
      if (sitePlan?.storage_path) {
        const url = await getSignedUrl(sitePlan.storage_path);
        setSitePlanUrl(url);
      } else {
        setSitePlanUrl(null);
      }
    }

    loadSignedUrls();
  }, [photos, sitePlan]);

  const validateImageFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `${file.name} exceeds ${MAX_FILE_SIZE_MB}MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)`;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
      return `${file.name} is not a supported image format (jpg, png, heic only)`;
    }
    return null;
  };

  const handleBatchPhotoUpload = async (files: FileList) => {
    setUploadingPhoto(true);
    setUploadErrors([]);
    const errors: string[] = [];
    const newPhotos: Photo[] = [];

    try {
      const filesToUpload = Array.from(files).slice(0, MAX_BATCH_FILES);
      if (files.length > MAX_BATCH_FILES) {
        errors.push(`Only first ${MAX_BATCH_FILES} files will be uploaded (limit: ${MAX_BATCH_FILES} per batch)`);
      }

      for (const file of filesToUpload) {
        const validationError = validateImageFile(file);
        if (validationError) {
          errors.push(validationError);
          continue;
        }

        try {
          const fileExt = file.name.split('.').pop();
          const fileName = `photo_${crypto.randomUUID()}.${fileExt}`;
          const filePath = `${moduleInstance.document_id}/${moduleInstance.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('evidence')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          newPhotos.push({
            id: crypto.randomUUID(),
            storage_path: filePath,
            caption: '',
            uploaded_at: new Date().toISOString(),
          });
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          errors.push(`Failed to upload ${file.name}`);
        }
      }

      if (newPhotos.length > 0) {
        setPhotos([...photos, ...newPhotos]);
      }

      if (errors.length > 0) {
        setUploadErrors(errors);
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSitePlanUpload = async (file: File) => {
    setUploadingSitePlan(true);
    setUploadErrors([]);

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadErrors([`File exceeds ${MAX_FILE_SIZE_MB}MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)`]);
      setUploadingSitePlan(false);
      return;
    }

    // Validate file type (images + PDF)
    const allowedTypes = [...ALLOWED_IMAGE_TYPES, 'application/pdf'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setUploadErrors(['File must be an image (jpg, png, heic) or PDF']);
      setUploadingSitePlan(false);
      return;
    }

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
      setUploadErrors(['Failed to upload site plan. Please try again.']);
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
    <>
    <div className="space-y-6 px-6 py-6 max-w-5xl mx-auto pb-24">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">RE-10 – Supporting Documentation</p>
            <p className="text-blue-800 mb-2">
              Upload site photographs and site plan documentation to support the assessment.
            </p>
            <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
              <li>Maximum {MAX_FILE_SIZE_MB}MB per file</li>
              <li>Up to {MAX_BATCH_FILES} photos per batch upload</li>
              <li>Supported formats: JPG, PNG, HEIC (+ PDF for site plan)</li>
            </ul>
          </div>
        </div>
      </div>

      {uploadErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-red-900 mb-2">Upload Errors</p>
              <ul className="text-red-800 space-y-1">
                {uploadErrors.map((error, idx) => (
                  <li key={idx} className="text-xs">{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Site Photos ({photos.length})</h3>
          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            <Upload className="w-4 h-4" />
            Upload Photos
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/heic"
              multiple
              className="hidden"
              disabled={uploadingPhoto}
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  handleBatchPhotoUpload(files);
                }
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
                <div className="aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
                  {photoUrls[photo.id] ? (
                    <img
                      src={photoUrls[photo.id]}
                      alt={photo.caption || 'Site photo'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-slate-400" />
                  )}
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
                {sitePlanUrl && sitePlan.storage_path.match(/\.(jpg|jpeg|png|heic)$/i) ? (
                  <div className="w-32 h-24 bg-slate-200 rounded overflow-hidden flex-shrink-0">
                    <img
                      src={sitePlanUrl}
                      alt="Site plan preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-slate-200 rounded flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-slate-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">Site Plan Document</p>
                  <p className="text-xs text-slate-500">
                    Uploaded {new Date(sitePlan.uploaded_at).toLocaleDateString()}
                  </p>
                  {sitePlanUrl && (
                    <a
                      href={sitePlanUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 mt-1"
                    >
                      View Full Size
                    </a>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={removeSitePlan}
                className="text-red-600 hover:text-red-700 p-1 flex-shrink-0"
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

      {document?.id && moduleInstance?.id && (
        <ModuleActions documentId={document.id} moduleInstanceId={moduleInstance.id} />
      )}
    </div>

      <FloatingSaveBar onSave={handleSave} isSaving={isSaving} />
    </>
  );
}
