import { useNavigate } from 'react-router-dom';
import { Archive, ArrowLeft, ClipboardList } from 'lucide-react';

export default function ArchivedAssessments() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg border border-neutral-200 p-8">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
            <Archive className="w-10 h-10 text-amber-600" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-neutral-900 mb-3 text-center">
          Legacy Assessment Form (Archived)
        </h1>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-amber-900 font-semibold mb-2">
            This assessment form has been archived
          </p>
          <p className="text-amber-800 text-sm">
            The legacy assessment interface has been replaced with a new modular document system
            that provides better flexibility and supports FRA, Fire Strategies, and Explosive Atmospheres assessments.
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <h2 className="text-lg font-semibold text-neutral-900">What's Changed?</h2>

          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">
                1
              </div>
              <div>
                <p className="font-medium text-neutral-900">New Dashboard Structure</p>
                <p className="text-sm text-neutral-600">
                  Access all documents from a unified dashboard with tiles for Fire Safety,
                  Explosion Safety, and Actions.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">
                2
              </div>
              <div>
                <p className="font-medium text-neutral-900">Modular Document System</p>
                <p className="text-sm text-neutral-600">
                  Documents are built from reusable modules, making assessments more consistent
                  and easier to manage.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">
                3
              </div>
              <div>
                <p className="font-medium text-neutral-900">Unified Actions Register</p>
                <p className="text-sm text-neutral-600">
                  Track all actions across documents in one place with priority bands and status tracking.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <ClipboardList className="w-5 h-5" />
            Go to New Dashboard
          </button>

          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-neutral-700 font-semibold rounded-lg hover:bg-neutral-50 transition-colors border border-neutral-300"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-neutral-200">
          <p className="text-sm text-neutral-500 text-center">
            Need help? Contact support or check the documentation for migration guidance.
          </p>
        </div>
      </div>
    </div>
  );
}
