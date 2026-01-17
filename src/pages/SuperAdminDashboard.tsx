import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, ArrowLeft, Sliders, BookOpen, CreditCard, Users } from 'lucide-react';
import SectorWeightings from '../components/SectorWeightings';
import UserRoleManagement from '../components/UserRoleManagement';
import RecommendationLibrary from '../components/RecommendationLibrary';

type SuperAdminView = 'sector-weightings' | 'user-management' | 'recommendation-library' | 'pricing-plans';

export default function SuperAdminDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<SuperAdminView>('sector-weightings');

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin');
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackToDashboard}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Super Admin</h1>
                <p className="text-sm text-slate-600 mt-0.5">Platform-wide settings and configuration</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">{user?.email}</p>
                <p className="text-xs text-slate-600">Super Administrator</p>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-6">
          <aside className="w-64 flex-shrink-0">
            <nav className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Platform Settings
              </h2>
              <ul className="space-y-1">
                <li>
                  <button
                    onClick={() => setActiveView('sector-weightings')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                      activeView === 'sector-weightings'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Sliders className="w-4 h-4" />
                    Sector Weightings
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveView('user-management')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                      activeView === 'user-management'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    User Management
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveView('recommendation-library')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                      activeView === 'recommendation-library'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    Recommendation Library
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveView('pricing-plans')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                      activeView === 'pricing-plans'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    Pricing & Plans
                  </button>
                </li>
              </ul>
            </nav>
          </aside>

          <main className="flex-1">
            {activeView === 'sector-weightings' && <SectorWeightings />}

            {activeView === 'user-management' && <UserRoleManagement />}

            {activeView === 'recommendation-library' && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
                <RecommendationLibrary />
              </div>
            )}

            {activeView === 'pricing-plans' && (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
                <div className="text-center py-12">
                  <CreditCard className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h2 className="text-2xl font-semibold text-slate-900 mb-2">
                    Pricing & Plans
                  </h2>
                  <p className="text-slate-600 max-w-md mx-auto">
                    Configure pricing tiers, subscription plans, and billing settings for organizations.
                  </p>
                  <div className="mt-6 inline-block px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800 font-medium">Coming Soon</p>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
