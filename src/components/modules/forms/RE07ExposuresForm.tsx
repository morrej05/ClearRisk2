import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import ModuleActions from '../ModuleActions';
import FloatingSaveBar from './FloatingSaveBar';
import { updateSectionGrade } from '../../../utils/sectionGrades';
import { AlertTriangle, Shield, Cloud, Flame, Wind, Mountain } from 'lucide-react';
import RatingButtons from '../../re/RatingButtons';
import { syncAutoRecToRegister } from '../../../lib/re/recommendations/recommendationPipeline';

interface Document {
  id: string;
  title: string;
  document_type: string;
}

interface ModuleInstance {
  id: string;
  document_id: string;
  outcome: string | null;
  assessor_notes: string;
  data: Record<string, any>;
}

interface RE07ExposuresFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface PerilRating {
  rating: number;
  notes: string;
}

interface OtherPeril extends PerilRating {
  label: string;
}

const PERIL_RATING_GUIDANCE = `Rate the residual risk to the site from this peril after considering hazard severity and mitigation. Permanent, engineered measures should carry the greatest weight. Well-developed emergency plans and response arrangements may be reflected where appropriate, but will not usually offset severe inherent hazard on their own.`;

const HUMAN_EXPOSURE_GUIDANCE = `Assess the site's exposure to deliberate or opportunistic loss based on location, access, visibility, and surrounding activity. This is not an audit of security systems; controls may be noted as context only.`;

const RATING_LABELS: Record<number, string> = {
  1: 'Poor / Inadequate',
  2: 'Below Average',
  3: 'Average / Acceptable',
  4: 'Good',
  5: 'Excellent',
};

