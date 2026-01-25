/**
 * Service Worker for EziRisk
 * Handles safe client navigation without absolute URLs
 */

const SW_VERSION = '1.0.0';
const CACHE_NAME = `ezirisk-cache-${SW_VERSION}`;

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing version', SW_VERSION);
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating version', SW_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

/**
 * Safe client refresh that avoids absolute URL navigation errors
 * This replaces the problematic _refreshClients pattern
 */
async function refreshClients(targetUrl) {
  try {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    for (const client of clients) {
      try {
        // Extract only the pathname, search, and hash from the target URL
        // This avoids "Cannot navigate to URL" errors in credentialless contexts
        let relativePath;

        if (typeof targetUrl === 'string') {
          try {
            const url = new URL(targetUrl, self.location.origin);
            relativePath = `${url.pathname}${url.search}${url.hash}`;
          } catch (e) {
            // If URL parsing fails, assume it's already relative
            relativePath = targetUrl.startsWith('/') ? targetUrl : `/${targetUrl}`;
          }
        } else {
          relativePath = '/';
        }

        // Option A: Try to navigate with relative path
        // This is wrapped in try-catch because navigate() may not be available
        // or may fail in certain contexts
        if (client.navigate && typeof client.navigate === 'function') {
          try {
            await client.navigate(relativePath);
          } catch (navError) {
            // If navigation fails, fall back to postMessage
            console.warn('[Service Worker] Navigation failed, using postMessage fallback:', navError);
            client.postMessage({
              type: 'NAVIGATE',
              url: relativePath
            });
          }
        } else {
          // Option B: Post message to client to handle navigation
          client.postMessage({
            type: 'NAVIGATE',
            url: relativePath
          });
        }
      } catch (clientError) {
        // Continue with other clients if one fails
        console.warn('[Service Worker] Failed to refresh client:', clientError);
      }
    }
  } catch (error) {
    // Don't throw - just log the error
    console.error('[Service Worker] Error in refreshClients:', error);
  }
}

/**
 * Handle messages from clients
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'REFRESH_CLIENTS') {
    refreshClients(event.data.url || '/');
  }
});

/**
 * Basic fetch handler - no caching for now to avoid stale data issues
 */
self.addEventListener('fetch', (event) => {
  // Let all requests pass through without interception
  // This ensures the app works normally
  return;
});

console.log('[Service Worker] Loaded version', SW_VERSION);
