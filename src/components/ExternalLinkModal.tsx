import { useState } from 'react';
import { X, Copy, CheckCircle, ExternalLink as ExternalLinkIcon, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ExternalLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  surveyId: string;
  surveyName: string;
  surveyStatus: string;
}

export default function ExternalLinkModal({ isOpen, onClose, surveyId, surveyName, surveyStatus }: ExternalLinkModalProps) {
  const [linkType, setLinkType] = useState<'full' | 'abridged' | 'recommendation_only'>('abridged');
  const [expiryDays, setExpiryDays] = useState(14);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerateLink = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (linkType === 'recommendation_only' && surveyStatus !== 'issued') {
        setError('Recommendation-only links can only be created for issued reports.');
        setLoading(false);
        return;
      }

      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      const { error: insertError } = await supabase
        .from('external_links')
        .insert({
          survey_id: surveyId,
          token: token,
          link_type: linkType,
          expires_at: expiresAt.toISOString(),
          used: false,
          created_by: user.id,
        });

      if (insertError) throw insertError;

      const link = `${window.location.origin}/external/${token}`;
      setGeneratedLink(link);
      setLoading(false);
    } catch (err) {
      console.error('Error generating link:', err);
      setError('Failed to generate link. Please try again.');
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (generatedLink) {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setGeneratedLink(null);
    setCopied(false);
    setError(null);
    setLinkType('abridged');
    setExpiryDays(14);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Generate External Link</h2>
            <p className="text-sm text-slate-600 mt-1">{surveyName}</p>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!generatedLink ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Access Level
                </label>
                <div className="space-y-3">
                  <label className="flex items-start p-4 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-slate-300 transition-colors">
                    <input
                      type="radio"
                      name="linkType"
                      value="full"
                      checked={linkType === 'full'}
                      onChange={(e) => setLinkType(e.target.value as any)}
                      className="mt-1 mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">Full Survey</div>
                      <div className="text-sm text-slate-600 mt-1">
                        External user can view and edit all survey fields, buildings, construction details, and hazards. Cannot change issue status or delete the survey.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start p-4 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-slate-300 transition-colors">
                    <input
                      type="radio"
                      name="linkType"
                      value="abridged"
                      checked={linkType === 'abridged'}
                      onChange={(e) => setLinkType(e.target.value as any)}
                      className="mt-1 mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">Abridged Survey</div>
                      <div className="text-sm text-slate-600 mt-1">
                        Shows only Sections 1-5, 10, and 11. Perfect for clients who need limited visibility. Read-only access to key information.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start p-4 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-slate-300 transition-colors">
                    <input
                      type="radio"
                      name="linkType"
                      value="recommendation_only"
                      checked={linkType === 'recommendation_only'}
                      onChange={(e) => setLinkType(e.target.value as any)}
                      className="mt-1 mr-3"
                      disabled={surveyStatus !== 'issued'}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">
                        Recommendation Update Only
                        {surveyStatus !== 'issued' && (
                          <span className="ml-2 text-xs font-normal text-amber-600">(Report must be issued)</span>
                        )}
                      </div>
                      <div className="text-sm text-slate-600 mt-1">
                        Client can only update recommendation status and add responses. All other fields are read-only. Requires issued report.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="expiryDays" className="block text-sm font-medium text-slate-700 mb-2">
                  Link Expiry (Days)
                </label>
                <input
                  type="number"
                  id="expiryDays"
                  min="1"
                  max="90"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(parseInt(e.target.value) || 14)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Link will expire on {new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-300 rounded-lg flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateLink}
                  disabled={loading}
                  className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <ExternalLinkIcon className="w-4 h-4" />
                  {loading ? 'Generating...' : 'Generate Link'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="p-4 bg-green-50 border border-green-300 rounded-lg flex items-start">
                <CheckCircle className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium text-green-900 mb-1">Link Generated Successfully</h3>
                  <p className="text-sm text-green-800">
                    Share this link with external collaborators. They won't need to sign in.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Shareable Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={generatedLink}
                    readOnly
                    className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg bg-slate-50 text-sm font-mono"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2"
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Access Level:</span>
                  <span className="font-medium text-slate-900 capitalize">{linkType.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Expires:</span>
                  <span className="font-medium text-slate-900">
                    {new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
