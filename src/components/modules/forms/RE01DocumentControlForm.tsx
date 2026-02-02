import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import { HRG_MASTER_MAP, humanizeIndustryKey } from '../../../lib/re/reference/hrgMasterMap';
import { ensureRatingsObject } from '../../../lib/re/scoring/riskEngineeringHelpers';
import { Plus, X } from 'lucide-react';

interface Document {
  id: string;
  title: string;
}

interface ModuleInstance {
  id: string;
  document_id: string;
  outcome: string | null;
  assessor_notes: string;
  data: Record<string, any>;
}

interface RE01DocumentControlFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

interface SiteContact {
  name: string;
  role: string;
  company: string;
  email: string;
  phone: string;
}

interface Attendee {
  name: string;
  role: string;
  company: string;
}

export default function RE01DocumentControlForm({
  moduleInstance,
  document,
  onSaved,
}: RE01DocumentControlFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const d = moduleInstance.data || {};

  const [formData, setFormData] = useState({
    assessor: d.assessor || { name: '', role: '', company: '' },
    dates: d.dates || { assessment_date: null, review_date: null },
    client_site: d.client_site || { client: '', site: '', address: '', country: '' },
    scope: d.scope || {
      scope_type: 'full_loss_prevention',
      scope_other_text: '',
      limitations_assumptions: ''
    },
    site_contacts: d.site_contacts || [] as SiteContact[],
    present_during_survey: d.present_during_survey || [] as Attendee[],
    reference_documents_reviewed: d.reference_documents_reviewed || [],
  });

  const [riskEngInstanceId, setRiskEngInstanceId] = useState<string | null>(null);
  const [industryKey, setIndustryKey] = useState<string | null>(null);
  const [riskEngModuleNotFound, setRiskEngModuleNotFound] = useState(false);

  useEffect(() => {
    async function loadRiskEngModule() {
      try {
        const { data: instances, error } = await supabase
          .from('module_instances')
          .select('id, data')
          .eq('document_id', moduleInstance.document_id)
          .eq('module_key', 'RISK_ENGINEERING')
          .maybeSingle();

        if (error) throw error;

        if (instances) {
          setRiskEngInstanceId(instances.id);
          setIndustryKey(instances.data?.industry_key || null);
          setRiskEngModuleNotFound(false);
        } else {
          setRiskEngInstanceId(null);
          setIndustryKey(null);
          setRiskEngModuleNotFound(true);
        }
      } catch (err) {
        console.error('Error loading RISK_ENGINEERING module:', err);
        setRiskEngModuleNotFound(true);
      }
    }

    loadRiskEngModule();
  }, [moduleInstance.document_id]);

  const handleIndustryChange = async (newIndustryKey: string) => {
    if (!riskEngInstanceId) {
      return;
    }

    try {
      const { data: current, error: fetchError } = await supabase
        .from('module_instances')
        .select('data')
        .eq('id', riskEngInstanceId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const ensured = ensureRatingsObject({ ...current?.data, industry_key: newIndustryKey });

      const { error: updateError } = await supabase
        .from('module_instances')
        .update({ data: ensured })
        .eq('id', riskEngInstanceId);

      if (updateError) throw updateError;

      setIndustryKey(newIndustryKey);
    } catch (err) {
      console.error('Error updating industry key:', err);
      alert('Failed to update industry classification');
    }
  };

  const addSiteContact = () => {
    setFormData(prev => ({
      ...prev,
      site_contacts: [...prev.site_contacts, { name: '', role: '', company: '', email: '', phone: '' }]
    }));
  };

  const removeSiteContact = (index: number) => {
    setFormData(prev => ({
      ...prev,
      site_contacts: prev.site_contacts.filter((_, i) => i !== index)
    }));
  };

  const updateSiteContact = (index: number, field: keyof SiteContact, value: string) => {
    setFormData(prev => ({
      ...prev,
      site_contacts: prev.site_contacts.map((contact, i) =>
        i === index ? { ...contact, [field]: value } : contact
      )
    }));
  };

  const addAttendee = () => {
    setFormData(prev => ({
      ...prev,
      present_during_survey: [...prev.present_during_survey, { name: '', role: '', company: '' }]
    }));
  };

  const removeAttendee = (index: number) => {
    setFormData(prev => ({
      ...prev,
      present_during_survey: prev.present_during_survey.filter((_, i) => i !== index)
    }));
  };

  const updateAttendee = (index: number, field: keyof Attendee, value: string) => {
    setFormData(prev => ({
      ...prev,
      present_during_survey: prev.present_during_survey.map((attendee, i) =>
        i === index ? { ...attendee, [field]: value } : attendee
      )
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const sanitized = sanitizeModuleInstancePayload({ data: formData });

      const { error } = await supabase
        .from('module_instances')
        .update({
          data: sanitized.data,
        })
        .eq('id', moduleInstance.id);

      if (error) throw error;
      onSaved();
    } catch (error) {
      console.error('Error saving module:', error);
      alert('Failed to save module. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">RE-1 - Document Control</h2>
        <p className="text-slate-600">Survey metadata and document control information</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Industry Classification</h3>
          <p className="text-sm text-slate-600 mb-3">
            Select the industry type for this site. This determines the risk weighting factors applied across all assessment modules.
          </p>
          <div className="max-w-md">
            <select
              value={industryKey || ''}
              onChange={(e) => handleIndustryChange(e.target.value)}
              disabled={!riskEngInstanceId}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">Select Industry...</option>
              {Object.keys(HRG_MASTER_MAP.industries).map((key) => (
                <option key={key} value={key}>
                  {humanizeIndustryKey(key)}
                </option>
              ))}
            </select>
            {riskEngModuleNotFound && (
              <p className="text-sm text-amber-600 mt-2">
                Risk Engineering base module not found
              </p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Assessor</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                value={formData.assessor.name}
                onChange={(e) => setFormData(prev => ({ ...prev, assessor: { ...prev.assessor, name: e.target.value } }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <input
                type="text"
                value={formData.assessor.role}
                onChange={(e) => setFormData(prev => ({ ...prev, assessor: { ...prev.assessor, role: e.target.value } }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company</label>
              <input
                type="text"
                value={formData.assessor.company}
                onChange={(e) => setFormData(prev => ({ ...prev, assessor: { ...prev.assessor, company: e.target.value } }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Client & Site</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Client</label>
              <input
                type="text"
                value={formData.client_site.client}
                onChange={(e) => setFormData(prev => ({ ...prev, client_site: { ...prev.client_site, client: e.target.value } }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Site</label>
              <input
                type="text"
                value={formData.client_site.site}
                onChange={(e) => setFormData(prev => ({ ...prev, client_site: { ...prev.client_site, site: e.target.value } }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
              <textarea
                value={formData.client_site.address}
                onChange={(e) => setFormData(prev => ({ ...prev, client_site: { ...prev.client_site, address: e.target.value } }))}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Site Contacts</h3>
            <button
              type="button"
              onClick={addSiteContact}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Contact
            </button>
          </div>

          {formData.site_contacts.length === 0 ? (
            <div className="text-center py-6 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-500">
              No site contacts added
            </div>
          ) : (
            <div className="space-y-4">
              {formData.site_contacts.map((contact, index) => (
                <div key={index} className="p-4 border border-slate-200 rounded-md bg-slate-50">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-900">Contact {index + 1}</h4>
                    <button
                      type="button"
                      onClick={() => removeSiteContact(index)}
                      className="text-red-600 hover:text-red-700 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={contact.name}
                        onChange={(e) => updateSiteContact(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                      <input
                        type="text"
                        value={contact.role}
                        onChange={(e) => updateSiteContact(index, 'role', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Company</label>
                      <input
                        type="text"
                        value={contact.company}
                        onChange={(e) => updateSiteContact(index, 'company', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={contact.email}
                        onChange={(e) => updateSiteContact(index, 'email', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={contact.phone}
                        onChange={(e) => updateSiteContact(index, 'phone', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Present During Survey</h3>
            <button
              type="button"
              onClick={addAttendee}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Attendee
            </button>
          </div>

          {formData.present_during_survey.length === 0 ? (
            <div className="text-center py-6 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-500">
              No attendees added
            </div>
          ) : (
            <div className="space-y-4">
              {formData.present_during_survey.map((attendee, index) => (
                <div key={index} className="p-4 border border-slate-200 rounded-md bg-slate-50">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-900">Attendee {index + 1}</h4>
                    <button
                      type="button"
                      onClick={() => removeAttendee(index)}
                      className="text-red-600 hover:text-red-700 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={attendee.name}
                        onChange={(e) => updateAttendee(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                      <input
                        type="text"
                        value={attendee.role}
                        onChange={(e) => updateAttendee(index, 'role', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Company</label>
                      <input
                        type="text"
                        value={attendee.company}
                        onChange={(e) => updateAttendee(index, 'company', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Scope</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Survey Type</label>
              <select
                value={formData.scope.scope_type}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  scope: { ...prev.scope, scope_type: e.target.value }
                }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              >
                <option value="full_loss_prevention">Full Loss Prevention Survey</option>
                <option value="interim_loss_prevention">Interim Loss Prevention Survey</option>
                <option value="desktop">Desktop Survey</option>
                <option value="other">Other</option>
              </select>
            </div>

            {formData.scope.scope_type === 'other' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Describe Survey Type</label>
                <input
                  type="text"
                  value={formData.scope.scope_other_text}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    scope: { ...prev.scope, scope_other_text: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  placeholder="Specify survey type..."
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Limitations & Assumptions</label>
              <textarea
                value={formData.scope.limitations_assumptions}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  scope: { ...prev.scope, limitations_assumptions: e.target.value }
                }))}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                placeholder="Document any limitations or assumptions for this survey..."
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
