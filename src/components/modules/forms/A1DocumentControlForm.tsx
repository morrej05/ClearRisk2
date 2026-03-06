import { useState, useEffect } from 'react';
import { FileText, CheckCircle, Building2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import OutcomePanel from '../OutcomePanel';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';
import { updateDocumentMeta } from '../../../lib/documents/updateDocumentMeta';
import { useAuth } from '../../../contexts/AuthContext';
import { normalizeJurisdiction, getStandardsOptions } from '../../../lib/jurisdictions';
import { resolveSectionAssessmentOutcome, resolveSectionAssessmentNotes } from '../../../utils/moduleAssessment';

interface Document {
  id: string;
  title: string;
  assessment_date: string;
  assessor_name: string | null;
  assessor_role: string | null;
  responsible_person: string | null;
  scope_description: string | null;
  limitations_assumptions: string | null;
  standards_selected: string[];
  jurisdiction: string;
  organisation_id: string;
  meta?: any;
}

interface ModuleInstance {
  id: string;
  module_key: string;
  outcome: string | null;
  assessor_notes: string;
  data: Record<string, any>;
}

interface A1DocumentControlFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

export default function A1DocumentControlForm({
  moduleInstance,
  document,
  onSaved,
}: A1DocumentControlFormProps) {
  const { organisation } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const [documentFields, setDocumentFields] = useState({
    title: document.title || '',
    assessmentDate: document.assessment_date || '',
    assessorName: document.assessor_name || '',
    assessorRole: document.assessor_role || '',
    responsiblePerson: document.responsible_person || '',
    scopeDescription: document.scope_description || '',
    limitationsAssumptions: document.limitations_assumptions || '',
    standardsSelected: document.standards_selected || [],
    jurisdiction: normalizeJurisdiction(document.jurisdiction),
  });

  const [moduleData, setModuleData] = useState({
    revision: moduleInstance.data.revision || '',
    approvalStatus: moduleInstance.data.approval_status || 'draft',
    approvalSignatory: moduleInstance.data.approval_signatory || '',
    revisionHistory: moduleInstance.data.revision_history || '',
    distributionList: moduleInstance.data.distribution_list || '',
    documentOwner: moduleInstance.data.document_owner || '',
  });

  const [clientSiteData, setClientSiteData] = useState(() => {
    const legacyClientName = document.meta?.clientName || moduleInstance.data.clientName;
    const legacySiteName = document.meta?.siteName || moduleInstance.data.siteName;
    const legacyAddressLine1 = document.meta?.addressLine1 || moduleInstance.data.addressLine1;
    const legacyAddressLine2 = document.meta?.addressLine2 || moduleInstance.data.addressLine2;
    const legacyCity = document.meta?.city || moduleInstance.data.city;
    const legacyCounty = document.meta?.county || moduleInstance.data.county;
    const legacyPostcode = document.meta?.postcode || moduleInstance.data.postcode;
    const legacyCountry = document.meta?.country || moduleInstance.data.country;

    return {
      clientName: document.meta?.client?.name || moduleInstance.data.client?.name || legacyClientName || document.responsible_person || '',
      siteName: document.meta?.site?.name || moduleInstance.data.site?.name || legacySiteName || document.scope_description || '',
      addressLine1: document.meta?.site?.address?.line1 || moduleInstance.data.site?.address?.line1 || legacyAddressLine1 || '',
      addressLine2: document.meta?.site?.address?.line2 || moduleInstance.data.site?.address?.line2 || legacyAddressLine2 || '',
      city: document.meta?.site?.address?.city || moduleInstance.data.site?.address?.city || legacyCity || '',
      county: document.meta?.site?.address?.county || moduleInstance.data.site?.address?.county || legacyCounty || '',
      postcode: document.meta?.site?.address?.postcode || moduleInstance.data.site?.address?.postcode || legacyPostcode || '',
      country: document.meta?.site?.address?.country || moduleInstance.data.site?.address?.country || legacyCountry || 'United Kingdom',
      contactName: document.meta?.site?.contact?.name || moduleInstance.data.site?.contact?.name || '',
      contactEmail: document.meta?.site?.contact?.email || moduleInstance.data.site?.contact?.email || '',
      contactPhone: document.meta?.site?.contact?.phone || moduleInstance.data.site?.contact?.phone || '',
    };
  });

  const [outcome, setOutcome] = useState(resolveSectionAssessmentOutcome(moduleInstance));
  const [assessorNotes, setAssessorNotes] = useState(resolveSectionAssessmentNotes(moduleInstance));

  useEffect(() => {
    setDocumentFields({
      title: document.title || '',
      assessmentDate: document.assessment_date || '',
      assessorName: document.assessor_name || '',
      assessorRole: document.assessor_role || '',
      responsiblePerson: document.responsible_person || '',
      scopeDescription: document.scope_description || '',
      limitationsAssumptions: document.limitations_assumptions || '',
      standardsSelected: document.standards_selected || [],
      jurisdiction: normalizeJurisdiction(document.jurisdiction),
    });
  }, [document]);

  const handleStandardToggle = (standard: string) => {
    setDocumentFields((prev) => ({
      ...prev,
      standardsSelected: prev.standardsSelected.includes(standard)
        ? prev.standardsSelected.filter((s) => s !== standard)
        : [...prev.standardsSelected, standard],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const { error: docError} = await supabase
        .from('documents')
        .update({
          title: documentFields.title || 'Untitled Assessment',
          assessment_date: documentFields.assessmentDate,
          assessor_name: documentFields.assessorName || null,
          assessor_role: documentFields.assessorRole || null,
          responsible_person: documentFields.responsiblePerson || null,
          scope_description: documentFields.scopeDescription || null,
          limitations_assumptions: documentFields.limitationsAssumptions || null,
          standards_selected: documentFields.standardsSelected,
          // jurisdiction is controlled by the header selector, not this form
        })
        .eq('id', document.id);

      if (docError) throw docError;

      // Structure client/site data for module storage
      const clientSiteForModule = {
        client: {
          name: clientSiteData.clientName
        },
        site: {
          name: clientSiteData.siteName,
          address: {
            line1: clientSiteData.addressLine1,
            line2: clientSiteData.addressLine2 || undefined,
            city: clientSiteData.city || undefined,
            county: clientSiteData.county || undefined,
            postcode: clientSiteData.postcode || undefined,
            country: clientSiteData.country
          },
          contact: clientSiteData.contactName || clientSiteData.contactEmail || clientSiteData.contactPhone ? {
            name: clientSiteData.contactName || undefined,
            email: clientSiteData.contactEmail || undefined,
            phone: clientSiteData.contactPhone || undefined
          } : undefined
        }
      };

      const payload = sanitizeModuleInstancePayload({
        data: {
          ...moduleData,
          ...clientSiteForModule
        },
        outcome,
        assessor_notes: assessorNotes,
        updated_at: new Date().toISOString(),
      }, moduleInstance.module_key);

      console.log('MODULE SAVE PAYLOAD', JSON.parse(JSON.stringify(payload)));

      const { error: moduleError } = await supabase
        .from('module_instances')
        .update(payload)
        .eq('id', moduleInstance.id);

      if (moduleError) throw moduleError;

      // Sync identity to document.meta
      await updateDocumentMeta(document.id, clientSiteForModule);

      setLastSaved(new Date().toLocaleTimeString());
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
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-6 h-6 text-neutral-700" />
          <h2 className="text-2xl font-bold text-neutral-900">
            A1 - Document Control & Governance
          </h2>
        </div>
        <p className="text-neutral-600">
          Establish document metadata, internal QA status, and governance information
        </p>
        {lastSaved && (
          <div className="flex items-center gap-2 mt-2 text-sm text-green-700">
            <CheckCircle className="w-4 h-4" />
            Last saved at {lastSaved}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 p-6 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Core Document Information
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Document Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={documentFields.title}
                onChange={(e) =>
                  setDocumentFields({ ...documentFields, title: e.target.value })
                }
                placeholder="e.g., Fire Risk Assessment - Main Office"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                required
              />
              <p className="mt-1 text-xs text-neutral-500">
                Internal reference title for this assessment document
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Assessment Date
              </label>
              <input
                type="date"
                value={documentFields.assessmentDate}
                onChange={(e) =>
                  setDocumentFields({ ...documentFields, assessmentDate: e.target.value })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-neutral-500">
                Jurisdiction is set in the document header (top-right selector)
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Assessor Name
                </label>
                <input
                  type="text"
                  value={documentFields.assessorName}
                  onChange={(e) =>
                    setDocumentFields({ ...documentFields, assessorName: e.target.value })
                  }
                  placeholder="John Smith"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Assessor Role
                </label>
                <input
                  type="text"
                  value={documentFields.assessorRole}
                  onChange={(e) =>
                    setDocumentFields({ ...documentFields, assessorRole: e.target.value })
                  }
                  placeholder="Fire Safety Consultant"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Responsible Person / Duty Holder
              </label>
              <input
                type="text"
                value={documentFields.responsiblePerson}
                onChange={(e) =>
                  setDocumentFields({
                    ...documentFields,
                    responsiblePerson: e.target.value,
                  })
                }
                placeholder="Site Manager / Duty Holder"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Scope Description
              </label>
              <textarea
                value={documentFields.scopeDescription}
                onChange={(e) =>
                  setDocumentFields({
                    ...documentFields,
                    scopeDescription: e.target.value,
                  })
                }
                placeholder="Brief description of what this assessment covers..."
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Limitations & Assumptions
              </label>
              <textarea
                value={documentFields.limitationsAssumptions}
                onChange={(e) =>
                  setDocumentFields({
                    ...documentFields,
                    limitationsAssumptions: e.target.value,
                  })
                }
                placeholder="Any limitations or assumptions for this assessment..."
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Standards & References
              </label>
              <div className="grid grid-cols-2 gap-2">
                {getStandardsOptions(documentFields.jurisdiction).map((standard) => (
                  <label
                    key={standard}
                    className="flex items-center gap-2 px-3 py-2 border border-neutral-200 rounded-lg hover:bg-neutral-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={documentFields.standardsSelected.includes(standard)}
                      onChange={() => handleStandardToggle(standard)}
                      className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500"
                    />
                    <span className="text-sm text-neutral-700">{standard}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-neutral-200">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Client & Site Identity
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Client Name
                </label>
                <input
                  type="text"
                  value={clientSiteData.clientName}
                  onChange={(e) => setClientSiteData({ ...clientSiteData, clientName: e.target.value })}
                  placeholder="e.g., ABC Manufacturing Ltd"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Site Name
                </label>
                <input
                  type="text"
                  value={clientSiteData.siteName}
                  onChange={(e) => setClientSiteData({ ...clientSiteData, siteName: e.target.value })}
                  placeholder="e.g., Main Factory, Building A"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Address Line 1
              </label>
              <input
                type="text"
                value={clientSiteData.addressLine1}
                onChange={(e) => setClientSiteData({ ...clientSiteData, addressLine1: e.target.value })}
                placeholder="e.g., 123 Industrial Estate"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Address Line 2
              </label>
              <input
                type="text"
                value={clientSiteData.addressLine2}
                onChange={(e) => setClientSiteData({ ...clientSiteData, addressLine2: e.target.value })}
                placeholder="e.g., Unit 5B"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  City/Town
                </label>
                <input
                  type="text"
                  value={clientSiteData.city}
                  onChange={(e) => setClientSiteData({ ...clientSiteData, city: e.target.value })}
                  placeholder="e.g., Manchester"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  County/Region
                </label>
                <input
                  type="text"
                  value={clientSiteData.county}
                  onChange={(e) => setClientSiteData({ ...clientSiteData, county: e.target.value })}
                  placeholder="e.g., Greater Manchester"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Postcode
                </label>
                <input
                  type="text"
                  value={clientSiteData.postcode}
                  onChange={(e) => setClientSiteData({ ...clientSiteData, postcode: e.target.value })}
                  placeholder="e.g., M1 1AA"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Country
              </label>
              <input
                type="text"
                value={clientSiteData.country}
                onChange={(e) => setClientSiteData({ ...clientSiteData, country: e.target.value })}
                placeholder="e.g., United Kingdom"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            </div>

            <div className="pt-4 border-t border-neutral-200">
              <h4 className="text-sm font-semibold text-neutral-900 mb-3">
                Site Contact (Optional)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={clientSiteData.contactName}
                    onChange={(e) => setClientSiteData({ ...clientSiteData, contactName: e.target.value })}
                    placeholder="e.g., John Smith"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={clientSiteData.contactEmail}
                    onChange={(e) => setClientSiteData({ ...clientSiteData, contactEmail: e.target.value })}
                    placeholder="e.g., john.smith@example.com"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={clientSiteData.contactPhone}
                    onChange={(e) => setClientSiteData({ ...clientSiteData, contactPhone: e.target.value })}
                    placeholder="e.g., +44 20 1234 5678"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-neutral-200">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">
            Document Control Information
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Revision Number
                </label>
                <input
                  type="text"
                  value={moduleData.revision}
                  onChange={(e) =>
                    setModuleData({ ...moduleData, revision: e.target.value })
                  }
                  placeholder="e.g., Rev 1.0"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Internal QA Status
                </label>
                <select
                  value={moduleData.approvalStatus}
                  onChange={(e) =>
                    setModuleData({ ...moduleData, approvalStatus: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                >
                  <option value="draft">Draft</option>
                  <option value="issued">QA Approved</option>
                  <option value="under_review">In QA Review</option>
                  <option value="superseded">Superseded</option>
                </select>
                <p className="mt-1 text-xs text-neutral-500">
                  Internal quality assurance status (separate from document issuance)
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Approval Signatory
              </label>
              <input
                type="text"
                value={moduleData.approvalSignatory}
                onChange={(e) =>
                  setModuleData({ ...moduleData, approvalSignatory: e.target.value })
                }
                placeholder="Name of person approving document"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Document Owner
              </label>
              <input
                type="text"
                value={moduleData.documentOwner}
                onChange={(e) =>
                  setModuleData({ ...moduleData, documentOwner: e.target.value })
                }
                placeholder="Person or department responsible for document"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Revision History
              </label>
              <textarea
                value={moduleData.revisionHistory}
                onChange={(e) =>
                  setModuleData({ ...moduleData, revisionHistory: e.target.value })
                }
                placeholder="Record of document revisions and changes..."
                rows={4}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Distribution List
              </label>
              <textarea
                value={moduleData.distributionList}
                onChange={(e) =>
                  setModuleData({ ...moduleData, distributionList: e.target.value })
                }
                placeholder="List of recipients or departments who should receive this document..."
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      <OutcomePanel
        outcome={outcome}
        assessorNotes={assessorNotes}
        onOutcomeChange={setOutcome}
        onNotesChange={setAssessorNotes}
        onSave={handleSave}
        isSaving={isSaving}
        moduleKey={moduleInstance.module_key}
        optionSet="governance"
      />
    </div>
  );
}
