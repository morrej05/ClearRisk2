import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import LandingPage from './pages/LandingPage';
import SignIn from './pages/SignIn';
import ExternalSurvey from './pages/ExternalSurvey';
import ClientDocumentView from './pages/ClientDocumentView';
import PublicDocumentViewer from './pages/PublicDocumentViewer';

import AuthedLayout from './components/AuthedLayout';
import ErrorBoundary from './components/ErrorBoundary';
import { ClientBrandingProvider } from './contexts/ClientBrandingContext';

// Dashboard (confirmed paths from your tree)
import ActionRegisterPage from './pages/dashboard/ActionRegisterPage';
import ActionsDashboard from './pages/dashboard/ActionsDashboard';

// Documents (confirmed paths from your tree)
import DocumentOverview from './pages/documents/DocumentOverview';
import DocumentWorkspace from './pages/documents/DocumentWorkspace';
import DocumentEvidence from './pages/documents/DocumentEvidence';
import DocumentPreviewPage from './pages/documents/DocumentPreviewPage';

// RE pages (these existed earlier in your App.tsx)
import BuildingsPage from './pages/re/BuildingsPage';
import FireProtectionPage from './pages/re/FireProtectionPage';

// These routes existed in your earlier App.tsx.
// If any of these imports fail, we’ll correct them based on your tree next.
import AssessmentsPage from './pages/AssessmentsPage';
import NewAssessmentPage from './pages/NewAssessmentPage';
import ReportsPage from './pages/ReportsPage';
import CombinedReportsPage from './pages/CombinedReportsPage';
import ImpairmentsPage from './pages/ImpairmentsPage';
import LibraryPage from './pages/LibraryPage';
import UpgradeSubscription from './pages/UpgradeSubscription';
import ReportPreviewPage from './pages/ReportPreviewPage';
import ArchivedAssessments from './pages/ArchivedAssessments';

import AdminRoute from './components/admin/AdminRoute';
import AdminLayout from './components/admin/AdminLayout';
import AdminPage from './pages/admin/AdminPage';

import PlatformAdminRoute from './components/platform/PlatformAdminRoute';
import PlatformLayout from './components/platform/PlatformLayout';
import SuperAdminDashboard from './pages/platform/SuperAdminDashboard';

function App() {
  return (
    <BrowserRouter>
      <ClientBrandingProvider>
        <ErrorBoundary>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/external/:token" element={<ExternalSurvey />} />
            <Route path="/client/document/:token" element={<ClientDocumentView />} />
            <Route path="/public/documents" element={<PublicDocumentViewer />} />

            {/* Dashboard */}
            <Route
              path="/dashboard"
              element={
                <AuthedLayout>
                  {/* If you have a dedicated DashboardPage, swap it back in later */}
                  <ActionsDashboard />
                </AuthedLayout>
              }
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

            {/* Legacy redirects */}
            <Route path="/legacy-dashboard" element={<Navigate to="/dashboard" replace />} />
            <Route path="/common-dashboard" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard/fire" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard/explosion" element={<Navigate to="/dashboard" replace />} />

            {/* Documents */}
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
            <Route
              path="/documents/:id/preview"
              element={
                <AuthedLayout>
                  <DocumentPreviewPage />
                </AuthedLayout>
              }
            />

            {/* RE */}
            <Route
              path="/documents/:id/re/buildings"
              element={
                <AuthedLayout>
                  <BuildingsPage />
                </AuthedLayout>
              }
            />
            <Route
              path="/documents/:id/re/fire-protection"
              element={
                <AuthedLayout>
                  <FireProtectionPage />
                </AuthedLayout>
              }
            />

            {/* Other app pages */}
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

            {/* Admin */}
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

            {/* Platform */}
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

            <Route
              path="/archived-assessments"
              element={
                <AuthedLayout>
                  <ArchivedAssessments />
                </AuthedLayout>
              }
            />

            <Route path="/super-admin" element={<Navigate to="/platform" replace />} />
            <Route path="/legacy-admin" element={<Navigate to="/admin" replace />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </ClientBrandingProvider>
    </BrowserRouter>
  );
}

export default App;
