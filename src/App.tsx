import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
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
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import UpgradeSubscription from './pages/UpgradeSubscription';
import ExternalSurvey from './pages/ExternalSurvey';
import ReportPreviewPage from './pages/ReportPreviewPage';
import ArchivedAssessments from './pages/ArchivedAssessments';
import ClientDocumentView from './pages/ClientDocumentView';
import PublicDocumentViewer from './pages/PublicDocumentViewer';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import PlatformAdminRoute from './components/SuperAdminRoute';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
            element={<Navigate to="/common-dashboard" replace />}
          />
          <Route
            path="/legacy-dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/common-dashboard"
            element={
              <ProtectedRoute>
                <CommonDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/fire"
            element={
              <ProtectedRoute>
                <FireSafetyDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/explosion"
            element={
              <ProtectedRoute>
                <ExplosionDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/action-register"
            element={
              <ProtectedRoute>
                <ActionRegisterPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/actions"
            element={
              <ProtectedRoute>
                <ActionsDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/documents/:id"
            element={
              <ProtectedRoute>
                <DocumentOverview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/documents/:id/workspace"
            element={
              <ProtectedRoute>
                <DocumentWorkspace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/documents/:id/evidence"
            element={
              <ProtectedRoute>
                <DocumentEvidence />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upgrade"
            element={
              <AdminRoute>
                <UpgradeSubscription />
              </AdminRoute>
            }
          />
          <Route
            path="/report/:surveyId"
            element={
              <ProtectedRoute>
                <ReportPreviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/super-admin"
            element={
              <PlatformAdminRoute>
                <SuperAdminDashboard />
              </PlatformAdminRoute>
            }
          />
          <Route
            path="/assessments/*"
            element={
              <ProtectedRoute>
                <ArchivedAssessments />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </ErrorBoundary>
        </ClientBrandingProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
