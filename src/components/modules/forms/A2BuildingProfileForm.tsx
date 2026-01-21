import { useState } from 'react';
import { Building2, CheckCircle, Plus } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';
import AddActionModal from '../../actions/AddActionModal';

interface Document {
  id: string;
  title: string;
}

interface ModuleInstance {
  id: string;
  outcome: string | null;
  assessor_notes: string;
  data: Record<string, any>;
}

interface A2BuildingProfileFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface QuickActionTemplate {
  action: string;
  likelihood: number;
  impact: number;
}

export default function A2BuildingProfileForm({
  moduleInstance,
  document,
  onSaved,
}: A2BuildingProfileFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [quickActionTemplate, setQuickActionTemplate] = useState<QuickActionTemplate | null>(null);

  const [formData, setFormData] = useState({
    building_name: moduleInstance.data.building_name || '',
    year_built: moduleInstance.data.year_built || '',
    height_m: moduleInstance.data.height_m || '',
    number_of_storeys: moduleInstance.data.number_of_storeys || '',
    floor_area_sqm: moduleInstance.data.floor_area_sqm || '',
    building_use_primary: moduleInstance.data.building_use_primary || 'unknown',
    secondary_uses: moduleInstance.data.secondary_uses || [],
    secondary_uses_other: moduleInstance.data.secondary_uses_other || '',
    construction_frame: moduleInstance.data.construction_frame || 'unknown',
    roof_construction_summary: moduleInstance.data.roof_construction_summary || '',
    wall_construction_summary: moduleInstance.data.wall_construction_summary || '',
    special_constraints: moduleInstance.data.special_constraints || [],
    special_constraints_other: moduleInstance.data.special_constraints_other || '',
    notes: moduleInstance.data.notes || '',
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const getSuggestedOutcome = (): { outcome: string; reason: string } | null => {
    const unknowns = [
      formData.height_m === '' || formData.height_m === 'unknown',
      formData.number_of_storeys === '' || formData.number_of_storeys === 'unknown',
      formData.year_built === '' || formData.year_built === 'unknown',
      formData.construction_frame === 'unknown',
      formData.building_use_primary === 'unknown',
    ].filter(Boolean).length;

    if (unknowns >= 4) {
      return {
        outcome: 'info_gap',
        reason: `${unknowns} key fields unknown - significant information gaps for strategy basis`,
      };
    }

    const hasComplexConstraints = formData.special_constraints.includes('high-rise') ||
      formData.special_constraints.includes('shared occupancy') ||
      formData.special_constraints.includes('complex evacuation');

    if (hasComplexConstraints && (!formData.special_constraints_other || formData.special_constraints_other.trim().length < 20)) {
      return {
        outcome: 'minor_def',
        reason: 'Complex constraints identified but details incomplete',
      };
    }

    if (unknowns >= 2) {
      return {
        outcome: 'minor_def',
        reason: 'Some key building information gaps requiring clarification',
      };
    }

    return {
      outcome: 'compliant',
      reason: 'Building profile sufficiently documented',
    };
  };

const suggestedOutcome = !String(outcome ?? '').trim() ? getSuggestedOutcome() : null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: any = {
      data: formData,
      assessor_notes: assessorNotes,
      updated_at: new Date().toISOString(),
    };
    
    // Only include outcome if it's a non-empty string
    const cleanOutcome = String(outcome ?? '').trim();
    if (cleanOutcome !== '') {
      payload.outcome = cleanOutcome;
    }
    
    const { error } = await supabase
      .from('module_instances')
      .update(payload)
      .eq('id', moduleInstance.id);

      if (error) throw error;

      const now = new Date().toLocaleTimeString();
      setLastSaved(now);
      onSaved();
    } catch (error) {
      console.error('Error saving A2 module:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickAction = (template: QuickActionTemplate) => {
    setQuickActionTemplate(template);
    setShowActionModal(true);
  };

  const handleSecondaryUseToggle = (use: string) => {
    const updated = formData.secondary_uses.includes(use)
      ? formData.secondary_uses.filter((u: string) => u !== use)
      : [...formData.secondary_uses, use];
    setFormData({ ...formData, secondary_uses: updated });
  };

  const handleConstraintToggle = (constraint: string) => {
    const updated = formData.special_constraints.includes(constraint)
      ? formData.special_constraints.filter((c: string) => c !== constraint)
      : [...formData.special_constraints, constraint];
    setFormData({ ...formData, special_constraints: updated });
  };

  const heightUnknown = formData.height_m === '' || formData.height_m === 'unknown';
  const storeysUnknown = formData.number_of_storeys === '' || formData.number_of_storeys === 'unknown';
  const constructionUnknown = formData.construction_frame === 'unknown';
  const useComplex = formData.building_use_primary === 'mixed' || formData.secondary_uses.length > 2;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="w-6 h-6 text-neutral-700" />
          <h2 className="text-2xl font-bold text-neutral-900">
            A2 - Building Profile
          </h2>
        </div>
        <p className="text-neutral-600">
          Document building characteristics, construction, use, and special constraints
        </p>
        {lastSaved && (
          <div className="flex items-center gap-2 mt-2 text-sm text-green-700">
            <CheckCircle className="w-4 h-4" />
            Last saved at {lastSaved}
          </div>
        )}
      </div>

      {suggestedOutcome && !outcome && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h3 className="text-sm font-bold text-amber-900 mb-1">Suggested Outcome</h3>
          <p className="text-sm text-amber-800">
            Based on your responses: <strong>{suggestedOutcome.outcome.replace('_', ' ')}</strong>
          </p>
          <p className="text-xs text-amber-700 mt-1">{suggestedOutcome.reason}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Basic Building Info */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Basic Building Information
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Building Name / Address
              </label>
              <input
                type="text"
                value={formData.building_name}
                onChange={(e) => setFormData({ ...formData, building_name: e.target.value })}
                placeholder="Enter building name or address"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Year Built
                </label>
                <input
                  type="text"
                  value={formData.year_built}
                  onChange={(e) => setFormData({ ...formData, year_built: e.target.value })}
                  placeholder="e.g., 1985 or unknown"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Height (m)
                </label>
                <input
                  type="text"
                  value={formData.height_m}
                  onChange={(e) => setFormData({ ...formData, height_m: e.target.value })}
                  placeholder="e.g., 18 or unknown"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Number of Storeys
                </label>
                <input
                  type="text"
                  value={formData.number_of_storeys}
                  onChange={(e) => setFormData({ ...formData, number_of_storeys: e.target.value })}
                  placeholder="e.g., 6 or unknown"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Total Floor Area (m²)
              </label>
              <input
                type="text"
                value={formData.floor_area_sqm}
                onChange={(e) => setFormData({ ...formData, floor_area_sqm: e.target.value })}
                placeholder="e.g., 5000"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            </div>

            {(heightUnknown || storeysUnknown) && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Confirm building height and storey count for strategy assumptions and compliance checks.',
                    likelihood: 3,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Confirm height/storey count
              </button>
            )}
          </div>
        </div>

        {/* Building Use */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Building Use
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Primary Use
              </label>
              <select
                value={formData.building_use_primary}
                onChange={(e) => setFormData({ ...formData, building_use_primary: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="office">Office</option>
                <option value="industrial">Industrial / Warehouse</option>
                <option value="retail">Retail / Shop</option>
                <option value="residential">Residential</option>
                <option value="healthcare">Healthcare</option>
                <option value="education">Education</option>
                <option value="mixed">Mixed Use</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Secondary Uses (if applicable)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {['Ancillary office', 'Storage', 'Plant rooms', 'Car parking', 'Retail units', 'Other'].map((use) => (
                  <label key={use} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.secondary_uses.includes(use)}
                      onChange={() => handleSecondaryUseToggle(use)}
                      className="w-4 h-4 text-neutral-900 border-neutral-300 rounded focus:ring-neutral-900"
                    />
                    <span>{use}</span>
                  </label>
                ))}
              </div>
              {formData.secondary_uses.includes('Other') && (
                <input
                  type="text"
                  value={formData.secondary_uses_other}
                  onChange={(e) => setFormData({ ...formData, secondary_uses_other: e.target.value })}
                  placeholder="Specify other secondary uses"
                  className="mt-2 w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                />
              )}
            </div>
          </div>
        </div>

        {/* Construction */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Construction Details
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Primary Structural Frame
              </label>
              <select
                value={formData.construction_frame}
                onChange={(e) => setFormData({ ...formData, construction_frame: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="unknown">Unknown</option>
                <option value="steel">Steel Frame</option>
                <option value="concrete">Reinforced Concrete</option>
                <option value="timber">Timber Frame</option>
                <option value="masonry">Load-bearing Masonry</option>
                <option value="mixed">Mixed Construction</option>
              </select>
            </div>

            {constructionUnknown && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Confirm primary structural frame type and fire resistance assumptions.',
                    likelihood: 3,
                    impact: 4,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Confirm structural frame type
              </button>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Roof Construction Summary
              </label>
              <textarea
                value={formData.roof_construction_summary}
                onChange={(e) => setFormData({ ...formData, roof_construction_summary: e.target.value })}
                placeholder="Describe roof construction (e.g., flat concrete roof, pitched timber roof with tiles, etc.)"
                rows={2}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                External Wall Construction Summary
              </label>
              <textarea
                value={formData.wall_construction_summary}
                onChange={(e) => setFormData({ ...formData, wall_construction_summary: e.target.value })}
                placeholder="Describe external wall construction (e.g., brick cavity wall, curtain walling, cladding system, etc.)"
                rows={2}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
            </div>
          </div>
        </div>

        {/* Special Constraints */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Special Constraints
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Select all that apply
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {['Listed building', 'Heritage building', 'Shared occupancy', 'High-rise (≥18m)', 'Complex evacuation', 'Other'].map((constraint) => (
                  <label key={constraint} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.special_constraints.includes(constraint)}
                      onChange={() => handleConstraintToggle(constraint)}
                      className="w-4 h-4 text-neutral-900 border-neutral-300 rounded focus:ring-neutral-900"
                    />
                    <span>{constraint}</span>
                  </label>
                ))}
              </div>
            </div>

            {formData.special_constraints.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Constraint Details
                </label>
                <textarea
                  value={formData.special_constraints_other}
                  onChange={(e) => setFormData({ ...formData, special_constraints_other: e.target.value })}
                  placeholder="Provide details about the special constraints (e.g., shared means of escape with adjacent building, listed status restricts alterations, etc.)"
                  rows={3}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                />
              </div>
            )}

            {useComplex && formData.special_constraints.length === 0 && (
              <button
                onClick={() =>
                  handleQuickAction({
                    action: 'Clarify occupancy/use constraints (mixed use, shared means of escape, heritage/listed) and update strategy basis.',
                    likelihood: 3,
                    impact: 3,
                  })
                }
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Quick Add: Clarify use/occupancy constraints
              </button>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Additional Notes
          </h3>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Add any additional observations about the building profile, construction, or constraints that may affect fire strategy..."
            rows={4}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
          />
        </div>
      </div>

      <OutcomePanel
        outcome={outcome}
        assessorNotes={assessorNotes}
        onOutcomeChange={setOutcome}
        onNotesChange={setAssessorNotes}
        onSave={handleSave}
        isSaving={isSaving}
      />

      <ModuleActions
        documentId={document.id}
        moduleInstanceId={moduleInstance.id}
      />

      {showActionModal && (
        <AddActionModal
          documentId={document.id}
          moduleInstanceId={moduleInstance.id}
          onClose={() => {
            setShowActionModal(false);
            setQuickActionTemplate(null);
          }}
          onActionCreated={() => {
            setShowActionModal(false);
            setQuickActionTemplate(null);
          }}
          defaultAction={quickActionTemplate?.action}
          defaultLikelihood={quickActionTemplate?.likelihood}
          defaultImpact={quickActionTemplate?.impact}
        />
      )}
    </div>
  );
}