export default function RE07ExposuresForm({
  moduleInstance,
  document,
  onSaved,
}: RE07ExposuresFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const d = moduleInstance.data?.exposures || {};

  const envPerils = d.environmental?.perils || {};
  const [floodRating, setFloodRating] = useState<number>(envPerils.flood?.rating || 3);
  const [floodNotes, setFloodNotes] = useState<string>(envPerils.flood?.notes || '');

  const [windRating, setWindRating] = useState<number>(envPerils.wind?.rating || 3);
  const [windNotes, setWindNotes] = useState<string>(envPerils.wind?.notes || '');

  const [earthquakeRating, setEarthquakeRating] = useState<number>(envPerils.earthquake?.rating || 3);
  const [earthquakeNotes, setEarthquakeNotes] = useState<string>(envPerils.earthquake?.notes || '');

  const [wildfireRating, setWildfireRating] = useState<number>(envPerils.wildfire?.rating || 3);
  const [wildfireNotes, setWildfireNotes] = useState<string>(envPerils.wildfire?.notes || '');

  const [hasOtherPeril, setHasOtherPeril] = useState<boolean>(!!envPerils.other);
  const [otherLabel, setOtherLabel] = useState<string>(envPerils.other?.label || '');
  const [otherRating, setOtherRating] = useState<number>(envPerils.other?.rating || 3);
  const [otherNotes, setOtherNotes] = useState<string>(envPerils.other?.notes || '');

  const [humanExposureRating, setHumanExposureRating] = useState<number>(
    d.human_exposure?.rating || 3
  );
  const [humanExposureNotes, setHumanExposureNotes] = useState<string>(
    d.human_exposure?.notes || ''
  );

  // all your useState declarations...

const [humanExposureRating, setHumanExposureRating] = ...
const [humanExposureNotes, setHumanExposureNotes] = ...

// ⬇ REPLACE THE OLD SYNC EFFECT WITH THIS ⬇
useEffect(() => {
  const d = moduleInstance.data?.exposures;
  if (!d) return;

  const p = d.environmental?.perils || {};

  if (p.flood?.rating !== floodRating) {
    setFloodRating(p.flood?.rating ?? 3);
  }

  if (p.wind?.rating !== windRating) {
    setWindRating(p.wind?.rating ?? 3);
  }

  if (p.earthquake?.rating !== earthquakeRating) {
    setEarthquakeRating(p.earthquake?.rating ?? 3);
  }

  if (p.wildfire?.rating !== wildfireRating) {
    setWildfireRating(p.wildfire?.rating ?? 3);
  }

  if (d.human_exposure?.rating !== humanExposureRating) {
    setHumanExposureRating(d.human_exposure?.rating ?? 3);
  }

}, [moduleInstance.data?.exposures]);

// then BELOW this remains your existing derived ratings useEffect

  // Compute derived ratings whenever individual ratings change
  useEffect(() => {
    const perilRatings = [floodRating, windRating, earthquakeRating, wildfireRating];
    if (hasOtherPeril) {
      perilRatings.push(otherRating);
    }
    const worstPeril = Math.min(...perilRatings);
    setDerivedEnvironmentalRating(worstPeril);

    const overall = Math.min(worstPeril, humanExposureRating);
    setOverallExposureRating(overall);
  }, [floodRating, windRating, earthquakeRating, wildfireRating, otherRating, hasOtherPeril, humanExposureRating]);

  const syncExposureAutosToRegister = async () => {
    const documentId = moduleInstance.document_id;

    // Canonical keys for exposures (used by pipeline fallback + future library mapping)
    const items: Array<{ canonicalKey: string; rating: number }> = [
      { canonicalKey: 'exposures_flood', rating: floodRating },
      { canonicalKey: 'exposures_wind_storm', rating: windRating },
      { canonicalKey: 'exposures_earthquake', rating: earthquakeRating },
      { canonicalKey: 'exposures_wildfire', rating: wildfireRating },
      ...(hasOtherPeril && otherLabel
        ? [{
            canonicalKey: `exposures_other_${otherLabel
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9]+/g, '_')
              .replace(/^_+|_+$/g, '')}`,
            rating: otherRating,
          }]
        : []),
      { canonicalKey: 'exposures_human_malicious', rating: humanExposureRating },
    ];

    for (const item of items) {
      if (item.rating <= 2) {
        await syncAutoRecToRegister({
          documentId,
          moduleKey: 'RE_07_NATURAL_HAZARDS',
          canonicalKey: item.canonicalKey,
          rating_1_5: item.rating,
          industryKey: null,
        });
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const exposuresData = {
        environmental: {
          perils: {
            flood: { rating: floodRating, notes: floodNotes },
            wind: { rating: windRating, notes: windNotes },
            earthquake: { rating: earthquakeRating, notes: earthquakeNotes },
            wildfire: { rating: wildfireRating, notes: wildfireNotes },
            ...(hasOtherPeril && otherLabel ? {
              other: { label: otherLabel, rating: otherRating, notes: otherNotes }
            } : {}),
          },
          derived_rating: derivedEnvironmentalRating,
        },
        human_exposure: {
          rating: humanExposureRating,
          notes: humanExposureNotes,
        },
        overall_exposure_rating: overallExposureRating,
      };

      const sanitized = sanitizeModuleInstancePayload({
        data: { exposures: exposuresData },
      });

      const { error } = await supabase
        .from('module_instances')
        .update({
          data: sanitized.data,
          completed_at: new Date().toISOString(),
        })
        .eq('id', moduleInstance.id);

      if (error) throw error;

      // Update section grade (should not block save)
      try {
        await updateSectionGrade(document.id, 'exposure', overallExposureRating);
      } catch (e) {
        console.error('[RE07Exposures] updateSectionGrade failed:', e);
      }
      
      // Auto-rec sync (must not block save)
      try {
        await syncExposureAutosToRegister();
      } catch (e) {
        console.error('[RE07Exposures] auto-rec sync failed:', e);
      }
      
      // Only now report success
      onSaved();

    } catch (error) {
      console.error('Error saving module:', error);
      alert('Failed to save module. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getDerivedRatingColor = (rating: number): string => {
    if (rating >= 4) return 'text-green-700 bg-green-50 border-green-300';
    if (rating === 3) return 'text-amber-700 bg-amber-50 border-amber-300';
    if (rating === 2) return 'text-orange-700 bg-orange-50 border-orange-300';
    return 'text-red-700 bg-red-50 border-red-300';
  };

  const saveDraftExposures = async (overrides: Partial<{
  floodRating: number; floodNotes: string;
  windRating: number; windNotes: string;
  earthquakeRating: number; earthquakeNotes: string;
  wildfireRating: number; wildfireNotes: string;
  hasOtherPeril: boolean;
  otherLabel: string; otherRating: number; otherNotes: string;
  humanExposureRating: number; humanExposureNotes: string;
}>) => {
  const nextFloodRating = overrides.floodRating ?? floodRating;
  const nextFloodNotes = overrides.floodNotes ?? floodNotes;

  const nextWindRating = overrides.windRating ?? windRating;
  const nextWindNotes = overrides.windNotes ?? windNotes;

  const nextEarthquakeRating = overrides.earthquakeRating ?? earthquakeRating;
  const nextEarthquakeNotes = overrides.earthquakeNotes ?? earthquakeNotes;

  const nextWildfireRating = overrides.wildfireRating ?? wildfireRating;
  const nextWildfireNotes = overrides.wildfireNotes ?? wildfireNotes;

  const nextHasOther = overrides.hasOtherPeril ?? hasOtherPeril;
  const nextOtherLabel = overrides.otherLabel ?? otherLabel;
  const nextOtherRating = overrides.otherRating ?? otherRating;
  const nextOtherNotes = overrides.otherNotes ?? otherNotes;

  const nextHumanRating = overrides.humanExposureRating ?? humanExposureRating;
  const nextHumanNotes = overrides.humanExposureNotes ?? humanExposureNotes;

  const perilRatings = [nextFloodRating, nextWindRating, nextEarthquakeRating, nextWildfireRating];
  if (nextHasOther && nextOtherLabel) perilRatings.push(nextOtherRating);
  const worstPeril = Math.min(...perilRatings);
  const overall = Math.min(worstPeril, nextHumanRating);

  const exposuresData = {
    environmental: {
      perils: {
        flood: { rating: nextFloodRating, notes: nextFloodNotes },
        wind: { rating: nextWindRating, notes: nextWindNotes },
        earthquake: { rating: nextEarthquakeRating, notes: nextEarthquakeNotes },
        wildfire: { rating: nextWildfireRating, notes: nextWildfireNotes },
        ...(nextHasOther && nextOtherLabel
          ? { other: { label: nextOtherLabel, rating: nextOtherRating, notes: nextOtherNotes } }
          : {}),
      },
      derived_rating: worstPeril,
    },
    human_exposure: { rating: nextHumanRating, notes: nextHumanNotes },
    overall_exposure_rating: overall,
  };

  const sanitized = sanitizeModuleInstancePayload({ data: { exposures: exposuresData } });

  const { error } = await supabase
    .from('module_instances')
    .update({ data: sanitized.data }) // draft save only
    .eq('id', moduleInstance.id);

  if (error) {
    console.error('[RE07Exposures] draft save failed:', error);
    throw error;
  }

  // keep section grade roughly aligned (non-blocking)
  try {
    await updateSectionGrade(document.id, 'exposure', overall);
  } catch (e) {
    console.error('[RE07Exposures] updateSectionGrade failed:', e);
  }
};

const syncExposureAutoRec = async (canonicalKey: string, rating: number) => {
  if (rating > 2) return;
  try {
    await syncAutoRecToRegister({
      documentId: moduleInstance.document_id,
      moduleKey: 'RE_07_NATURAL_HAZARDS',
      canonicalKey,
      rating_1_5: rating,
      industryKey: null,
    });
  } catch (e) {
    console.error('[RE07Exposures] auto-rec sync failed:', e);
  }
};

const handleExposureRatingChange = async (
  canonicalKey: string,
  newRating: number,
  setState: (value: number) => void,
  overrideKey: 'floodRating' | 'windRating' | 'earthquakeRating' | 'wildfireRating' | 'otherRating' | 'humanExposureRating'
) => {
  setState(newRating);

  try {
    await saveDraftExposures({ [overrideKey]: newRating });
    await syncExposureAutoRec(canonicalKey, newRating);
  } catch (e) {
    console.error(`[RE07Exposures] Failed to persist ${canonicalKey}:`, e);
  }
};

const handleOtherPerilRatingChange = async (newRating: number) => {
  setOtherRating(newRating);

  if (!otherLabel) return;

  const canonicalKey = `exposures_other_${otherLabel
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')}`;

  try {
    await saveDraftExposures({ otherRating: newRating });
    await syncExposureAutoRec(canonicalKey, newRating);
  } catch (e) {
    console.error(`[RE07Exposures] Failed to persist other peril:`, e);
  }
};

  const renderPerilRow = (
    icon: React.ReactNode,
    label: string,
    rating: number,
    notes: string,
    onRatingChange: (value: number) => void,
    onNotesChange: (value: string) => void
  ) => (
    <div className="border border-slate-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-shrink-0">{icon}</div>
        <h4 className="font-semibold text-slate-900">{label}</h4>
      </div>

      <RatingButtons
        value={rating}
        onChange={onRatingChange}
        labels={RATING_LABELS}
        size="sm"
      />

      <textarea
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        rows={3}
        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
        placeholder="Basis of judgement: hazard severity, mitigation measures, residual risk..."
      />
    </div>
  );

  return (
    <>
      <div className="p-6 max-w-5xl mx-auto pb-24 space-y-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-5 - Exposures</h2>
          <p className="text-slate-600">
            Environmental and human exposure assessment (COPE-aligned, Global Pillar)
          </p>
        </div>

        {/* Environmental Risk Section */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
          <div className="flex items-start gap-3 mb-4">
            <Cloud className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Environmental Risk</h3>
              <p className="text-sm text-slate-600 mb-3">{PERIL_RATING_GUIDANCE}</p>
            </div>
          </div>

          <div className="space-y-3">
            {renderPerilRow(
              <Cloud className="w-5 h-5 text-blue-600" />,
              'Flood',
              floodRating,
              floodNotes,
              (v) => handleExposureRatingChange('exposures_flood', v, setFloodRating, 'floodRating'),
              setFloodNotes
            )}

            {renderPerilRow(
              <Wind className="w-5 h-5 text-cyan-600" />,
              'Wind / Storm',
              windRating,
              windNotes,
              (v) => handleExposureRatingChange('exposures_wind_storm', v, setWindRating, 'windRating'),
              setWindNotes
            )}

            {renderPerilRow(
              <Mountain className="w-5 h-5 text-amber-600" />,
              'Earthquake',
              earthquakeRating,
              earthquakeNotes,
              (v) => handleExposureRatingChange('exposures_earthquake', v, setEarthquakeRating, 'earthquakeRating'),
              setEarthquakeNotes
            )}

            {renderPerilRow(
              <Flame className="w-5 h-5 text-orange-600" />,
              'Wildfire',
              wildfireRating,
              wildfireNotes,
              (v) => handleExposureRatingChange('exposures_wildfire', v, setWildfireRating, 'wildfireRating'),
              setWildfireNotes
            )}

            {/* Other Peril (Optional) */}
            {hasOtherPeril ? (
              <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3 mb-3">
                  <AlertTriangle className="w-5 h-5 text-slate-600 flex-shrink-0" />
                  <input
                    type="text"
                    value={otherLabel}
                    onChange={(e) => setOtherLabel(e.target.value)}
                    placeholder="Other peril name..."
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-md"
                  />
                  <button
                    onClick={() => setHasOtherPeril(false)}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>

                <RatingButtons
                  value={otherRating}
                  onChange={handleOtherPerilRatingChange}
                  labels={RATING_LABELS}
                  size="sm"
                />

                <textarea
                  value={otherNotes}
                  onChange={(e) => setOtherNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="Basis of judgement..."
                />
              </div>
            ) : (
              <button
                onClick={() => setHasOtherPeril(true)}
                className="w-full px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-600 hover:border-slate-400 hover:text-slate-700 transition-colors"
              >
                + Add Other Environmental Peril
              </button>
            )}
          </div>

          {/* Derived Environmental Rating */}
          <div className={`mt-6 p-4 border-2 rounded-lg ${getDerivedRatingColor(derivedEnvironmentalRating)}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Environmental Risk Rating (Auto-Derived)</p>
                <p className="text-xs opacity-75 mt-1">
                  Derived from the highest-risk environmental peril
                </p>
              </div>
              <div className="text-2xl font-bold">{derivedEnvironmentalRating}</div>
            </div>
          </div>
        </div>

        {/* Human / Malicious Exposure Section */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
          <div className="flex items-start gap-3 mb-4">
            <Shield className="w-6 h-6 text-slate-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Human / Malicious Exposure
              </h3>
              <p className="text-sm text-slate-600 mb-3">{HUMAN_EXPOSURE_GUIDANCE}</p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-3">Exposure Rating (1-5):</label>
            <RatingButtons
              value={humanExposureRating}
              onChange={(v) => handleExposureRatingChange('exposures_human_malicious', v, setHumanExposureRating, 'humanExposureRating')}
              labels={RATING_LABELS}
              size="sm"
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">Assessment Notes</p>
            <p className="text-xs text-slate-500">
              Consider: arson exposure, theft/vandalism, public access, isolation/visibility, adjacent activity
            </p>
            <textarea
              value={humanExposureNotes}
              onChange={(e) => setHumanExposureNotes(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              placeholder="Document location-based exposure factors: arson risk, theft/vandalism potential, public accessibility, site visibility, neighboring activities, any relevant contextual controls..."
            />
          </div>
        </div>

        {/* Overall Exposure Rating */}
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-lg border-2 border-slate-300 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">
                Overall Exposure Rating
              </h3>
              <p className="text-sm text-slate-600">
                Auto-derived from worst of Environmental Risk and Human Exposure
              </p>
              <p className="text-xs text-slate-500 mt-2">
                This rating feeds into the Risk Ratings Summary as a global pillar
              </p>
            </div>
            <div className={`px-6 py-4 rounded-lg border-2 ${getDerivedRatingColor(overallExposureRating)}`}>
              <div className="text-3xl font-bold text-center">{overallExposureRating}</div>
              <div className="text-xs text-center mt-1 opacity-75">
                {RATING_LABELS[overallExposureRating]}
              </div>
            </div>
          </div>
        </div>

        {document?.id && moduleInstance?.id && (
          <ModuleActions documentId={document.id} moduleInstanceId={moduleInstance.id} />
        )}
      </div>

      <FloatingSaveBar onSave={handleSave} isSaving={isSaving} />
    </>
  );
}
