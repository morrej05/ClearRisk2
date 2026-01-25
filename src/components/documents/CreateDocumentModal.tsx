import { useState } from 'react';
import { X, ArrowUpCircle, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { canAccessRiskEngineering } from '../../utils/entitlements';

interface CreateDocumentModalProps {
  onClose: () => void;
  onDocumentCreated?: () => void;
  allowedTypes?: string[];
}

const MODULE_SKELETONS = {
  FRA: [
    'A1_DOC_CONTROL',
    'A2_BUILDING_PROFILE',
    'A3_PERSONS_AT_RISK',
    'A4_MANAGEMENT_CONTROLS',
    'A5_EMERGENCY_ARRANGEMENTS',
    'A7_REVIEW_ASSURANCE',
    'FRA_1_HAZARDS',
    'FRA_2_ESCAPE_ASIS',
    'FRA_3_PROTECTION_ASIS',
    'FRA_5_EXTERNAL_FIRE_SPREAD',
    'FRA_4_SIGNIFICANT_FINDINGS',
  ],
  FSD: [
    'A1_DOC_CONTROL',
    'A2_BUILDING_PROFILE',
    'FSD_1_REG_BASIS',
    'FSD_2_EVAC_STRATEGY',
    'FSD_3_ESCAPE_DESIGN',
    'FSD_4_PASSIVE_PROTECTION',
    'FSD_5_ACTIVE_SYSTEMS',
    'FSD_6_FRS_ACCESS',
    'FSD_7_DRAWINGS',
    'FSD_8_SMOKE_CONTROL',
    'FSD_9_CONSTRUCTION_PHASE',
  ],
  DSEAR: [
    'A1_DOC_CONTROL',
    'A2_BUILDING_PROFILE',
    'DSEAR_1_SUBSTANCES_REGISTER',
    'DSEAR_2_PROCESS_RELEASES',
    'DSEAR_3_HAC_ZONING',
    'DSEAR_4_IGNITION_CONTROL',
    'DSEAR_5_MITIGATION',
    'DSEAR_6_RISK_TABLE',
    'DSEAR_10_HIERARCHY_SUBSTITUTION',
    'DSEAR_11_EXPLOSION_EMERGENCY_RESPONSE',
  ],
};

const STANDARDS_OPTIONS = [
  'BS 9999:2017',
  'BS 9991:2015',
  'Approved Document B',
  'BS 5588 (legacy)',
  'BS 7974 (fire engineering)',
  'PD 7974',
  'NFPA 101',
  'Other',
];

export default function CreateDocumentModal({ onClose, onDocumentCreated, allowedTypes }: CreateDocumentModalProps) {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canAccessEngineering = organisation ? canAccessRiskEngineering(organisation) : false;

  let availableTypes = allowedTypes || ['FRA', 'FSD', 'DSEAR'];

  if (!canAccessEngineering) {
    availableTypes = availableTypes.filter(t => t === 'FRA');
  }

  const [formData, setFormData] = useState({
    enabledModules: [availableTypes[0]] as string[],
    title: '',
    assessmentDate: new Date().toISOString().split('T')[0],
    assessorName: '',
    assessorRole: '',
    responsiblePerson: '',
    scopeDescription: '',
    limitationsAssumptions: '',
    standardsSelected: [] as string[],
    jurisdiction: 'UK',
  });

  const handleModuleToggle = (moduleType: string) => {
    setFormData((prev) => {
      const isCurrentlyEnabled = prev.enabledModules.includes(moduleType);

      if (isCurrentlyEnabled) {
        const newModules = prev.enabledModules.filter((m) => m !== moduleType);
        return {
          ...prev,
          enabledModules: newModules.length > 0 ? newModules : prev.enabledModules,
        };
      } else {
        return {
          ...prev,
          enabledModules: [...prev.enabledModules, moduleType],
        };
      }
    });
  };

  const handleStandardToggle = (standard: string) => {
    setFormData((prev) => ({
      ...prev,
      standardsSelected: prev.standardsSelected.includes(standard)
        ? prev.standardsSelected.filter((s) => s !== standard)
        : [...prev.standardsSelected, standard],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organisation?.id) {
      alert('Organisation not found. Please refresh and try again.');
      return;
    }

    if (!formData.title.trim()) {
      alert('Please enter a document title.');
      return;
    }

    if (formData.enabledModules.length === 0) {
      alert('Please select at least one assessment type.');
      return;
    }

    setIsSubmitting(true);

    try {
      const enabledModules = formData.enabledModules;
      const primaryDocumentType = enabledModules.includes('FRA') ? 'FRA' :
                                  enabledModules.includes('FSD') ? 'FSD' :
                                  enabledModules.includes('DSEAR') ? 'DSEAR' : 'FRA';

      const documentData = {
        organisation_id: organisation.id,
        document_type: primaryDocumentType,
        enabled_modules: enabledModules,
        title: formData.title.trim(),
        status: 'draft',
        version: 1,
        assessment_date: formData.assessmentDate,
        assessor_name: formData.assessorName.trim() || null,
        assessor_role: formData.assessorRole.trim() || null,
        responsible_person: formData.responsiblePerson.trim() || null,
        scope_description: formData.scopeDescription.trim() || null,
        limitations_assumptions: formData.limitationsAssumptions.trim() || null,
        standards_selected: formData.standardsSelected,
        jurisdiction: formData.jurisdiction,
      };

      const { data: document, error: docError } = await supabase
        .from('documents')
        .insert([documentData])
        .select()
        .single();

      if (docError) throw docError;

      const allModuleKeys = new Set<string>();
      enabledModules.forEach((moduleType) => {
        const skeleton = MODULE_SKELETONS[moduleType as keyof typeof MODULE_SKELETONS] || [];
        skeleton.forEach((key) => allModuleKeys.add(key));
      });

      const moduleInstances = Array.from(allModuleKeys).map((moduleKey) => ({
        organisation_id: organisation.id,
        document_id: document.id,
        module_key: moduleKey,
        module_scope: 'document',
        outcome: null,
        assessor_notes: '',
        data: {},
      }));

      const { error: modulesError } = await supabase
        .from('module_instances')
        .insert(moduleInstances);

      if (modulesError) throw modulesError;

      if (onDocumentCreated) {
        onDocumentCreated();
      }

      navigate(`/documents/${document.id}`);
    } catch (error) {
      console.error('Error creating document:', error);
      alert('Failed to create document. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-neutral-900">Create New Document</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-3">
              Assessment Type <span className="text-red-600">*</span>
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 px-4 py-3 border-2 border-neutral-200 rounded-lg hover:bg-neutral-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={formData.enabledModules.includes('FRA')}
                  onChange={() => handleModuleToggle('FRA')}
                  className="mt-0.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-neutral-900">Fire Risk Assessment (FRA)</span>
                  <p className="text-xs text-neutral-600 mt-0.5">Regulatory compliance assessment under RRO</p>
                </div>
              </label>

              <label className={`flex items-start gap-3 px-4 py-3 border-2 rounded-lg transition-colors ${
                canAccessEngineering
                  ? 'border-neutral-200 hover:bg-neutral-50 cursor-pointer'
                  : 'border-neutral-100 bg-neutral-50 cursor-not-allowed opacity-60'
              }`}>
                <input
                  type="checkbox"
                  checked={formData.enabledModules.includes('FSD')}
                  onChange={() => handleModuleToggle('FSD')}
                  disabled={!canAccessEngineering}
                  className="mt-0.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500 disabled:opacity-50"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-neutral-900">Fire Strategy Document (FSD)</span>
                    {!canAccessEngineering && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">
                        <Lock className="w-3 h-3" />
                        Pro
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-600 mt-0.5">Design-stage fire engineering documentation</p>
                </div>
              </label>

              <label className={`flex items-start gap-3 px-4 py-3 border-2 rounded-lg transition-colors ${
                canAccessEngineering
                  ? 'border-neutral-200 hover:bg-neutral-50 cursor-pointer'
                  : 'border-neutral-100 bg-neutral-50 cursor-not-allowed opacity-60'
              }`}>
                <input
                  type="checkbox"
                  checked={formData.enabledModules.includes('DSEAR')}
                  onChange={() => handleModuleToggle('DSEAR')}
                  disabled={!canAccessEngineering}
                  className="mt-0.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500 disabled:opacity-50"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-neutral-900">Explosive Atmospheres (DSEAR)</span>
                    {!canAccessEngineering && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">
                        <Lock className="w-3 h-3" />
                        Pro
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-600 mt-0.5">Dangerous substances and explosive atmospheres assessment</p>
                </div>
              </label>
            </div>

            {!canAccessEngineering && (formData.enabledModules.includes('FSD') || formData.enabledModules.includes('DSEAR')) && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <Lock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-amber-900 mb-1">Fire Risk Engineering Features</p>
                  <p className="text-xs text-amber-700">
                    Fire Strategy Documents and Explosive Atmospheres Assessments are available on the Professional plan.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate('/upgrade');
                    }}
                    className="mt-2 px-3 py-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs rounded font-medium hover:from-blue-700 hover:to-purple-700 transition-colors inline-flex items-center gap-1"
                  >
                    <ArrowUpCircle className="w-3 h-3" />
                    Upgrade Now
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Title <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Acme Factory - Main Building FRA 2024"
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Assessment Date <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                value={formData.assessmentDate}
                onChange={(e) => setFormData({ ...formData, assessmentDate: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Jurisdiction <span className="text-red-600">*</span>
              </label>
              <select
                value={formData.jurisdiction}
                onChange={(e) => setFormData({ ...formData, jurisdiction: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white"
                required
              >
                <option value="UK">United Kingdom</option>
                <option value="IE">Ireland</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Assessor Name
              </label>
              <input
                type="text"
                value={formData.assessorName}
                onChange={(e) => setFormData({ ...formData, assessorName: e.target.value })}
                placeholder="John Smith"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Assessor Role
              </label>
              <input
                type="text"
                value={formData.assessorRole}
                onChange={(e) => setFormData({ ...formData, assessorRole: e.target.value })}
                placeholder="Fire Safety Consultant"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Responsible Person
            </label>
            <input
              type="text"
              value={formData.responsiblePerson}
              onChange={(e) => setFormData({ ...formData, responsiblePerson: e.target.value })}
              placeholder="Site Manager / Duty Holder"
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Standards & References
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STANDARDS_OPTIONS.map((standard) => (
                <label
                  key={standard}
                  className="flex items-center gap-2 px-3 py-2 border border-neutral-200 rounded-lg hover:bg-neutral-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formData.standardsSelected.includes(standard)}
                    onChange={() => handleStandardToggle(standard)}
                    className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
                  />
                  <span className="text-sm text-neutral-700">{standard}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Scope Description
            </label>
            <textarea
              value={formData.scopeDescription}
              onChange={(e) => setFormData({ ...formData, scopeDescription: e.target.value })}
              placeholder="Brief description of what this assessment covers..."
              rows={3}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Limitations & Assumptions
            </label>
            <textarea
              value={formData.limitationsAssumptions}
              onChange={(e) => setFormData({ ...formData, limitationsAssumptions: e.target.value })}
              placeholder="Any limitations or assumptions for this assessment..."
              rows={3}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex items-center gap-3 justify-end pt-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.title.trim()}
              className={`px-5 py-2.5 rounded-lg font-medium transition-colors ${
                isSubmitting || !formData.title.trim()
                  ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                  : 'bg-neutral-900 text-white hover:bg-neutral-800'
              }`}
            >
              {isSubmitting ? 'Creating...' : 'Create Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
