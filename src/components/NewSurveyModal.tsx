import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface NewSurveyModalProps {
  onClose: () => void;
  onSurveyCreated: (surveyId: string) => void;
}

export default function NewSurveyModal({ onClose, onSurveyCreated }: NewSurveyModalProps) {
  const { user } = useAuth();
  const [frameworkType, setFrameworkType] = useState<'fire_property'>('fire_property');
  const [surveyType, setSurveyType] = useState<'Full' | 'Abridged'>('Full');
  const [companyName, setCompanyName] = useState('');
  const [surveyDate, setSurveyDate] = useState(new Date().toISOString().split('T')[0]);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!user) return;

    if (!companyName.trim()) {
      alert('Please enter a company name');
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('survey_reports')
        .insert({
          user_id: user.id,
          framework_type: frameworkType,
          survey_type: surveyType,
          report_status: 'Draft',
          property_name: 'Untitled Survey',
          property_address: '',
          company_name: companyName,
          survey_date: surveyDate,
          issued: false,
          form_data: {
            companyName: companyName,
            surveyDate: surveyDate,
            reportStatus: 'Draft',
          },
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        onSurveyCreated(data.id);
      }
    } catch (error) {
      console.error('Error creating survey:', error);
      alert('Failed to create survey. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">New Survey</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label htmlFor="frameworkType" className="block text-sm font-medium text-slate-700 mb-2">
              Survey Framework *
            </label>
            <select
              id="frameworkType"
              value={frameworkType}
              onChange={(e) => setFrameworkType(e.target.value as any)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all bg-white"
              required
            >
              <option value="fire_property">Fire Property Risk Survey</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Insurance and risk engineering survey framework
            </p>
          </div>

          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-slate-700 mb-2">
              Company Name *
            </label>
            <input
              type="text"
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all"
              placeholder="Enter company name"
              required
            />
          </div>

          <div>
            <label htmlFor="surveyDate" className="block text-sm font-medium text-slate-700 mb-2">
              Survey Date *
            </label>
            <input
              type="date"
              id="surveyDate"
              value={surveyDate}
              onChange={(e) => setSurveyDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Survey Type *
            </label>
            <div className="space-y-3">
              <label
                className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  surveyType === 'Full'
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="surveyType"
                  value="Full"
                  checked={surveyType === 'Full'}
                  onChange={(e) => setSurveyType(e.target.value as 'Full')}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-medium text-slate-900">Full Survey</div>
                  <div className="text-sm text-slate-600 mt-1">
                    Comprehensive survey including all sections (1-11)
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  surveyType === 'Abridged'
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="surveyType"
                  value="Abridged"
                  checked={surveyType === 'Abridged'}
                  onChange={(e) => setSurveyType(e.target.value as 'Abridged')}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-medium text-slate-900">Abridged Survey</div>
                  <div className="text-sm text-slate-600 mt-1">
                    Simplified survey with essential sections (1-5, 10-11)
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="px-6 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : 'Create Survey'}
          </button>
        </div>
      </div>
    </div>
  );
}
