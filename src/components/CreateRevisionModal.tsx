import { useState } from 'react';
import { X, AlertCircle, Loader, GitBranch } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CreateRevisionModalProps {
  surveyId: string;
  surveyTitle: string;
  currentRevision: number;
  onClose: () => void;
  onSuccess: (newRevision: number) => void;
}

export default function CreateRevisionModal({
  surveyId,
  surveyTitle,
  currentRevision,
  onClose,
  onSuccess,
}: CreateRevisionModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextRevision = currentRevision + 1;

  const handleCreateRevision = async () => {
    setIsCreating(true);
    setError(null);

    try {
      // 1. Fetch current survey data
      const { data: survey, error: surveyError } = await supabase
        .from('survey_reports')
        .select('*')
        .eq('id', surveyId)
        .single();

      if (surveyError || !survey) {
        throw new Error('Failed to fetch survey data');
      }

      // 2. Fetch current sections
      const { data: sections, error: sectionsError } = await supabase
        .from('survey_sections')
        .select('*')
        .eq('survey_id', surveyId);

      if (sectionsError) {
        throw new Error('Failed to fetch sections');
      }

      // 3. Fetch open actions to carry forward
      const { data: actions, error: actionsError } = await supabase
        .from('recommendations')
        .select('*')
        .eq('survey_id', surveyId)
        .in('status', ['open', 'Not Started', 'In Progress', 'Under Review']);

      if (actionsError) {
        throw new Error('Failed to fetch actions');
      }

      // 4. Update survey to draft status with new revision number
      const { error: updateError } = await supabase
        .from('survey_reports')
        .update({
          issued: false,
          current_revision: nextRevision,
          issued_confirmed: false,
          change_log: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', surveyId);

      if (updateError) {
        throw new Error('Failed to create new revision');
      }

      // 5. Reset section completion (sections remain but need re-validation)
      if (sections && sections.length > 0) {
        const { error: sectionsUpdateError } = await supabase
          .from('survey_sections')
          .update({
            section_complete: false,
            completed_at: null,
          })
          .eq('survey_id', surveyId);

        if (sectionsUpdateError) {
          console.warn('Warning: Failed to reset section completion', sectionsUpdateError);
        }
      }

      // 6. Update carried-forward actions with new revision number
      if (actions && actions.length > 0) {
        const { error: actionsUpdateError } = await supabase
          .from('recommendations')
          .update({ revision_number: nextRevision })
          .eq('survey_id', surveyId)
          .in('status', ['open', 'Not Started', 'In Progress', 'Under Review']);

        if (actionsUpdateError) {
          console.warn('Warning: Failed to update action revision numbers', actionsUpdateError);
        }
      }

      // Success!
      onSuccess(nextRevision);
    } catch (err: any) {
      console.error('Error creating revision:', err);
      setError(err.message || 'Failed to create new revision');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitBranch className="w-5 h-5 text-primary-600" />
            <h2 className="text-xl font-bold text-neutral-900">Create New Revision</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isCreating}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm text-neutral-600">Survey</p>
            <p className="font-semibold text-neutral-900">{surveyTitle}</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <GitBranch className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900">
                  Revision {currentRevision} → Revision {nextRevision}
                </h3>
                <p className="text-sm text-blue-800 mt-2">
                  This will create a new draft revision (v{nextRevision}) based on the current issued version.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
            <h4 className="font-medium text-neutral-900 mb-2">What happens when you create a revision:</h4>
            <ul className="space-y-2 text-sm text-neutral-700">
              <li className="flex items-start gap-2">
                <span className="text-primary-600 font-bold">•</span>
                <span>Current data and answers will be preserved</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-600 font-bold">•</span>
                <span>Survey status will change to Draft (editable)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-600 font-bold">•</span>
                <span>Open actions will be carried forward to the new revision</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-600 font-bold">•</span>
                <span>Sections will need to be re-validated before issuing</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-600 font-bold">•</span>
                <span>Previous issued version (v{currentRevision}) remains accessible in revision history</span>
              </li>
            </ul>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-900">Error</h3>
                  <p className="text-sm text-red-800 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateRevision}
            disabled={isCreating}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isCreating ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <GitBranch className="w-4 h-4" />
                Create Revision
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
