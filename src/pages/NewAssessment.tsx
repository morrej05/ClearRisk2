import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { canAccessPillarB } from '../utils/entitlements';
import { ArrowLeft, Lock } from 'lucide-react';

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

  const hasAccess = user && userProfile && organisation
    ? canAccessPillarB(userProfile, organisation)
    : false;

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
      const { data, error } = await supabase
        .from('assessments')
        .insert({
          org_id: organisation.id,
          type: formData.type,
          jurisdiction: formData.jurisdiction,
          site_name: formData.site_name,
          site_address: formData.site_address || null,
          client_name: formData.client_name || null,
          client_address: formData.client_address || null,
          assessor_name: formData.assessor_name,
          assessor_company: formData.assessor_company || null,
          assessment_date: formData.assessment_date,
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;

      navigate(`/assessments/${data.id}`);
    } catch (error) {
      console.error('Error creating assessment:', error);
      alert('Failed to create assessment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-neutral-200 p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-amber-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-3 text-center">
            Professional Feature
          </h2>
          <p className="text-neutral-600 mb-6 text-center">
            Upgrade to Professional to access regulated assessments.
          </p>
          <button
            onClick={() => navigate('/upgrade')}
            className="w-full bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-semibold"
          >
            Upgrade to Professional
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
                  <option value="fire_strategy">Fire Strategy Document</option>
                  <option value="dsear">ATEX/DSEAR Assessment</option>
                  <option value="wildfire">Wildfire Risk Assessment</option>
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
                  <option value="UK-EN">UK-EN</option>
                  <option value="GENERIC">GENERIC</option>
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
