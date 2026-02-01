import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import { Plus, X, Upload, Image as ImageIcon, AlertCircle } from 'lucide-react';
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

interface Recommendation {
  id: string;
  text: string;
  priority: string;
  target_date?: string;
  owner?: string;
  photos: Photo[];
}

interface RE13RecommendationsFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

const MAX_PHOTOS_PER_RECOMMENDATION = 3;

export default function RE13RecommendationsForm({
  moduleInstance,
  document,
  onSaved,
}: RE13RecommendationsFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingPhotoForRec, setUploadingPhotoForRec] = useState<string | null>(null);
  const d = moduleInstance.data || {};

  const [recommendations, setRecommendations] = useState<Recommendation[]>(
    d.recommendations || []
  );
  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const addRecommendation = () => {
    setRecommendations([
      ...recommendations,
      {
        id: crypto.randomUUID(),
        text: '',
        priority: 'medium',
        target_date: '',
        owner: '',
        photos: [],
      },
    ]);
  };

  const removeRecommendation = (id: string) => {
    setRecommendations(recommendations.filter((r) => r.id !== id));
  };

  const updateRecommendation = (id: string, updates: Partial<Recommendation>) => {
    setRecommendations(
      recommendations.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  };

  const handlePhotoUpload = async (recId: string, file: File) => {
    const rec = recommendations.find((r) => r.id === recId);
    if (!rec || rec.photos.length >= MAX_PHOTOS_PER_RECOMMENDATION) {
      return;
    }

    setUploadingPhotoForRec(recId);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
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

      updateRecommendation(recId, {
        photos: [...rec.photos, photo],
      });
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhotoForRec(null);
    }
  };

  const removePhoto = (recId: string, photoId: string) => {
    const rec = recommendations.find((r) => r.id === recId);
    if (!rec) return;

    updateRecommendation(recId, {
      photos: rec.photos.filter((p) => p.id !== photoId),
    });
  };

  const updatePhotoCaption = (recId: string, photoId: string, caption: string) => {
    const rec = recommendations.find((r) => r.id === recId);
    if (!rec) return;

    updateRecommendation(recId, {
      photos: rec.photos.map((p) => (p.id === photoId ? { ...p, caption } : p)),
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = sanitizeModuleInstancePayload({
        data: { recommendations },
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
            <p className="font-semibold mb-1">Recommendations</p>
            <p className="text-blue-800">
              Document recommendations arising from the risk engineering assessment. Each
              recommendation may include up to 3 supporting photographs.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {recommendations.map((rec, idx) => (
          <div key={rec.id} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-slate-900">Recommendation {idx + 1}</h3>
              <button
                type="button"
                onClick={() => removeRecommendation(rec.id)}
                className="text-red-600 hover:text-red-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Recommendation Text
              </label>
              <textarea
                value={rec.text}
                onChange={(e) => updateRecommendation(rec.id, { text: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe the recommendation..."
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Priority
                </label>
                <select
                  value={rec.priority}
                  onChange={(e) => updateRecommendation(rec.id, { priority: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Target Date
                </label>
                <input
                  type="date"
                  value={rec.target_date || ''}
                  onChange={(e) => updateRecommendation(rec.id, { target_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Owner
                </label>
                <input
                  type="text"
                  value={rec.owner || ''}
                  onChange={(e) => updateRecommendation(rec.id, { owner: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Assigned to..."
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">
                  Photos ({rec.photos.length}/{MAX_PHOTOS_PER_RECOMMENDATION})
                </label>
                {rec.photos.length < MAX_PHOTOS_PER_RECOMMENDATION ? (
                  <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                    <Upload className="w-4 h-4" />
                    Add Photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingPhotoForRec === rec.id}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(rec.id, file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                ) : (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                    Maximum 3 photos reached
                  </span>
                )}
              </div>

              {rec.photos.length > 0 ? (
                <div className="grid grid-cols-3 gap-4">
                  {rec.photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="relative bg-slate-50 border border-slate-200 rounded-lg overflow-hidden"
                    >
                      <div className="aspect-video bg-slate-100 flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-slate-400" />
                      </div>
                      <button
                        type="button"
                        onClick={() => removePhoto(rec.id, photo.id)}
                        className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="p-2">
                        <input
                          type="text"
                          value={photo.caption}
                          onChange={(e) => updatePhotoCaption(rec.id, photo.id, e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Photo caption..."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500">
                  No photos attached
                </div>
              )}

              {uploadingPhotoForRec === rec.id && (
                <div className="text-sm text-blue-600 mt-2">Uploading...</div>
              )}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addRecommendation}
          className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-blue-500 hover:text-blue-600 flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Recommendation
        </button>
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
