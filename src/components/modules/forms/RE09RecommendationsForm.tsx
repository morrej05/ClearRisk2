import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import FloatingSaveBar from './FloatingSaveBar';
import { Plus, X, Upload, Image as ImageIcon, Sparkles, AlertCircle } from 'lucide-react';

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
  title: string;
  detail: string;
  priority: 'High' | 'Medium' | 'Low';
  target_date: string;
  owner: string;
  status: 'Open' | 'In Progress' | 'Complete';
  related_section: string;
  photos: Photo[];
  is_auto_generated?: boolean;
  source_module?: string;
}

interface RE09RecommendationsFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

const MAX_PHOTOS_PER_RECOMMENDATION = 3;

const RELATED_SECTIONS = [
  'Construction',
  'Fire Protection',
  'Management',
  'Hazards',
  'Utilities',
  'Loss Prevention',
  'Other',
];

function createEmptyRecommendation(): Recommendation {
  return {
    id: crypto.randomUUID(),
    title: '',
    detail: '',
    priority: 'Medium',
    target_date: '',
    owner: '',
    status: 'Open',
    related_section: 'Other',
    photos: [],
    is_auto_generated: false,
  };
}

export default function RE09RecommendationsForm({
  moduleInstance,
  document,
  onSaved,
}: RE09RecommendationsFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingPhotoForRec, setUploadingPhotoForRec] = useState<string | null>(null);
  const [generatingAuto, setGeneratingAuto] = useState(false);
  const d = moduleInstance.data || {};

  const safeRecommendations = Array.isArray(d.recommendations)
    ? d.recommendations.map((r: any) => ({
        ...createEmptyRecommendation(),
        ...r,
        photos: Array.isArray(r.photos) ? r.photos : [],
      }))
    : [];

  const [recommendations, setRecommendations] = useState<Recommendation[]>(safeRecommendations);

  useEffect(() => {
    if (recommendations.length === 0) {
      generateAutoRecommendations();
    }
  }, []);

  const generateAutoRecommendations = async () => {
    setGeneratingAuto(true);
    try {
      const { data: modules, error } = await supabase
        .from('module_instances')
        .select('module_key, data')
        .eq('document_id', moduleInstance.document_id)
        .eq('module_key', 'RISK_ENGINEERING')
        .single();

      if (error) throw error;

      const riskEngData = modules?.data || {};
      const ratings = riskEngData.ratings || {};

      const autoRecs: Recommendation[] = [];

      Object.entries(ratings).forEach(([canonicalKey, rating]) => {
        if (typeof rating === 'number' && rating <= 2) {
          const title = canonicalKey
            .split('_')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');

          autoRecs.push({
            id: crypto.randomUUID(),
            title: `Improve ${title}`,
            detail: `This area received a rating of ${rating}/5, indicating significant gaps. Implement improvements to address identified deficiencies in ${title.toLowerCase()}.`,
            priority: rating === 1 ? 'High' : 'Medium',
            target_date: '',
            owner: '',
            status: 'Open',
            related_section: mapCanonicalKeyToSection(canonicalKey),
            photos: [],
            is_auto_generated: true,
            source_module: canonicalKey,
          });
        }
      });

      if (autoRecs.length > 0) {
        setRecommendations([...recommendations, ...autoRecs]);
      }
    } catch (err) {
      console.error('Error generating auto recommendations:', err);
    } finally {
      setGeneratingAuto(false);
    }
  };

  const mapCanonicalKeyToSection = (key: string): string => {
    if (key.includes('fire') || key.includes('safety') || key.includes('protection')) {
      return 'Fire Protection';
    }
    if (key.includes('management') || key.includes('control')) {
      return 'Management';
    }
    if (key.includes('utilities') || key.includes('electrical')) {
      return 'Utilities';
    }
    if (key.includes('hazard') || key.includes('process')) {
      return 'Hazards';
    }
    if (key.includes('construction') || key.includes('building')) {
      return 'Construction';
    }
    return 'Other';
  };

  const addRecommendation = () => {
    setRecommendations([...recommendations, createEmptyRecommendation()]);
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
      alert(`Maximum ${MAX_PHOTOS_PER_RECOMMENDATION} photos per recommendation`);
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
      const sanitized = sanitizeModuleInstancePayload({ data: { recommendations } });

      const { error } = await supabase
        .from('module_instances')
        .update({
          data: sanitized.data,
        })
        .eq('id', moduleInstance.id);

      if (error) throw error;
      onSaved();
    } catch (error) {
      console.error('Error saving module:', error);
      alert('Failed to save module. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const autoRecCount = recommendations.filter((r) => r.is_auto_generated).length;
  const manualRecCount = recommendations.filter((r) => !r.is_auto_generated).length;

  return (
    <>
    <div className="p-6 max-w-7xl mx-auto pb-24">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-09 - Recommendations</h2>
        <p className="text-slate-600">Actions list arising from the risk engineering assessment</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Recommendations Overview</p>
            <p className="text-blue-800">
              {recommendations.length === 0
                ? 'No recommendations yet. Add manually or generate from low ratings.'
                : `${manualRecCount} manual + ${autoRecCount} auto-generated = ${recommendations.length} total recommendations. Each may include up to 3 photos.`}
            </p>
          </div>
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={generateAutoRecommendations}
            disabled={generatingAuto}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {generatingAuto ? 'Generating...' : 'Add Auto-Generated Recs'}
          </button>
        </div>
      )}

      <div className="space-y-6">
        {recommendations.map((rec, idx) => (
          <div
            key={rec.id}
            className={`bg-white rounded-lg p-6 space-y-4 ${
              rec.is_auto_generated
                ? 'border-2 border-purple-200'
                : 'border border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900">Recommendation {idx + 1}</h3>
                {rec.is_auto_generated && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                    <Sparkles className="w-3 h-3" />
                    Auto
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeRecommendation(rec.id)}
                className="text-red-600 hover:text-red-700 p-1"
                title="Delete recommendation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input
                type="text"
                value={rec.title}
                onChange={(e) => updateRecommendation(rec.id, { title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="Brief title for this recommendation"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Detail / Justification
              </label>
              <textarea
                value={rec.detail}
                onChange={(e) => updateRecommendation(rec.id, { detail: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="Detailed description and justification for this recommendation"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                <select
                  value={rec.priority}
                  onChange={(e) =>
                    updateRecommendation(rec.id, {
                      priority: e.target.value as Recommendation['priority'],
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={rec.status}
                  onChange={(e) =>
                    updateRecommendation(rec.id, {
                      status: e.target.value as Recommendation['status'],
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Complete">Complete</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Target Date
                </label>
                <input
                  type="date"
                  value={rec.target_date}
                  onChange={(e) => updateRecommendation(rec.id, { target_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Owner</label>
                <input
                  type="text"
                  value={rec.owner}
                  onChange={(e) => updateRecommendation(rec.id, { owner: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="Assigned to"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Related Section
              </label>
              <select
                value={rec.related_section}
                onChange={(e) =>
                  updateRecommendation(rec.id, { related_section: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              >
                {RELATED_SECTIONS.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-slate-700">
                  Supporting Photos ({rec.photos.length}/{MAX_PHOTOS_PER_RECOMMENDATION})
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
                    Maximum {MAX_PHOTOS_PER_RECOMMENDATION} photos reached
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
                          onChange={(e) =>
                            updatePhotoCaption(rec.id, photo.id, e.target.value)
                          }
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                          placeholder="Photo caption..."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500">
                  No photos attached
                </div>
              )}

              {uploadingPhotoForRec === rec.id && (
                <div className="text-sm text-blue-600 mt-2">Uploading photo...</div>
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
          Add Manual Recommendation
        </button>
      </div>

    </div>

      <FloatingSaveBar onSave={handleSave} isSaving={isSaving} />
    </>
  );
}
