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
import DocumentOverview from './pages/documents/DocumentOverview';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import UpgradeSubscription from './pages/UpgradeSubscription';
import ExternalSurvey from './pages/ExternalSurvey';
import ReportPreviewPage from './pages/ReportPreviewPage';
import ArchivedAssessments from './pages/ArchivedAssessments';
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
          <Route
            path="/dashboard"
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
