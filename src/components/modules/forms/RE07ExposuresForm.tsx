import { useEffect, useMemo, useState } from 'react';
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

const PERIL_RATING_GUIDANCE = `Rate the residual risk to the site from this peril after considering hazard severity and mitigation. Permanent, engineered measures should carry the greatest weight. Well-developed emergency plans and response arrangements may be reflected where appropriate, but will not usually offset severe inherent hazard on their own.`;

const HUMAN_EXPOSURE_GUIDANCE = `Assess the site's exposure to deliberate or opportunistic loss based on location, access, visibility, and surrounding activity. This is not an audit of security systems; controls may be noted as context only.`;

const RATING_LABELS: Record<number, string> = {
  1: 'Poor / Inadequate',
  2: 'Below Average',
  3: 'Average / Acceptable',
  4: 'Good',
  5: 'Excellent',
};

function slugifyKey(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default function RE07ExposuresForm({ moduleInstance, document, onSaved }: RE07ExposuresFormProps) {
  const [isSaving, setIsSaving] = useState(false);

  // Local draft state (single source of truth for UI)
  const [floodRating, setFloodRating] = useState<number>(3);
  const [floodNotes, setFloodNotes] = useState<string>('');

  const [windRating, setWindRating] = useState<number>(3);
  const [windNotes, setWindNotes] = useState<string>('');

  const [earthquakeRating, setEarthquakeRating] = useState<number>(3);
  const [earthquakeNotes, setEarthquakeNotes] = useState<string>('');

  const [wildfireRating, setWildfireRating] = useState<number>(3);
  const [wildfireNotes, setWildfireNotes] = useState<string>('');

  const [hasOtherPeril, setHasOtherPeril] = useState<boolean>(false);
  const [otherLabel, setOtherLabel] = useState<string>('');
  const [otherRating, setOtherRating] = useState<number>(3);
  const [otherNotes, setOtherNotes] = useState<string>('');

  const [humanExposureRating, setHumanExposureRating] = useState<number>(3);
  const [humanExposureNotes, setHumanExposureNotes] = useState<string>('');

  // Seed once per module instance (prevents reversion/flicker)
  useEffect(() => {
    const ex = moduleInstance.data?.exposures ?? {};
    const p = ex.environmental?.perils ?? {};

    setFloodRating(p.flood?.rating ?? 3);
    setFloodNotes(p.flood?.notes ?? '');

    setWindRating(p.wind?.rating ?? 3);
    setWindNotes(p.wind?.notes ?? '');

    setEarthquakeRating(p.earthquake?.rating ?? 3);
    setEarthquakeNotes(p.earthquake?.notes ?? '');

    setWildfireRating(p.wildfire?.rating ?? 3);
    setWildfireNotes(p.wildfire?.notes ?? '');

    setHasOtherPeril(!!p.other);
    setOtherLabel(p.other?.label ?? '');
    setOtherRating(p.other?.rating ?? 3);
    setOtherNotes(p.other?.notes ?? '');

    setHumanExposureRating(ex.human_exposure?.rating ?? 3);
    setHumanExposureNotes(ex.human_exposure?.notes ?? '');
  }, [moduleInstance.id]);

  const otherLabelTrim = useMemo(() => otherLabel.trim(), [otherLabel]);
  const includeOther = hasOtherPeril && otherLabelTrim.length > 0;

  // Derived ratings (computed, not stored)
  const derivedEnvironmentalRating = useMemo(() => {
    const perilRatings: number[] = [floodRating, windRating, earthquakeRating, wildfireRating];
    if (includeOther) perilRatings.push(otherRating);
    return Math.min(...perilRatings);
  }, [floodRating, windRating, earthquakeRating, wildfireRating, includeOther, otherRating]);

  const overallExposureRating = useMemo(() => {
    return Math.min(derivedEnvironmentalRating, humanExposureRating);
  }, [derivedEnvironmentalRating, humanExposureRating]);

  const getDerivedRatingColor = (rating: number): string => {
    if (rating >= 4) return 'text-green-700 bg-green-50 border-green-300';
    if (rating === 3) return 'text-amber-700 bg-amber-50 border-amber-300';
    if (rating === 2) return 'text-orange-700 bg-orange-50 border-orange-300';
    return 'text-red-700 bg-red-50 border-red-300';
  };

  const syncExposureAutosToRegister = async () => {
    const documentId = moduleInstance.document_id;

    const items: Array<{ canonicalKey: string; rating: number }> = [
      { canonicalKey: 'exposures_flood', rating: floodRating },
      { canonicalKey: 'exposures_wind_storm', rating: windRating },
      { canonicalKey: 'exposures_earthquake', rating: earthquakeRating },
      { canonicalKey: 'exposures_wildfire', rating: wildfireRating },
      ...(includeOther
        ? [
            {
              canonicalKey: `exposures_other_${slugifyKey(otherLabelTrim)}`,
              rating: otherRating,
            },
          ]
        : []),
      { canonicalKey: 'exposures_human_malicious', rating: humanExposureRating },
    ];

    // Rating 1 & 2 only
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
            ...(includeOther
              ? {
                  other: { label: otherLabelTrim, rating: otherRating, notes: otherNotes },
                }
              : {}),
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
        data: { ...moduleInstance.data, exposures: exposuresData },
      });

      const { error } = await supabase
        .from('module_instances')
        .update({
          data: sanitized.data,
          completed_at: new Date().toISOString(),
        })
        .eq('id', moduleInstance.id);

      if (error) throw error;

      onSaved();

      // Non-blocking: section grade update + auto-recs (rating 1/2 only)
      Promise.allSettled([
        updateSectionGrade(document.id, 'exposure', overallExposureRating),
        syncExposureAutosToRegister(),
      ]).catch((e) => {
        console.error('[RE07Exposures] post-save tasks failed:', e);
      });
    } catch (err) {
      console.error('[RE07Exposures] Error saving module:', err);
      alert('Failed to save module. Please try again.');
    } finally {
      setIsSaving(false);
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

      <RatingButtons value={rating} onChange={onRatingChange} labels={RATING_LABELS} size="sm" />

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
          <p className="text-slate-600">Environmental and human exposure assessment (COPE-aligned, Global Pillar)</p>
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
              setFloodRating,
              setFloodNotes
            )}

            {renderPerilRow(
              <Wind className="w-5 h-5 text-cyan-600" />,
              'Wind / Storm',
              windRating,
              windNotes,
              setWindRating,
              setWindNotes
            )}

            {renderPerilRow(
              <Mountain className="w-5 h-5 text-amber-600" />,
              'Earthquake',
              earthquakeRating,
              earthquakeNotes,
              setEarthquakeRating,
              setEarthquakeNotes
            )}

            {renderPerilRow(
              <Flame className="w-5 h-5 text-orange-600" />,
              'Wildfire',
              wildfireRating,
              wildfireNotes,
              setWildfireRating,
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
                    onClick={() => {
                      setHasOtherPeril(false);
                      setOtherLabel('');
                      setOtherNotes('');
                      setOtherRating(3);
                    }}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>

                <RatingButtons value={otherRating} onChange={setOtherRating} labels={RATING_LABELS} size="sm" />

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
                <p className="text-xs opacity-75 mt-1">Derived from the highest-risk environmental peril</p>
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
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Human / Malicious Exposure</h3>
              <p className="text-sm text-slate-600 mb-3">{HUMAN_EXPOSURE_GUIDANCE}</p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-3">Exposure Rating (1-5):</label>
            <RatingButtons
              value={humanExposureRating}
              onChange={setHumanExposureRating}
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
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Overall Exposure Rating</h3>
              <p className="text-sm text-slate-600">Auto-derived from worst of Environmental Risk and Human Exposure</p>
              <p className="text-xs text-slate-500 mt-2">This rating feeds into the Risk Ratings Summary as a global pillar</p>
            </div>
            <div className={`px-6 py-4 rounded-lg border-2 ${getDerivedRatingColor(overallExposureRating)}`}>
              <div className="text-3xl font-bold text-center">{overallExposureRating}</div>
              <div className="text-xs text-center mt-1 opacity-75">{RATING_LABELS[overallExposureRating]}</div>
            </div>
          </div>
        </div>

        {document?.id && moduleInstance?.id && <ModuleActions documentId={document.id} moduleInstanceId={moduleInstance.id} />}
      </div>

      <FloatingSaveBar onSave={handleSave} isSaving={isSaving} />
    </>
  );
}
