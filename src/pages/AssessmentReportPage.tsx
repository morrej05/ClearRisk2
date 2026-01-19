import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AssessmentReport from '../components/AssessmentReport';

export default function AssessmentReportPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </div>
      <div className="max-w-5xl mx-auto py-8">
        <AssessmentReport />
      </div>
    </div>
  );
}
