import { useState, useRef } from 'react';
import { X, AlertTriangle, Upload, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { uploadEvidenceFile, createAttachmentRow } from '../../lib/supabase/attachments';

interface AddActionModalProps {
  documentId: string;
  moduleInstanceId: string;
  onClose: () => void;
  onActionCreated: () => void;
  defaultAction?: string;
  defaultLikelihood?: number;
  defaultImpact?: number;
  source?: 'manual' | 'info_gap' | 'recommendation' | 'system';
}

const TIMESCALE_OPTIONS = [
  { value: 'immediate', label: 'Immediate' },
  { value: '30d', label: '≤ 30 days' },
  { value: '90d', label: '≤ 90 days' },
  { value: 'next_review', label: 'Next Review' },
  { value: 'custom', label: 'Custom' },
];

export default function AddActionModal({
  documentId,
  moduleInstanceId,
  onClose,
  onActionCreated,
  defaultAction = '',
  defaultLikelihood = 3,
  defaultImpact = 3,
  source = 'manual',
}: AddActionModalProps) {
  const { organisation, user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAttachmentPrompt, setShowAttachmentPrompt] = useState(false);
  const [createdActionId, setCreatedActionId] = useState<string | null>(null);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    recommendedAction: defaultAction,
    likelihood: defaultLikelihood,
    impact: defaultImpact,
    timescale: 'next_review',
    overrideJustification: '',
    targetDate: '',
  });

  const score = formData.likelihood * formData.impact;

  const getPriorityBand = (score: number): string => {
    if (score >= 20) return 'P1';
    if (score >= 12) return 'P2';
    if (score >= 6) return 'P3';
    return 'P4';
  };

  const getSuggestedTimescale = (priorityBand: string): string => {
    switch (priorityBand) {
      case 'P1':
        return 'immediate';
      case 'P2':
        return '30d';
      case 'P3':
        return '90d';
      case 'P4':
        return 'next_review';
      default:
        return 'next_review';
    }
  };

  const priorityBand = getPriorityBand(score);
  const suggestedTimescale = getSuggestedTimescale(priorityBand);
  const isTimescaleOverride = formData.timescale !== suggestedTimescale;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P1':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'P2':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'P3':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'P4':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      default:
        return 'bg-neutral-100 text-neutral-600 border-neutral-300';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organisation?.id || !user?.id) {
      alert('User or organisation not found. Please refresh and try again.');
      return;
    }

    if (!formData.recommendedAction.trim()) {
      alert('Please enter a recommended action.');
      return;
    }

    if (isTimescaleOverride && !formData.overrideJustification.trim()) {
      alert('Please provide a justification for overriding the suggested timescale.');
      return;
    }

    setIsSubmitting(true);

    try {
      const trimmedAction = formData.recommendedAction.trim().toLowerCase();

      const { data: existingActions, error: checkError } = await supabase
        .from('actions')
        .select('id, recommended_action')
        .eq('document_id', documentId)
        .eq('module_instance_id', moduleInstanceId)
        .is('deleted_at', null);

      if (checkError) throw checkError;

      const duplicate = existingActions?.find(
        (action) => action.recommended_action.trim().toLowerCase() === trimmedAction
      );

      if (duplicate) {
        setIsSubmitting(false);
        alert('This action already exists in this module.');
        return;
      }
      let targetDate = null;
      if (formData.targetDate) {
        targetDate = formData.targetDate;
      } else {
        const today = new Date();
        switch (formData.timescale) {
          case 'immediate':
            targetDate = today.toISOString().split('T')[0];
            break;
          case '30d':
            targetDate = new Date(today.setDate(today.getDate() + 30))
              .toISOString()
              .split('T')[0];
            break;
          case '90d':
            targetDate = new Date(today.setDate(today.getDate() + 90))
              .toISOString()
              .split('T')[0];
            break;
          case 'next_review':
          case 'custom':
          default:
            targetDate = null;
        }
      }

      const actionData = {
        organisation_id: organisation.id,
        document_id: documentId,
        source_document_id: documentId,
        module_instance_id: moduleInstanceId,
        recommended_action: formData.recommendedAction.trim(),
        status: 'open',
        priority_band: priorityBand,
        timescale: formData.timescale,
        target_date: targetDate,
        override_justification: isTimescaleOverride
          ? formData.overrideJustification.trim()
          : null,
        source: source,
      };

      const { data: action, error: actionError } = await supabase
        .from('actions')
        .insert([actionData])
        .select()
        .single();

      if (actionError) throw actionError;

      const ratingData = {
        action_id: action.id,
        likelihood: formData.likelihood,
        impact: formData.impact,
        score: score,
        rated_by_user_id: user.id,
        rated_at: new Date().toISOString(),
        rating_basis: null,
      };

      const { error: ratingError } = await supabase
        .from('action_ratings')
        .insert([ratingData]);

      if (ratingError) throw ratingError;

      setCreatedActionId(action.id);
      setShowAttachmentPrompt(true);
      onActionCreated();
    } catch (error) {
      console.error('Error creating action:', error);
      alert('Failed to create action. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAttachmentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !organisation?.id || !createdActionId) return;

    setIsUploadingAttachments(true);
    try {
      for (const file of Array.from(files)) {
        const uploadResult = await uploadEvidenceFile(file, organisation.id, documentId);
        await createAttachmentRow({
          organisation_id: organisation.id,
          document_id: documentId,
          file_path: uploadResult.file_path,
          file_name: uploadResult.file_name,
          file_type: uploadResult.file_type,
          file_size_bytes: uploadResult.file_size_bytes,
          action_id: createdActionId,
          module_instance_id: moduleInstanceId,
        });
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      alert(`${files.length} file(s) attached successfully!`);
    } catch (error) {
      console.error('Error uploading attachments:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to upload attachments: ${errorMessage}`);
    } finally {
      setIsUploadingAttachments(false);
    }
  };

  const handleFinish = () => {
    onClose();
  };

  if (showAttachmentPrompt) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="bg-green-50 border-b border-green-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-bold text-green-900">Action Created!</h2>
            </div>
          </div>

          <div className="p-6">
            <p className="text-neutral-700 mb-4">
              Would you like to attach evidence or photos to this action?
            </p>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
              onChange={handleAttachmentUpload}
              className="hidden"
            />

            <div className="space-y-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAttachments}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-neutral-900 text-white rounded-lg hover:bg-neutral-700 transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {isUploadingAttachments ? 'Uploading...' : 'Attach Files'}
              </button>

              <button
                onClick={handleFinish}
                disabled={isUploadingAttachments}
                className="w-full px-4 py-3 border-2 border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50"
              >
                Skip for Now
              </button>
            </div>

            <p className="text-xs text-neutral-500 mt-4 text-center">
              You can also attach files later from the Evidence tab
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-neutral-900">Add Action</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Recommended Action <span className="text-red-600">*</span>
            </label>
            <textarea
              value={formData.recommendedAction}
              onChange={(e) =>
                setFormData({ ...formData, recommendedAction: e.target.value })
              }
              placeholder="Describe the recommended action to address the identified deficiency or risk..."
              rows={4}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Likelihood (L) <span className="text-red-600">*</span>
              </label>
              <select
                value={formData.likelihood}
                onChange={(e) =>
                  setFormData({ ...formData, likelihood: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                required
              >
                <option value={1}>1 - Very Unlikely</option>
                <option value={2}>2 - Unlikely</option>
                <option value={3}>3 - Possible</option>
                <option value={4}>4 - Likely</option>
                <option value={5}>5 - Very Likely</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Impact (I) <span className="text-red-600">*</span>
              </label>
              <select
                value={formData.impact}
                onChange={(e) =>
                  setFormData({ ...formData, impact: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                required
              >
                <option value={1}>1 - Negligible</option>
                <option value={2}>2 - Minor</option>
                <option value={3}>3 - Moderate</option>
                <option value={4}>4 - Major</option>
                <option value={5}>5 - Catastrophic</option>
              </select>
            </div>
          </div>

          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-neutral-700">
                Calculated Risk Score:
              </span>
              <span className="text-2xl font-bold text-neutral-900">
                {formData.likelihood} × {formData.impact} = {score}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-700">Priority Band:</span>
              <span
                className={`inline-flex px-3 py-1 text-sm font-bold rounded border ${getPriorityColor(
                  priorityBand
                )}`}
              >
                {priorityBand}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              P1: 20-25 • P2: 12-19 • P3: 6-11 • P4: 1-5
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Timescale <span className="text-red-600">*</span>
            </label>
            <select
              value={formData.timescale}
              onChange={(e) =>
                setFormData({ ...formData, timescale: e.target.value })
              }
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              required
            >
              {TIMESCALE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                  {option.value === suggestedTimescale && ' (suggested)'}
                </option>
              ))}
            </select>
            {isTimescaleOverride && (
              <div className="mt-2 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  You've selected a different timescale than suggested for {priorityBand}.
                  Please provide a justification below.
                </p>
              </div>
            )}
          </div>

          {isTimescaleOverride && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Override Justification <span className="text-red-600">*</span>
              </label>
              <textarea
                value={formData.overrideJustification}
                onChange={(e) =>
                  setFormData({ ...formData, overrideJustification: e.target.value })
                }
                placeholder="Explain why this timescale is more appropriate than the suggested timescale..."
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Target Date (Optional)
            </label>
            <input
              type="date"
              value={formData.targetDate}
              onChange={(e) =>
                setFormData({ ...formData, targetDate: e.target.value })
              }
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
            />
            <p className="text-xs text-neutral-500 mt-1">
              Leave blank to auto-calculate based on timescale
            </p>
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
              disabled={isSubmitting || !formData.recommendedAction.trim()}
              className={`px-5 py-2.5 rounded-lg font-medium transition-colors ${
                isSubmitting || !formData.recommendedAction.trim()
                  ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                  : 'bg-neutral-900 text-white hover:bg-neutral-800'
              }`}
            >
              {isSubmitting ? 'Creating...' : 'Create Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
