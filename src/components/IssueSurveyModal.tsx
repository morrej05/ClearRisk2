import { useState } from 'react';
import { X, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Blocker } from '../utils/issueValidation';
import { groupBlockersByModule } from '../utils/issueValidation';

interface IssueSurveyModalProps {
  surveyId: string;
  surveyTitle: string;
  blockers: Blocker[];
  isConfirmed: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function IssueSurveyModal({
  surveyId,
  surveyTitle,
  blockers,
  isConfirmed,
  onClose,
  onSuccess,
}: IssueSurveyModalProps) {
  const [changeLog, setChangeLog] = useState('');
  const [confirmChecked, setConfirmChecked] = useState(isConfirmed);
  const [isIssuing, setIsIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canIssue = blockers.length === 0 && confirmChecked;
  const groupedBlockers = groupBlockersByModule(blockers);

const handleIssue = async () => {
  if (!canIssue) return;

  setIsIssuing(true);
  setError(null);

  try {
    // Update confirmed flag
    if (!isConfirmed) {
      const { error: updateError } = await supabase
        .from("survey_reports")
        .update({ issued_confirmed: true })
        .eq("id", surveyId);

      if (updateError) throw updateError;
    }

    // Session
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const session = data?.session;
    if (!session) throw new Error("No active session");

    // Call edge function
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const resp = await fetch(`${supabaseUrl}/functions/v1/issue-survey`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        survey_id: surveyId,
        change_log: changeLog || "Initial issue",
      }),
    });

    // Robust body handling (prevents json() hangs / throws leaving spinner on)
    const raw = await resp.text();
    let result: any = null;
    try {
      result = raw ? JSON.parse(raw) : null;
    } catch {
      // non-json response (e.g. html error page)
      result = { error: raw || "Non-JSON response from issue-survey" };
    }

    if (!resp.ok) {
      throw new Error(result?.error || `Failed to issue survey (${resp.status})`);
    }

    // Call generate-issued-pdf (locked PDF + signed URL) - non-fatal
    try {
      const resp2 = await fetch(`${supabaseUrl}/functions/v1/generate-issued-pdf`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          survey_report_id: surveyId,
        }),
      });

      const raw2 = await resp2.text();
      let result2: any = null;
      try {
        result2 = raw2 ? JSON.parse(raw2) : null;
      } catch {
        result2 = { error: raw2 || "Non-JSON response from generate-issued-pdf" };
      }

      if (resp2.ok && result2?.signed_url) {
        console.log("[Issue] PDF generated, opening in new tab");
        window.open(result2.signed_url, "_blank", "noopener,noreferrer");
      } else {
        console.warn("[Issue] PDF generation failed (non-fatal):", result2?.error);
        // Don't fail the entire issue process if PDF generation fails
      }
    } catch (pdfError) {
      console.warn("[Issue] Failed to generate PDF (non-fatal):", pdfError);
      // Don't fail the entire issue process if PDF generation fails
    }

    // Finish flow
    onSuccess();
    onClose();

    // e.g. refresh the report, close modal, show toast, navigate
    // await refetchSurvey();
    // setIsOpen(false);
    // toast.success("Survey issued");

  } catch (err: any) {
    console.error("[Issue] failed", err);
    setError(err?.message || "Failed to issue survey");
  } finally {
    setIsIssuing(false);
  }
};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-neutral-900">Issue Survey</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Survey Info */}
          <div>
            <p className="text-sm text-neutral-600">Survey</p>
            <p className="font-semibold text-neutral-900">{surveyTitle}</p>
          </div>

          {/* Blockers Display */}
          {blockers.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3 mb-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-900">
                    Cannot Issue - Requirements Not Met
                  </h3>
                  <p className="text-sm text-amber-800 mt-1">
                    Please complete the following before issuing this survey:
                  </p>
                </div>
              </div>

              <div className="space-y-3 mt-4">
                {Array.from(groupedBlockers.entries()).map(([moduleKey, moduleBlockers]) => (
                  <div key={moduleKey} className="bg-white rounded p-3">
                    <h4 className="font-medium text-neutral-900 text-sm mb-2">
                      {moduleKey === 'general' ? 'General Requirements' : moduleKey}
                    </h4>
                    <ul className="space-y-1">
                      {moduleBlockers.map((blocker, idx) => (
                        <li key={idx} className="text-sm text-neutral-700 flex items-start gap-2">
                          <span className="text-amber-600 font-bold">•</span>
                          <span>{blocker.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success State */}
          {blockers.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-green-900">Ready to Issue</h3>
                  <p className="text-sm text-green-800 mt-1">
                    All requirements have been met. This survey is ready to be issued.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Checkbox */}
          <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                disabled={blockers.length > 0}
                className="mt-1 w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
              />
              <div className="flex-1">
                <p className="font-medium text-neutral-900">
                  I confirm this assessment is complete
                </p>
                <p className="text-sm text-neutral-600 mt-1">
                  I confirm that this assessment has been completed within the stated scope and
                  limitations, and is ready for issue.
                </p>
              </div>
            </label>
          </div>

          {/* Change Log */}
          {blockers.length === 0 && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Change Log (Optional)
              </label>
              <textarea
                value={changeLog}
                onChange={(e) => setChangeLog(e.target.value)}
                placeholder="Describe what has changed in this version..."
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-neutral-500 mt-1">
                Optional notes about this issue (e.g., "Initial issue", "Updated following site visit")
              </p>
            </div>
          )}

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
            disabled={isIssuing}
            className="px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleIssue}
            disabled={!canIssue || isIssuing}
            className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isIssuing ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Issuing...
              </>
            ) : (
              'Issue Survey'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
