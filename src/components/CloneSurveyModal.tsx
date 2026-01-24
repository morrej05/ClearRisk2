import { useState } from 'react';
import { X, Copy, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface CloneSurveyModalProps {
  surveyId: string;
  surveyTitle: string;
  onClose: () => void;
}

export default function CloneSurveyModal({
  surveyId,
  surveyTitle,
  onClose,
}: CloneSurveyModalProps) {
  const navigate = useNavigate();
  const [copyAnswers, setCopyAnswers] = useState(true);
  const [copyActions, setCopyActions] = useState(false);
  const [isCloning, setIsCloning] = useState(false);

  const handleClone = async () => {
    setIsCloning(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/clone-survey`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_survey_id: surveyId,
          copy_answers: copyAnswers,
          copy_actions: copyActions,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to clone survey');
      }

      onClose();

      // Navigate to the new cloned survey
      navigate(`/report-preview/${result.new_survey_id}`);

      // Show success message
      setTimeout(() => {
        alert('Survey cloned successfully! You are now editing a new draft.');
      }, 100);

    } catch (err: any) {
      console.error('Error cloning survey:', err);
      alert(`Failed to clone survey: ${err.message}`);
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Copy className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Clone Survey</h2>
              <p className="text-sm text-slate-500 mt-0.5">Create a new draft from this survey</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-900">Source:</span> {surveyTitle}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">What would you like to copy?</p>

            <label className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={copyAnswers}
                onChange={(e) => setCopyAnswers(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900">Copy answers</div>
                <div className="text-xs text-slate-600 mt-0.5">
                  Include all module data and survey responses
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={copyActions}
                onChange={(e) => setCopyActions(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900">Copy open actions</div>
                <div className="text-xs text-slate-600 mt-0.5">
                  Include open recommendations and actions (will be reset to open status)
                </div>
              </div>
            </label>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">What will NOT be copied:</h3>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Approval status and history</li>
              <li>• Issued status and PDFs</li>
              <li>• Revision history</li>
              <li>• Audit log entries</li>
              <li>• Issue dates and metadata</li>
            </ul>
          </div>

          <p className="text-xs text-slate-500">
            The cloned survey will be created as a new Draft v1 that you can edit independently.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            disabled={isCloning}
            className="px-4 py-2 text-slate-700 hover:text-slate-900 font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleClone}
            disabled={isCloning}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isCloning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Cloning...</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Clone Survey</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
