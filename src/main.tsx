import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

const maybeInitMonitoring = () => {
  const mf = (window as any).mf || (window as any).MF;
  const mfParams = import.meta.env.VITE_MF_PARAMS;

  if (!mf || typeof mf.init !== 'function' || !mfParams) {
    return;
  }

  try {
    mf.init(mfParams);
  } catch (error) {
    console.warn('[MF] Monitoring init skipped:', error);
  }
};

maybeInitMonitoring();

// Register service worker for safe navigation handling
if ('serviceWorker' in navigator) {
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

  // Handle navigation messages from service worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'NAVIGATE') {
      // Navigate using relative URL only
      const url = event.data.url;
      if (url && typeof url === 'string') {
        window.location.href = url;
      }
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
