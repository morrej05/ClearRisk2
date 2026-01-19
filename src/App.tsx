import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ClientBrandingProvider } from './contexts/ClientBrandingContext';
import LandingPage from './pages/LandingPage';
import SignIn from './pages/SignIn';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import UpgradeSubscription from './pages/UpgradeSubscription';
import ExternalSurvey from './pages/ExternalSurvey';
import ReportPreviewPage from './pages/ReportPreviewPage';
import AssessmentsList from './pages/AssessmentsList';
import NewAssessment from './pages/NewAssessment';
import AssessmentEditor from './pages/AssessmentEditor';
import AssessmentReportPage from './pages/AssessmentReportPage';
import AssessmentRecommendationReportPage from './pages/AssessmentRecommendationReportPage';
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
            path="/assessments"
            element={
              <ProtectedRoute>
                <AssessmentsList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assessments/new"
            element={
              <ProtectedRoute>
                <NewAssessment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assessments/:id"
            element={
              <ProtectedRoute>
                <AssessmentEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assessments/:id/report"
            element={
              <ProtectedRoute>
                <AssessmentReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assessments/:id/recommendations"
            element={
              <ProtectedRoute>
                <AssessmentRecommendationReportPage />
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
