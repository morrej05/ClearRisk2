import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

// IMPORTANT:
// Service Workers + hard navigation cause full reloads and flicker in SPA routing,
// especially in StackBlitz / dev environments.
// Disable SW entirely unless you explicitly need it in production.

const isProd = import.meta.env.PROD;

if (isProd && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[App] Service Worker registered:', registration.scope);
      })
      .catch((error) => {
        console.warn('[App] Service Worker registration failed:', error);
      });
  });

  // ⚠️ DO NOT force window.location navigation inside SPA
  // If you ever re-enable this, it must route via React Router instead
  // navigator.serviceWorker.addEventListener('message', ...)
}

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
