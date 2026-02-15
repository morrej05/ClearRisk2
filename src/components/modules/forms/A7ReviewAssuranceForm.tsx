import { useState } from 'react';
import { ClipboardCheck, CheckCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import OutcomePanel from '../OutcomePanel';
import ModuleActions from '../ModuleActions';

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

interface A7ReviewAssuranceFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

type ChecklistValue = 'yes' | 'no' | 'na';

export default function A7ReviewAssuranceForm({
  moduleInstance,
  document,
  onSaved,
}: A7ReviewAssuranceFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    review: {
      peerReview: (moduleInstance.data.review?.peerReview || 'na') as ChecklistValue,
      siteInspection: (moduleInstance.data.review?.siteInspection || 'na') as ChecklistValue,
      photos: (moduleInstance.data.review?.photos || 'na') as ChecklistValue,
      alarmEvidence: (moduleInstance.data.review?.alarmEvidence || 'na') as ChecklistValue,
      elEvidence: (moduleInstance.data.review?.elEvidence || 'na') as ChecklistValue,
      drillEvidence: (moduleInstance.data.review?.drillEvidence || 'na') as ChecklistValue,
      maintenanceLogs: (moduleInstance.data.review?.maintenanceLogs || 'na') as ChecklistValue,
      rpInterview: (moduleInstance.data.review?.rpInterview || 'na') as ChecklistValue,
    },
    assumptionsLimitations: moduleInstance.data.assumptionsLimitations || '',
    commentary: moduleInstance.data.commentary || '',
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  const updateChecklistItem = (field: keyof typeof formData.review, value: ChecklistValue) => {
    setFormData({
      ...formData,
      review: {
        ...formData.review,
        [field]: value,
      },
    });
  };

  const getSuggestedOutcome = (): { outcome: string; reason: string } | null => {
    const reviewItems = Object.values(formData.review);
    const yesCount = reviewItems.filter((v) => v === 'yes').length;
    const noCount = reviewItems.filter((v) => v === 'no').length;

    if (noCount >= 4) {
      return {
        outcome: 'material_def',
        reason: 'Multiple review/assurance activities not completed',
      };
    }

    if (noCount >= 2) {
      return {
        outcome: 'minor_def',
        reason: 'Some review/assurance activities incomplete',
      };
    }

    if (yesCount >= 6) {
      return {
        outcome: 'compliant',
        reason: 'Comprehensive review and assurance activities completed',
      };
    }

    return {
      outcome: 'info_gap',
      reason: 'Review and assurance status unclear',
    };
  };

  const suggestedOutcome = !String(outcome ?? '').trim() ? getSuggestedOutcome() : null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = sanitizeModuleInstancePayload({
        data: formData,
        outcome,
        assessor_notes: assessorNotes,
        updated_at: new Date().toISOString(),
      });

      const { error } = await supabase
        .from('module_instances')
        .update(payload)
        .eq('id', moduleInstance.id);

      if (error) throw error;

      const now = new Date().toLocaleTimeString();
      setLastSaved(now);
      onSaved();
    } catch (error) {
      console.error('Error saving A7 module:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderChecklistItem = (
    label: string,
    field: keyof typeof formData.review
  ) => {
    const value = formData.review[field];

    return (
      <div className="flex items-center justify-between py-3 border-b border-neutral-100 last:border-0">
        <label className="text-sm text-neutral-700 flex-1">{label}</label>
        <div className="flex items-center gap-2">
          {(['yes', 'no', 'na'] as ChecklistValue[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => updateChecklistItem(field, option)}
              className={`px-3 py-1 text-xs font-medium rounded border transition-colors ${
                value === option
                  ? option === 'yes'
                    ? 'bg-green-100 border-green-300 text-green-800'
                    : option === 'no'
                    ? 'bg-red-100 border-red-300 text-red-800'
                    : 'bg-neutral-100 border-neutral-300 text-neutral-800'
                  : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {option === 'yes' ? 'Yes' : option === 'no' ? 'No' : 'N/A'}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <ClipboardCheck className="w-6 h-6 text-neutral-700" />
          <h2 className="text-2xl font-bold text-neutral-900">
            A7 - Review &amp; Assurance
          </h2>
        </div>
        <p className="text-neutral-600">
          Document review and assurance activities conducted during the assessment
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
        {/* Review & Assurance Checklist */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Review &amp; Assurance Checklist
          </h3>
          <div className="space-y-0">
            {renderChecklistItem('Peer review completed?', 'peerReview')}
            {renderChecklistItem('Site inspection completed?', 'siteInspection')}
            {renderChecklistItem('Photos taken?', 'photos')}
            {renderChecklistItem('Fire alarm test evidence reviewed?', 'alarmEvidence')}
            {renderChecklistItem('Emergency lighting test evidence reviewed?', 'elEvidence')}
            {renderChecklistItem('Evacuation drill evidence reviewed?', 'drillEvidence')}
            {renderChecklistItem('Maintenance logs reviewed?', 'maintenanceLogs')}
            {renderChecklistItem('Responsible person interview completed?', 'rpInterview')}
          </div>
        </div>

        {/* Assumptions / Limitations */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Assumptions / Limitations
          </h3>
          <textarea
            value={formData.assumptionsLimitations}
            onChange={(e) =>
              setFormData({ ...formData, assumptionsLimitations: e.target.value })
            }
            placeholder="Document any assumptions made or limitations encountered during the review and assurance process..."
            rows={4}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
          />
        </div>

        {/* Assessor Commentary */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Assessor Commentary
          </h3>
          <p className="text-sm text-neutral-600 mb-3">
            This commentary will be included in the report
          </p>
          <textarea
            value={formData.commentary}
            onChange={(e) => setFormData({ ...formData, commentary: e.target.value })}
            placeholder="Provide commentary on the review and assurance activities, quality of evidence reviewed, any concerns or observations..."
            rows={6}
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

      {document?.id && moduleInstance?.id && (
        <ModuleActions
          documentId={document.id}
          moduleInstanceId={moduleInstance.id}
        />
      )}
    </div>
  );
}
