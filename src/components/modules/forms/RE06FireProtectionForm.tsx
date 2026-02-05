import { useNavigate } from 'react-router-dom';
import { Droplet, ArrowRight } from 'lucide-react';

interface Document {
  id: string;
  title: string;
  document_type: string;
}

interface ModuleInstance {
  id: string;
  document_id: string;
  outcome: string | null;
  assessor_notes: string;
  data: Record<string, any>;
}

interface RE06FireProtectionFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

export default function RE06FireProtectionForm({
  moduleInstance,
  document,
  onSaved
}: RE06FireProtectionFormProps) {
  const navigate = useNavigate();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="bg-white rounded-lg border border-slate-200 p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
            <Droplet className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">RE-06: Fire Protection</h2>
            <p className="text-slate-600 mt-1">Site water supply and building sprinkler assessment</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">Full Assessment Tool</h3>
          <p className="text-sm text-blue-800 mb-4">
            RE-06 uses a dedicated interface to assess:
          </p>
          <ul className="list-disc list-inside text-sm text-blue-800 space-y-1 mb-4">
            <li>Site-level water supply reliability and fire pumps</li>
            <li>Building-specific sprinkler systems and coverage</li>
            <li>Auto-calculated scores with engineering guidance</li>
            <li>Area-weighted site roll-up metrics</li>
          </ul>
          <p className="text-xs text-blue-700">
            The assessment reuses buildings from RE-02 Construction (no duplication).
          </p>
        </div>

        <button
          onClick={() => navigate(`/documents/${document.id}/re/fire-protection`)}
          className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center justify-center gap-3 transition-colors"
        >
          Open Fire Protection Assessment
          <ArrowRight className="w-5 h-5" />
        </button>

        <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs text-slate-600">
            <strong>Note:</strong> Data is auto-saved in the dedicated interface. Your progress will be preserved when you navigate.
          </p>
        </div>
      </div>
    </div>
  );
}
