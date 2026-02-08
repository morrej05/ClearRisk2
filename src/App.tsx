// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import AuthedLayout from './components/AuthedLayout';
import ErrorBoundary from './components/ErrorBoundary';
import { ClientBrandingProvider } from './contexts/ClientBrandingContext';
import { useAuth } from './contexts/AuthContext';

// Public
import SignIn from './pages/SignIn';

// ✅ Common dashboard (two tiles + AI summary)
import CommonDashboard from './pages/CommonDashboard';

// Dashboards
import FireSafetyDashboard from './pages/dashboard/FireSafetyDashboard';
import ActionsDashboard from './pages/dashboard/ActionsDashboard';
import ActionRegisterPage from './pages/dashboard/ActionRegisterPage';

// EziRisk pages
import ImpairmentsPage from './pages/ezirisk/ImpairmentsPage';
import LibraryPage from './pages/ezirisk/LibraryPage';

// Documents
import DocumentOverview from './pages/documents/DocumentOverview';
import DocumentWorkspace from './pages/documents/DocumentWorkspace';
import DocumentEvidence from './pages/documents/DocumentEvidence';
import DocumentPreviewPage from './pages/documents/DocumentPreviewPage';

// Risk Engineering
import BuildingsPage from './pages/re/BuildingsPage';
import FireProtectionPage from './pages/re/FireProtectionPage';

function App() {
  const { user, authInitialized, loading } = useAuth();

  // Canonical "what should happen if we hit / or an unknown route"
  const fallbackElement =
    !authInitialized || loading ? (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Loading…</div>
      </div>
    ) : user ? (
      <Navigate to="/dashboard" replace />
    ) : (
      <Navigate to="/signin" replace />
    );

  return (
    <BrowserRouter>
      <ClientBrandingProvider>
        <ErrorBoundary>
          <Routes>
            {/* PUBLIC */}
            <Route path="/signin" element={<SignIn />} />

            {/* Root entry */}
            <Route path="/" element={fallbackElement} />

            {/* AUTHED */}
            <Route element={<AuthedLayout />}>
              {/* Canonical dashboard */}
              <Route path="/dashboard" element={<CommonDashboard />} />

              {/* Legacy alias */}
              <Route path="/common-dashboard" element={<Navigate to="/dashboard" replace />} />

              {/* Fire Safety area */}
              <Route path="/dashboard/fire-safety" element={<FireSafetyDashboard />} />
              <Route path="/dashboard/actions" element={<ActionsDashboard />} />
              <Route path="/dashboard/action-register" element={<ActionRegisterPage />} />

              {/* EziRisk */}
              <Route path="/impairments" element={<ImpairmentsPage />} />
              <Route path="/library" element={<LibraryPage />} />

              {/* Documents */}
              <Route path="/documents/:id" element={<DocumentOverview />} />
              <Route path="/documents/:id/workspace" element={<DocumentWorkspace />} />
              <Route path="/documents/:id/evidence" element={<DocumentEvidence />} />
              <Route path="/documents/:id/preview" element={<DocumentPreviewPage />} />

              {/* Risk Engineering pages */}
              <Route path="/documents/:id/re/buildings" element={<BuildingsPage />} />
              <Route path="/documents/:id/re/fire-protection" element={<FireProtectionPage />} />

              {/* TEMP: keep these only if PrimaryNavigation still points at them */}
              <Route path="/assessments" element={<Navigate to="/dashboard" replace />} />
              <Route path="/reports" element={<Navigate to="/dashboard" replace />} />
              <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
              <Route path="/platform" element={<Navigate to="/dashboard" replace />} />
            </Route>

            {/* Global fallback */}
            <Route path="*" element={fallbackElement} />
          </Routes>
        </ErrorBoundary>
      </ClientBrandingProvider>
    </BrowserRouter>
  );
}

export default App;
