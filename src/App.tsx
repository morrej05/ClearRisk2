import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ClientBrandingProvider } from './contexts/ClientBrandingContext';
import LandingPage from './pages/LandingPage';
import SignIn from './pages/SignIn';
import Dashboard from './pages/Dashboard';
import CommonDashboard from './pages/CommonDashboard';
import FireSafetyDashboard from './pages/dashboard/FireSafetyDashboard';
import ExplosionDashboard from './pages/dashboard/ExplosionDashboard';
import ActionsDashboard from './pages/dashboard/ActionsDashboard';
import ActionRegisterPage from './pages/dashboard/ActionRegisterPage';
import DocumentOverview from './pages/documents/DocumentOverview';
import DocumentWorkspace from './pages/documents/DocumentWorkspace';
import DocumentEvidence from './pages/documents/DocumentEvidenceV2';
import DocumentPreviewPage from './pages/documents/DocumentPreviewPage';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import UpgradeSubscription from './pages/UpgradeSubscription';
import ExternalSurvey from './pages/ExternalSurvey';
import ReportPreviewPage from './pages/ReportPreviewPage';
import ArchivedAssessments from './pages/ArchivedAssessments';
import ClientDocumentView from './pages/ClientDocumentView';
import PublicDocumentViewer from './pages/PublicDocumentViewer';
import DashboardPage from './pages/ezirisk/DashboardPage';
import AssessmentsPage from './pages/ezirisk/AssessmentsPage';
import NewAssessmentPage from './pages/ezirisk/NewAssessmentPage';
import ReportsPage from './pages/ezirisk/ReportsPage';
import CombinedReportsPage from './pages/ezirisk/CombinedReportsPage';
import ImpairmentsPage from './pages/ezirisk/ImpairmentsPage';
import LibraryPage from './pages/ezirisk/LibraryPage';
import AdminPage from './pages/ezirisk/AdminPage';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import PlatformAdminRoute from './components/SuperAdminRoute';
import AuthedLayout from './components/AuthedLayout';
import AdminLayout from './components/AdminLayout';
import PlatformLayout from './components/PlatformLayout';
import ErrorBoundary from './components/ErrorBoundary';
import BuildingsPage from "./pages/re/BuildingsPage";
import FireProtectionPage from "./pages/re/FireProtectionPage";

function App() {
  return (
    <BrowserRouter>
      <ClientBrandingProvider>
          <ErrorBoundary>
            <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/external/:token" element={<ExternalSurvey />} />
          <Route path="/client/document/:token" element={<ClientDocumentView />} />
          <Route path="/public/documents" element={<PublicDocumentViewer />} />
          <Route
            path="/dashboard"
            element={
              <AuthedLayout>
                <DashboardPage />
              </AuthedLayout>
            }
          />
          <Route
            path="/legacy-dashboard"
            element={<Navigate to="/dashboard" replace />}
          />
          <Route
            path="/common-dashboard"
            element={<Navigate to="/dashboard" replace />}
          />
          <Route
            path="/dashboard/fire"
            element={<Navigate to="/dashboard" replace />}
          />
          <Route
            path="/dashboard/explosion"
            element={<Navigate to="/dashboard" replace />}
          />
          <Route
            path="/dashboard/action-register"
            element={
              <AuthedLayout>
                <ActionRegisterPage />
              </AuthedLayout>
            }
          />
          <Route
            path="/dashboard/actions"
            element={
              <AuthedLayout>
                <ActionsDashboard />
              </AuthedLayout>
            }
          />
          <Route
            path="/documents/:id"
            element={
              <AuthedLayout>
                <DocumentOverview />
              </AuthedLayout>
            }
          />
          <Route
            path="/documents/:id/workspace"
            element={
              <AuthedLayout>
                <DocumentWorkspace />
              </AuthedLayout>
            }
          />
          <Route
            path="/documents/:id/evidence"
            element={
              <AuthedLayout>
                <DocumentEvidence />
              </AuthedLayout>
            }
          />
          <Route path="/documents/:id/re/buildings" element={<BuildingsPage />} />
          <Route path="/documents/:id/re/fire-protection" element={<FireProtectionPage />} />
          <Route
            path="/documents/:id/preview"
            element={
              <AuthedLayout>
                <DocumentPreviewPage />
              </AuthedLayout>
            }
          />
          <Route
            path="/assessments"
            element={
              <AuthedLayout>
                <AssessmentsPage />
              </AuthedLayout>
            }
          />
          <Route
            path="/assessments/new"
            element={
              <AuthedLayout>
                <NewAssessmentPage />
              </AuthedLayout>
            }
          />
          <Route
            path="/reports"
            element={
              <AuthedLayout>
                <ReportsPage />
              </AuthedLayout>
            }
          />
          <Route
            path="/reports/combined"
            element={
              <AuthedLayout>
                <CombinedReportsPage />
              </AuthedLayout>
            }
          />
          <Route
            path="/impairments"
            element={
              <AuthedLayout>
                <ImpairmentsPage />
              </AuthedLayout>
            }
          />
          <Route
            path="/library"
            element={
              <AuthedLayout>
                <LibraryPage />
              </AuthedLayout>
            }
          />
          <Route
            path="/upgrade"
            element={
              <AuthedLayout>
                <UpgradeSubscription />
              </AuthedLayout>
            }
          />
          <Route
            path="/report/:surveyId"
            element={
              <AuthedLayout>
                <ReportPreviewPage />
              </AuthedLayout>
            }
          />
          <Route
            path="/admin/*"
            element={
              <AuthedLayout>
                <AdminRoute>
                  <AdminLayout>
                    <AdminPage />
                  </AdminLayout>
                </AdminRoute>
              </AuthedLayout>
            }
          />
          <Route
            path="/platform/*"
            element={
              <AuthedLayout>
                <PlatformAdminRoute>
                  <PlatformLayout>
                    <SuperAdminDashboard />
                  </PlatformLayout>
                </PlatformAdminRoute>
              </AuthedLayout>
            }
          />
          <Route path="/super-admin" element={<Navigate to="/platform" replace />} />
          <Route path="/legacy-admin" element={<Navigate to="/admin" replace />} />
          <Route
            path="/archived-assessments"
            element={
              <AuthedLayout>
                <ArchivedAssessments />
              </AuthedLayout>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </ErrorBoundary>
        </ClientBrandingProvider>
      </BrowserRouter>
  );
}

export default App;
