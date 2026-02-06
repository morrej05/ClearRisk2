import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import AuthedLayout from './components/AuthedLayout';
import ErrorBoundary from './components/ErrorBoundary';
import { ClientBrandingProvider } from './contexts/ClientBrandingContext';

// Dashboard
import ActionsDashboard from './pages/dashboard/ActionsDashboard';
import ActionRegisterPage from './pages/dashboard/ActionRegisterPage';

// Documents
import DocumentOverview from './pages/documents/DocumentOverview';
import DocumentWorkspace from './pages/documents/DocumentWorkspace';
import DocumentEvidence from './pages/documents/DocumentEvidence';
import DocumentPreviewPage from './pages/documents/DocumentPreviewPage';

// Risk Engineering
import BuildingsPage from './pages/re/BuildingsPage';
import FireProtectionPage from './pages/re/FireProtectionPage';

function App() {
  return (
    <BrowserRouter>
      <ClientBrandingProvider>
        <ErrorBoundary>
          <Routes>
            {/* Dashboard */}
            <Route
              path="/dashboard"
              element={
                <AuthedLayout>
                  <ActionsDashboard />
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
              path="/dashboard/action-register"
              element={
                <AuthedLayout>
                  <ActionRegisterPage />
                </AuthedLayout>
              }
            />

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

            {/* Risk Engineering */}
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

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ErrorBoundary>
      </ClientBrandingProvider>
    </BrowserRouter>
  );
}

export default App;
