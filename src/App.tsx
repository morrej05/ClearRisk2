// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import AuthedLayout from './components/AuthedLayout';
import ErrorBoundary from './components/ErrorBoundary';
import { ClientBrandingProvider } from './contexts/ClientBrandingContext';
import { useAuth } from './contexts/AuthContext';

// Public
import SignIn from './pages/SignIn';

// Dashboard
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

  // Single source of truth for “where should this go?”
  // - While hydrating: show a visible loader
  // - Authed: go to /dashboard
  // - Unauthed: go to /signin
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
            {/* ✅ PUBLIC */}
            <Route path="/signin" element={<SignIn />} />

            {/* ✅ ROOT ENTRY */}
            <Route path="/" element={fallbackElement} />

            {/* ✅ AUTHED (nested under layout) */}
            <Route element={<AuthedLayout />}>
              {/* Legacy / nav aliases (stop “No routes matched…”) */}
              <Route path="/common-dashboard" element={<Navigate to="/dashboard" replace />} />
              <Route path="/assessments" element={<Navigate to="/dashboard" replace />} />
              <Route path="/reports" element={<Navigate to="/dashboard" replace />} />
              <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
              <Route path="/platform" element={<Navigate to="/dashboard" replace />} />

              {/* Dashboard */}
              <Route path="/dashboard" element={<FireSafetyDashboard />} />
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

              {/* Risk Engineering dedicated pages */}
              <Route path="/documents/:id/re/buildings" element={<BuildingsPage />} />
              <Route path="/documents/:id/re/fire-protection" element={<FireProtectionPage />} />
            </Route>

            {/* ✅ GLOBAL FALLBACK (IMPORTANT: do NOT send authed users to /signin) */}
            <Route path="*" element={fallbackElement} />
          </Routes>
        </ErrorBoundary>
      </ClientBrandingProvider>
    </BrowserRouter>
  );
}

export default App;
