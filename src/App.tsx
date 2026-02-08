import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import AuthedLayout from './components/AuthedLayout';
import ErrorBoundary from './components/ErrorBoundary';
import { ClientBrandingProvider } from './contexts/ClientBrandingContext';
import { useAuth } from './contexts/AuthContext';

// ✅ Use your existing sign-in component (adjust the path to wherever it lives)
import SignIn from './pages/SignIn';

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
import { useLocation } from 'react-router-dom';

function NotFoundDebug() {
  const loc = useLocation();
  return (
    <div style={{ padding: 24 }}>
      <h2>Route not found</h2>
      <div><b>Path:</b> {loc.pathname}</div>
      <div><b>Search:</b> {loc.search}</div>
      <div><b>Hash:</b> {loc.hash}</div>
    </div>
  );
}


function App() {
  const { user, authInitialized, loading } = useAuth();
  const fallbackElement = !authInitialized || loading
    ? (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-slate-600">Loading…</div>
        </div>
      )
    : user
      ? <Navigate to="/dashboard" replace />
      : <Navigate to="/signin" replace />;

  return (
    <BrowserRouter>
      <ClientBrandingProvider>
        <ErrorBoundary>
          <Routes>
            {/* ✅ PUBLIC */}
            <Route path="/signin" element={<SignIn />} />

            {/* ✅ AUTHED */}
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

            {/* ✅ GLOBAL FALLBACK */}
            <Route path="*" element={<NotFoundDebug />} />
          </Routes>
        </ErrorBoundary>
      </ClientBrandingProvider>
    </BrowserRouter>
  );
}

export default App;