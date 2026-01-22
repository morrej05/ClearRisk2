import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';
import AppLayout from '../../components/AppLayout';
import { useAuth } from '../../contexts/AuthContext';
import { canAccessRiskEngineering, canAccessExplosionSafety } from '../../utils/entitlements';
import CreateDocumentModal from '../../components/documents/CreateDocumentModal';
import NewSurveyModal from '../../components/NewSurveyModal';

interface AssessmentType {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  requiresUpgrade?: boolean;
}

export default function NewAssessmentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { organisation } = useAuth();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const hasRiskEngineering = organisation ? canAccessRiskEngineering(organisation) : false;
  const hasExplosion = organisation ? canAccessExplosionSafety(organisation) : false;

  const subNavItems = [
    { label: 'All Assessments', path: '/assessments' },
    { label: 'New Assessment', path: '/assessments/new' },
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const fireAssessments: AssessmentType[] = [
    {
      id: 'fra',
      title: 'Fire Risk Assessment',
      description: 'Structured FRA with recommendations and report output.',
      enabled: true,
    },
    {
      id: 'fsd',
      title: 'Fire Strategy',
      description: 'Fire strategy inputs aligned to formal output.',
      enabled: true,
    },
  ];

  const riskEngineeringAssessments: AssessmentType[] = [
    {
      id: 'property',
      title: 'Property Risk Survey',
      description: 'Property risk engineering survey and report.',
      enabled: hasRiskEngineering,
      requiresUpgrade: !hasRiskEngineering,
    },
    {
      id: 'dsear',
      title: 'DSEAR / ATEX',
      description: 'Explosion risk assessment and controls.',
      enabled: hasExplosion,
      requiresUpgrade: !hasExplosion,
    },
  ];

  const handleStart = (typeId: string) => {
    if (typeId === 'fra') {
      setSelectedType('FRA');
      setShowCreateModal(true);
    } else if (typeId === 'fsd') {
      setSelectedType('FSD');
      setShowCreateModal(true);
    } else if (typeId === 'dsear') {
      setSelectedType('DSEAR');
      setShowCreateModal(true);
    } else if (typeId === 'property') {
      setShowSurveyModal(true);
    }
  };

  const handleDocumentCreated = () => {
    setShowCreateModal(false);
    navigate('/assessments');
  };

  const handleSurveyCreated = (surveyId: string) => {
    setShowSurveyModal(false);
    navigate(`/report/${surveyId}`);
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Assessments</h1>
        </div>

        <div className="mb-6 border-b border-slate-200">
          <nav className="flex gap-6">
            {subNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive(item.path)
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-1">New Assessment</h2>
            <p className="text-sm text-slate-600 mb-6">Select an assessment type to start.</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Fire</h3>
            </div>
            <div className="divide-y divide-slate-200">
              {fireAssessments.map((assessment) => (
                <div key={assessment.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex-1">
                    <h4 className="text-base font-medium text-slate-900">{assessment.title}</h4>
                    <p className="text-sm text-slate-600 mt-1">{assessment.description}</p>
                  </div>
                  <button
                    onClick={() => handleStart(assessment.id)}
                    className="ml-6 flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 transition-colors"
                  >
                    Start
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Risk Engineering</h3>
            </div>
            <div className="divide-y divide-slate-200">
              {riskEngineeringAssessments
                .filter(a => a.enabled || a.requiresUpgrade)
                .map((assessment) => (
                  <div key={assessment.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-medium text-slate-900">{assessment.title}</h4>
                        {assessment.requiresUpgrade && (
                          <Lock className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{assessment.description}</p>
                    </div>
                    {assessment.enabled ? (
                      <button
                        onClick={() => handleStart(assessment.id)}
                        className="ml-6 flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 transition-colors"
                      >
                        Start
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate('/upgrade')}
                        className="ml-6 flex items-center gap-2 px-4 py-2 bg-white text-slate-700 text-sm font-medium rounded-md border border-slate-300 hover:bg-slate-50 transition-colors"
                      >
                        Upgrade
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {showCreateModal && selectedType && (
        <CreateDocumentModal
          onClose={() => {
            setShowCreateModal(false);
            setSelectedType(null);
          }}
          onDocumentCreated={handleDocumentCreated}
          allowedTypes={[selectedType]}
        />
      )}

      {showSurveyModal && (
        <NewSurveyModal
          onClose={() => setShowSurveyModal(false)}
          onSurveyCreated={handleSurveyCreated}
        />
      )}
    </AppLayout>
  );
}
