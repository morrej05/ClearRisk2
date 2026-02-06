import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import LandingPage from './pages/LandingPage';
import SignIn from './pages/SignIn';
import ExternalSurvey from './pages/ExternalSurvey';
import ClientDocumentView from './pages/ClientDocumentView';
import PublicDocumentViewer from './pages/PublicDocumentViewer';

import AuthedLayout from './components/AuthedLayout';
import ErrorBoundary from './components/ErrorBoundary';
import { ClientBrandingProvider } from './contexts/ClientBrandingContext';

import DashboardPage from './pages/dashboard/DashboardPage';
import ActionRegisterPage from './pages/dashboard/ActionRegisterPage';
import ActionsDashboard from './pages/dashboard/ActionsDashboard';

import DocumentOverview from './pages/documents/DocumentOverview';
import DocumentWorkspace from './pages/documents/DocumentWorkspace';
import DocumentEvidence from './pages/documents/DocumentEvidence';
import DocumentPreviewPage from './pages/documents/DocumentPreviewPage';

import BuildingsPage from './pages/re/BuildingsPage';
import FireProtectionPage from './pages/re/FireProtectionPage';

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
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/external/:token" element={<ExternalSurvey />} />
            <Route path="/client/document/:token" element={<ClientDocumentView />} />
            <Route path="/public/documents" element={<PublicDocumentViewer />} />

            {/* Redirect legacy dashboard paths */}
            <Route path="/legacy-dashboard" element={<Navigate to="/dashboard" replace />} />
            <Route path="/common-dashboard" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard/fire" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard/explosion" element={<Navigate to="/dashboard" replace />} />
            <Route path="/super-admin" element={<Navigate to="/platform" replace />} />
            <Route path="/legacy-admin" element={<Navigate to="/admin" replace />} />

            {/* All authed app pages share ONE AuthedLayout instance */}
            <Route element={<AuthedLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/dashboard/action-register" element={<ActionRegisterPage />} />
              <Route path="/dashboard/actions" element={<ActionsDashboard />} />

              <Route path="/documents/:id" element={<DocumentOverview />} />
              <Route path="/documents/:id/workspace" element={<DocumentWorkspace />} />
              <Route path="/documents/:id/evidence" element={<DocumentEvidence />} />
              <Route path="/documents/:id/preview" element={<DocumentPreviewPage />} />

              {/* RE dedicated pages MUST also live under AuthedLayout */}
              <Route path="/documents/:id/re/buildings" element={<BuildingsPage />} />
              <Route path="/documents/:id/re/fire-protection" element={<FireProtectionPage />} />

              <Route path="/assessments" element={<AssessmentsPage />} />
              <Route path="/assessments/new" element={<NewAssessmentPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/reports/combined" element={<CombinedReportsPage />} />
              <Route path="/impairments" element={<ImpairmentsPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/upgrade" element={<UpgradeSubscription />} />
              <Route path="/report/:surveyId" element={<ReportPreviewPage />} />
              <Route path="/archived-assessments" element={<ArchivedAssessments />} />

              {/* Admin */}
              <Route
                path="/admin/*"
                element={
                  <AdminRoute>
                    <AdminLayout>
                      <AdminPage />
                    </AdminLayout>
                  </AdminRoute>
                }
              />

              {/* Platform */}
              <Route
                path="/platform/*"
                element={
                  <PlatformAdminRoute>
                    <PlatformLayout>
                      <SuperAdminDashboard />
                    </PlatformLayout>
                  </PlatformAdminRoute>
                }
              />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </ClientBrandingProvider>
    </BrowserRouter>
  );
}

export default App;
