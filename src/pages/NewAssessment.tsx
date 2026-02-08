import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { canAccessPillarB } from '../utils/entitlements';
import { ArrowLeft, Lock } from 'lucide-react';
import { getModuleKeysForDocType } from '../lib/modules/moduleCatalog';
import { getAssessmentDisplayName } from '../utils/displayNames';

export default function NewAssessment() {
  const { user, userProfile, organisation } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    type: 'fra',
    jurisdiction: 'UK-EN',
    site_name: '',
    site_address: '',
    client_name: '',
    client_address: '',
    assessor_name: userProfile?.name || '',
    assessor_company: '',
    assessment_date: new Date().toISOString().split('T')[0],
  });

  const mapToDocType = (type: string) => {
    switch (type) {
      case 'fra': return 'FRA';
      case 'fire_strategy': return 'FSD';
      case 'dsear': return 'DSEAR';
      case 'fra_fsd': return 'FRA';
      default: return 'FRA';
    }
  };

  const getEnabledModules = (type: string): string[] => {
    switch (type) {
      case 'fra': return ['FRA'];
      case 'fire_strategy': return ['FSD'];
      case 'dsear': return ['DSEAR'];
      case 'fra_fsd': return ['FRA', 'FSD'];
      default: return ['FRA'];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organisation?.id) {
      alert('No organisation found');
      return;
    }

    if (!formData.site_name || !formData.assessor_name || !formData.assessment_date) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const docType = mapToDocType(formData.type);
      const enabledModules = getEnabledModules(formData.type);
      const title = formData.type === 'fra_fsd'
        ? `${formData.site_name} — FRA + FSD`
        : `${formData.site_name} — ${docType}`;

      // 1. Create the document FIRST
      const { data: document, error: docError } = await supabase
        .from('documents')
        .insert({
          organisation_id: organisation.id,
          document_type: docType,
          enabled_modules: enabledModules,
          title: title,
          status: 'draft',
          version: 1,
          assessment_date: formData.assessment_date,
          assessor_name: formData.assessor_name,
          standards_selected: [],
          jurisdiction: formData.jurisdiction === 'UK-EN' ? 'UK' : 'IE',
        })
        .select()
        .single();

      if (docError) throw docError;
      if (!document?.id) throw new Error('Document creation failed - no ID returned');

      // Update base_document_id to point to itself
      const { error: updateError } = await supabase
        .from('documents')
        .update({ base_document_id: document.id })
        .eq('id', document.id);

      if (updateError) throw updateError;

      // 2. Create the assessments row with document_id link
      const { error: assessmentError } = await supabase
        .from('assessments')
        .insert({
          org_id: organisation.id,
          type: formData.type,
          jurisdiction: formData.jurisdiction,
          site_name: formData.site_name,
          client_name: formData.client_name || null,
          status: 'draft',
          assessment_date: formData.assessment_date,
          document_id: document.id,
        });

      if (assessmentError) throw assessmentError;

      // Get module keys for all enabled module types
      const allModuleKeys: string[] = [];
      for (const moduleType of enabledModules) {
        const keys = getModuleKeysForDocType(moduleType);
        allModuleKeys.push(...keys);
      }
      const moduleKeys = [...new Set(allModuleKeys)];

      // Insert module instances
      const moduleInstances = moduleKeys.map(moduleKey => ({
        organisation_id: organisation.id,
        document_id: document.id,
        module_key: moduleKey,
        data: {},
        assessor_notes: '',
        outcome: null,
      }));

      const { error: moduleError } = await supabase
        .from('module_instances')
        .insert(moduleInstances);

      if (moduleError) throw moduleError;

      navigate(`/documents/${document.id}/workspace`);
    } catch (error) {
      console.error('Error creating document:', error);
      alert('Failed to create document. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user || !organisation) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-neutral-200 p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-300 border-t-blue-600"></div>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-3 text-center">
            Setting Up Your Account
          </h2>
          <p className="text-neutral-600 mb-6 text-center">
            Please wait while we prepare your organisation. This should only take a moment.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-semibold"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <button
          onClick={() => navigate('/assessments')}
          className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Assessments
        </button>

        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-8">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">New Assessment</h1>
          <p className="text-neutral-600 mb-8">
            Create a new assessment document
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Assessment Type <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  required
                  className="w-full border border-neutral-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="fra">Fire Risk Assessment (FRA)</option>
                  <option value="fire_strategy">Fire Strategy Document (FSD)</option>
                  <option value="fra_fsd">Combined FRA + FSD</option>
                  <option value="dsear">{getAssessmentDisplayName('dsear', formData.jurisdiction)}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Jurisdiction <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.jurisdiction}
                  onChange={(e) => setFormData({ ...formData, jurisdiction: e.target.value })}
                  required
                  className="w-full border border-neutral-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="UK-EN">United Kingdom</option>
                  <option value="IE">Ireland</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Site Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.site_name}
                onChange={(e) => setFormData({ ...formData, site_name: e.target.value })}
                required
                className="w-full border border-neutral-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter site name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Site Address
              </label>
              <textarea
                value={formData.site_address}
                onChange={(e) => setFormData({ ...formData, site_address: e.target.value })}
                rows={3}
                className="w-full border border-neutral-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter site address"
              />
            </div>

            <div className="border-t border-neutral-200 pt-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">Client Details (Optional)</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Client Name
                  </label>
                  <input
                    type="text"
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter client name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Client Address
                  </label>
                  <textarea
                    value={formData.client_address}
                    onChange={(e) => setFormData({ ...formData, client_address: e.target.value })}
                    rows={3}
                    className="w-full border border-neutral-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter client address"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-200 pt-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">Assessor Details</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Assessor Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.assessor_name}
                    onChange={(e) => setFormData({ ...formData, assessor_name: e.target.value })}
                    required
                    className="w-full border border-neutral-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter assessor name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Assessor Company
                  </label>
                  <input
                    type="text"
                    value={formData.assessor_company}
                    onChange={(e) => setFormData({ ...formData, assessor_company: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter company name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Assessment Date <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.assessment_date}
                    onChange={(e) => setFormData({ ...formData, assessment_date: e.target.value })}
                    required
                    className="w-full border border-neutral-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-6">
              <button
                type="button"
                onClick={() => navigate('/assessments')}
                className="flex-1 border border-neutral-300 text-neutral-700 px-6 py-3 rounded-lg hover:bg-neutral-50 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create Assessment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
