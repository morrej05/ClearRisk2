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
            {/* Everything in-app shares ONE AuthedLayout instance */}
            <Route element={<AuthedLayout />}>
              {/* Dashboard */}
              <Route path="/dashboard" element={<ActionsDashboard />} />
              <Route path="/dashboard/actions" element={<ActionsDashboard />} />
              <Route path="/dashboard/action-register" element={<ActionRegisterPage />} />

              {/* Documents */}
              <Route path="/documents/:id" element={<DocumentOverview />} />
              <Route path="/documents/:id/workspace" element={<DocumentWorkspace />} />
              <Route path="/documents/:id/evidence" element={<DocumentEvidence />} />
              <Route path="/documents/:id/preview" element={<DocumentPreviewPage />} />

              {/* Risk Engineering */}
              <Route path="/documents/:id/re/buildings" element={<BuildingsPage />} />
              <Route path="/documents/:id/re/fire-protection" element={<FireProtectionPage />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </ErrorBoundary>
      </ClientBrandingProvider>
    </BrowserRouter>
  );
}

export default App;
