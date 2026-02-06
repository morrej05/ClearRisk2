import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import AuthedLayout from './components/AuthedLayout';
import ErrorBoundary from './components/ErrorBoundary';
import { ClientBrandingProvider } from './contexts/ClientBrandingContext';

// ✅ Add your sign-in page (adjust path to your actual file)
import SignInPage from './pages/auth/SignInPage';

// Dashboard
import FireSafetyDashboard from './pages/dashboard/FireSafetyDashboard';
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
            {/* ✅ PUBLIC ROUTES (outside AuthedLayout) */}
            <Route path="/signin" element={<SignInPage />} />

            {/* One shared authed shell */}
            <Route element={<AuthedLayout />}>
              {/* Dashboard */}
              <Route path="/dashboard" element={<FireSafetyDashboard />} />
              <Route path="/dashboard/actions" element={<ActionsDashboard />} />
              <Route path="/dashboard/action-register" element={<ActionRegisterPage />} />

              {/* Documents */}
              <Route path="/documents/:id" element={<DocumentOverview />} />
              <Route path="/documents/:id/workspace" element={<DocumentWorkspace />} />
              <Route path="/documents/:id/evidence" element={<DocumentEvidence />} />
              <Route path="/documents/:id/preview" element={<DocumentPreviewPage />} />

              {/* Risk Engineering dedicated pages */}
              <Route path="/documents/:id/re/buildings" element={<BuildingsPage />} />
              <Route path="/documents/:id/re/fire-protection" element={<FireProtectionPage />} />
            </Route>

            {/* ✅ GLOBAL FALLBACK: never bounce logged-out users into AuthedLayout */}
            <Route path="*" element={<Navigate to="/signin" replace />} />
          </Routes>
        </ErrorBoundary>
      </ClientBrandingProvider>
    </BrowserRouter>
  );
}

export default App;
