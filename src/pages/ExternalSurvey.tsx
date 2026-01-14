import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AlertCircle, Loader, CheckCircle2, Save, Send, X, Lock, Clock } from 'lucide-react';
import ProgressBar from '../components/ProgressBar';
import AutoExpandTextarea from '../components/AutoExpandTextarea';

interface ExternalLink {
  id: string;
  survey_id: string;
  token: string;
  link_type: 'full' | 'abridged' | 'recommendation_only';
  expires_at: string | null;
  used: boolean;
  client_name?: string;
  client_email?: string;
  created_at: string;
}

interface Survey {
  id: string;
  company_name: string;
  property_name: string;
  address: string;
  survey_date: string;
  report_status: string;
  form_data: any;
  external_edit_active: boolean;
}

interface OverallComment {
  id: string;
  hazard: string;
  description: string;
  client_response: string;
  status: string;
}

export default function ExternalSurvey() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [externalLink, setExternalLink] = useState<ExternalLink | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [showClientInfoForm, setShowClientInfoForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [recommendations, setRecommendations] = useState<OverallComment[]>([]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const initialFormDataRef = useRef<any>({});

  useEffect(() => {
    validateTokenAndLoadSurvey();
  }, [token]);

  useEffect(() => {
    if (Object.keys(initialFormDataRef.current).length > 0) {
      const hasChangedData = JSON.stringify(formData) !== JSON.stringify(initialFormDataRef.current) ||
        JSON.stringify(recommendations) !== JSON.stringify(survey?.form_data?.overallComments || []);
      setHasChanges(hasChangedData);
    }
  }, [formData, recommendations, survey]);

  const validateTokenAndLoadSurvey = async () => {
    if (!token) {
      setError('No token provided');
      setLoading(false);
      return;
    }

    try {
      const { data: linkData, error: linkError } = await supabase
        .from('external_links')
        .select('*')
        .eq('token', token)
        .maybeSingle();

      if (linkError) throw linkError;

      if (!linkData) {
        setError('This link is no longer valid or has expired.');
        setLoading(false);
        return;
      }

      if (linkData.used) {
        setError('This link has already been used and is no longer valid.');
        setLoading(false);
        return;
      }

      if (linkData.expires_at && new Date(linkData.expires_at) < new Date()) {
        setError('This link has expired. Please contact the report issuer.');
        setLoading(false);
        return;
      }

      setExternalLink(linkData);

      const { data: surveyData, error: surveyError } = await supabase
        .from('survey_reports')
        .select('*')
        .eq('id', linkData.survey_id)
        .maybeSingle();

      if (surveyError) throw surveyError;
      if (!surveyData) {
        setError('Survey not found.');
        setLoading(false);
        return;
      }

      if (linkData.link_type === 'recommendation_only' && surveyData.report_status !== 'Issued') {
        setError('Recommendations can only be updated after report issue.');
        setLoading(false);
        return;
      }

      setSurvey(surveyData);

      if (linkData.link_type === 'recommendation_only') {
        const recs = surveyData.form_data?.overallComments || [];
        setRecommendations(recs);
        initialFormDataRef.current = {};
      } else {
        const formDataCopy = { ...surveyData.form_data };
        setFormData(formDataCopy);
        setRecommendations(formDataCopy.overallComments || []);
        initialFormDataRef.current = JSON.parse(JSON.stringify(formDataCopy));
      }

      if (linkData.link_type === 'recommendation_only' && !linkData.client_name) {
        setShowClientInfoForm(true);
      } else {
        await supabase
          .from('survey_reports')
          .update({
            external_edit_active: true,
            external_edit_started_at: new Date().toISOString()
          })
          .eq('id', linkData.survey_id);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error validating token:', err);
      setError('An error occurred while validating your link.');
      setLoading(false);
    }
  };

  const handleClientInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!externalLink || !clientName || !clientEmail) return;

    try {
      const { error } = await supabase
        .from('external_links')
        .update({
          client_name: clientName,
          client_email: clientEmail,
        })
        .eq('id', externalLink.id);

      if (error) throw error;

      await supabase
        .from('survey_reports')
        .update({
          external_edit_active: true,
          external_edit_started_at: new Date().toISOString()
        })
        .eq('id', externalLink.survey_id);

      setExternalLink({ ...externalLink, client_name: clientName, client_email: clientEmail });
      setShowClientInfoForm(false);
    } catch (err) {
      console.error('Error saving client info:', err);
    }
  };

  const handleSave = async () => {
    if (!survey || !externalLink || isSaving) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      if (externalLink.link_type === 'recommendation_only') {
        const updatedFormData = {
          ...survey.form_data,
          overallComments: recommendations,
        };

        const { error } = await supabase
          .from('survey_reports')
          .update({ form_data: updatedFormData })
          .eq('id', survey.id);

        if (error) throw error;

        setSurvey({ ...survey, form_data: updatedFormData });
      } else {
        const updatedFormData = {
          ...formData,
          overallComments: recommendations,
        };

        const { error } = await supabase
          .from('survey_reports')
          .update({ form_data: updatedFormData })
          .eq('id', survey.id);

        if (error) throw error;

        setSurvey({ ...survey, form_data: updatedFormData });
        initialFormDataRef.current = JSON.parse(JSON.stringify(updatedFormData));
      }

      setSaveMessage('Progress saved successfully');
      setHasChanges(false);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error('Error saving:', err);
      setSaveMessage('Failed to save progress');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!survey || !externalLink || isSaving) return;

    setIsSaving(true);

    try {
      await handleSave();

      if (externalLink.link_type === 'recommendation_only') {
        const originalRecommendations = survey.form_data?.overallComments || [];

        for (let i = 0; i < recommendations.length; i++) {
          const original = originalRecommendations[i];
          const updated = recommendations[i];

          if (original && (original.status !== updated.status || original.client_response !== updated.client_response)) {
            await supabase
              .from('recommendation_updates')
              .insert({
                survey_report_id: survey.id,
                recommendation_id: updated.id,
                old_status: original.status,
                new_status: updated.status,
                old_client_response: original.client_response,
                new_client_response: updated.client_response,
                updated_by: externalLink.client_name || externalLink.client_email || 'External',
                external_link_token: token,
              });
          }
        }
      }

      await supabase
        .from('external_links')
        .update({ used: true })
        .eq('id', externalLink.id);

      await supabase
        .from('survey_reports')
        .update({
          external_edit_active: false,
          external_edit_started_at: null
        })
        .eq('id', survey.id);

      setIsSubmitted(true);
      setHasChanges(false);
      setShowConfirmModal(false);
    } catch (err) {
      console.error('Error submitting:', err);
      setSaveMessage('Failed to submit responses');
    } finally {
      setIsSaving(false);
    }
  };

  const updateRecommendation = (id: string, field: keyof OverallComment, value: string) => {
    setRecommendations(recommendations.map(r =>
      r.id === id ? { ...r, [field]: value } : r
    ));
  };

  const calculateProgress = () => {
    if (externalLink?.link_type === 'recommendation_only') {
      const total = recommendations.length;
      const completed = recommendations.filter(r => r.status || r.client_response).length;
      return total > 0 ? Math.round((completed / total) * 100) : 0;
    }
    return 0;
  };

  const getModeLabel = () => {
    if (!externalLink) return 'Survey';
    switch (externalLink.link_type) {
      case 'full':
        return 'Full Survey';
      case 'abridged':
        return 'Abridged Survey';
      case 'recommendation_only':
        return 'Recommendation Update';
      default:
        return 'Survey';
    }
  };

  const getModeColor = () => {
    if (!externalLink) return 'bg-slate-100 text-slate-800';
    switch (externalLink.link_type) {
      case 'full':
        return 'bg-blue-100 text-blue-800';
      case 'abridged':
        return 'bg-green-100 text-green-800';
      case 'recommendation_only':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const formatExpiryDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-slate-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Validating your access...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg border border-red-200 p-8 max-w-md w-full">
          <div className="flex items-start mb-4">
            <AlertCircle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Access Denied</h2>
              <p className="text-slate-600">{error}</p>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-4">
            If you believe this is an error, please contact the person who sent you this link.
          </p>
        </div>
      </div>
    );
  }

  if (showClientInfoForm) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-8 max-w-md w-full">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">Welcome</h2>
          <p className="text-slate-600 mb-6">
            Before you begin, please provide your contact information. This helps us track responses and communicate any follow-up questions.
          </p>
          <form onSubmit={handleClientInfoSubmit} className="space-y-4">
            <div>
              <label htmlFor="clientName" className="block text-sm font-medium text-slate-700 mb-1">
                Your Name *
              </label>
              <input
                type="text"
                id="clientName"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                placeholder="John Smith"
              />
            </div>
            <div>
              <label htmlFor="clientEmail" className="block text-sm font-medium text-slate-700 mb-1">
                Your Email *
              </label>
              <input
                type="email"
                id="clientEmail"
                required
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                placeholder="john@company.com"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-slate-900 text-white px-6 py-3 rounded-lg hover:bg-slate-800 transition-colors font-medium"
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!externalLink || !survey) {
    return null;
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg border border-green-200 p-8 max-w-md w-full">
          <div className="flex items-start mb-4">
            <CheckCircle2 className="w-12 h-12 text-green-600 mr-3 flex-shrink-0" />
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Successfully Submitted</h2>
              <p className="text-slate-600">
                Your responses have been submitted successfully. Thank you for your contribution.
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-4">
            You can now close this page. This link is no longer active.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">CR</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">ClearRisk</h1>
                  <p className="text-xs text-slate-500">External Survey Contribution</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${getModeColor()}`}>
                {getModeLabel()}
              </div>
              {externalLink.expires_at && (
                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Clock size={16} />
                  <span className="hidden sm:inline">Expires:</span>
                  <span className="font-medium">{formatExpiryDate(externalLink.expires_at)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-start">
            <CheckCircle2 className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-600">
              You've been invited to contribute to a ClearRisk survey. No login or subscription is required.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {saveMessage && (
          <div className={`mb-6 p-4 rounded-lg border flex items-center gap-2 ${
            saveMessage.includes('success')
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {saveMessage.includes('success') && <CheckCircle2 size={20} />}
            {saveMessage.includes('Failed') && <AlertCircle size={20} />}
            {saveMessage}
          </div>
        )}

        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Survey Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">Site Name</p>
              <p className="text-sm font-semibold text-slate-900">{survey.property_name || 'Not specified'}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">Company</p>
              <p className="text-sm font-semibold text-slate-900">{survey.company_name || 'Not specified'}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">Address</p>
              <p className="text-sm text-slate-700">{survey.address || 'Not specified'}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">Survey Type</p>
              <p className="text-sm font-semibold text-slate-900">{getModeLabel()}</p>
            </div>
          </div>

          {externalLink.link_type === 'recommendation_only' && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> This report has been issued. You can only update recommendation statuses and client responses. All other fields are locked.
              </p>
            </div>
          )}
        </div>

        {externalLink.link_type === 'recommendation_only' && (
          <>
            <ProgressBar
              progress={calculateProgress()}
              label={`${recommendations.filter(r => r.status || r.client_response).length} of ${recommendations.length} recommendations updated`}
            />

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mt-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">Recommendations</h2>

              <div className="space-y-6">
                {recommendations.map((rec, index) => (
                  <div key={rec.id} className="border border-slate-200 rounded-lg p-5">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="font-semibold text-slate-900">Recommendation {index + 1}</h3>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5 flex items-center gap-2">
                          <Lock size={14} />
                          Hazard
                        </label>
                        <input
                          type="text"
                          value={rec.hazard || 'Not specified'}
                          readOnly
                          className="w-full px-4 py-2.5 bg-slate-50 text-slate-500 border border-slate-200 rounded-lg cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5 flex items-center gap-2">
                          <Lock size={14} />
                          Description
                        </label>
                        <textarea
                          value={rec.description || 'Not specified'}
                          readOnly
                          rows={4}
                          className="w-full px-4 py-2.5 bg-slate-50 text-slate-500 border border-slate-200 rounded-lg cursor-not-allowed resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Status
                        </label>
                        <select
                          value={rec.status}
                          onChange={(e) => updateRecommendation(rec.id, 'status', e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        >
                          <option value="">Not Set</option>
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Closed">Closed</option>
                          <option value="Not Applicable">Not Applicable</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Client Response
                        </label>
                        <AutoExpandTextarea
                          value={rec.client_response}
                          onChange={(e) => updateRecommendation(rec.id, 'client_response', e.target.value)}
                          placeholder="Enter your response..."
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {recommendations.length === 0 && (
                  <p className="text-slate-500 text-center py-8">No recommendations found for this survey.</p>
                )}
              </div>
            </div>
          </>
        )}

        {(externalLink.link_type === 'full' || externalLink.link_type === 'abridged') && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Survey Form</h2>
            <p className="text-slate-600">
              Full survey form will be implemented here for {externalLink.link_type} access mode.
            </p>
          </div>
        )}
      </div>

      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="bg-white border-2 border-slate-300 text-slate-900 px-6 py-3 rounded-lg shadow-lg hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
        >
          {isSaving ? (
            <>
              <Loader size={20} className="animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save size={20} />
              Save Progress
            </>
          )}
        </button>

        <button
          onClick={() => setShowConfirmModal(true)}
          disabled={isSaving}
          className="bg-slate-900 text-white px-6 py-3 rounded-lg shadow-lg hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
        >
          <Send size={20} />
          Submit Responses
        </button>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-semibold text-slate-900">Confirm Submission</h3>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>

            <p className="text-slate-600 mb-6">
              Are you sure you want to submit your responses? You will not be able to edit them after submission.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Submitting...' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
