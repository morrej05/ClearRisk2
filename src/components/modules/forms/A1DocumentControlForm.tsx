import { useState, useEffect } from 'react';
import { FileText, CheckCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import OutcomePanel from '../OutcomePanel';

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
}

interface ModuleInstance {
  id: string;
  outcome: string | null;
  assessor_notes: string;
  data: Record<string, any>;
}

interface A1DocumentControlFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

const STANDARDS_OPTIONS = [
  'BS 9999:2017',
  'BS 9991:2015',
  'Approved Document B',
  'BS 5588 (legacy)',
  'BS 7974 (fire engineering)',
  'PD 7974',
  'NFPA 101',
  'Other',
];

export default function A1DocumentControlForm({
  moduleInstance,
  document,
  onSaved,
}: A1DocumentControlFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const [documentFields, setDocumentFields] = useState({
    assessmentDate: document.assessment_date || '',
    assessorName: document.assessor_name || '',
    assessorRole: document.assessor_role || '',
    responsiblePerson: document.responsible_person || '',
    scopeDescription: document.scope_description || '',
    limitationsAssumptions: document.limitations_assumptions || '',
    standardsSelected: document.standards_selected || [],
  });

  const [moduleData, setModuleData] = useState({
    revision: moduleInstance.data.revision || '',
    approvalStatus: moduleInstance.data.approval_status || 'draft',
    approvalSignatory: moduleInstance.data.approval_signatory || '',
    revisionHistory: moduleInstance.data.revision_history || '',
    distributionList: moduleInstance.data.distribution_list || '',
    documentOwner: moduleInstance.data.document_owner || '',
  });

  const [outcome, setOutcome] = useState(moduleInstance.outcome || '');
  const [assessorNotes, setAssessorNotes] = useState(moduleInstance.assessor_notes || '');

  useEffect(() => {
    setDocumentFields({
      assessmentDate: document.assessment_date || '',
      assessorName: document.assessor_name || '',
      assessorRole: document.assessor_role || '',
      responsiblePerson: document.responsible_person || '',
      scopeDescription: document.scope_description || '',
      limitationsAssumptions: document.limitations_assumptions || '',
      standardsSelected: document.standards_selected || [],
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
      const { error: docError } = await supabase
        .from('documents')
        .update({
          assessment_date: documentFields.assessmentDate,
          assessor_name: documentFields.assessorName || null,
          assessor_role: documentFields.assessorRole || null,
          responsible_person: documentFields.responsiblePerson || null,
          scope_description: documentFields.scopeDescription || null,
          limitations_assumptions: documentFields.limitationsAssumptions || null,
          standards_selected: documentFields.standardsSelected,
        })
        .eq('id', document.id);

      if (docError) throw docError;

      const completedAt = outcome ? new Date().toISOString() : null;

      const { error: moduleError } = await supabase
        .from('module_instances')
        .update({
          outcome: outcome || null,
          assessor_notes: assessorNotes,
          data: moduleData,
          completed_at: completedAt,
        })
        .eq('id', moduleInstance.id);

      if (moduleError) throw moduleError;

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
          Establish document metadata, approval status, and governance information
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
                {STANDARDS_OPTIONS.map((standard) => (
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
                  Approval Status
                </label>
                <select
                  value={moduleData.approvalStatus}
                  onChange={(e) =>
                    setModuleData({ ...moduleData, approvalStatus: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                >
                  <option value="draft">Draft</option>
                  <option value="issued">Issued</option>
                  <option value="under_review">Under Review</option>
                  <option value="superseded">Superseded</option>
                </select>
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
      />
    </div>
  );
}
