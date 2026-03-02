const CACHE_NAME = 'xitchat-mesh-v1';
const OFFLINE_URL = '/index.html';

// iOS PWA Fix: Ensure proper scope handling
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache the critical manifest and entry point
      return cache.addAll([
        '/', 
        '/index.html', 
        '/manifest.json',
        '/icon-192.png',
        '/icon-512.png'
      ]);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // --- 1. CRITICAL: IGNORE REAL-TIME & HARDWARE TRAFFIC ---
  // Nostr uses WSS, Ably uses WSS/HTTPS long polling.
  // We must let these pass through to the network/local mesh directly.
  if (
    url.protocol === 'ws:' ||
    url.protocol === 'wss:' || 
    url.pathname.includes('/api/') ||
    url.pathname.includes('ably') || 
    url.pathname.includes('nostr')
  ) {
    return; // Let the browser handle it (Network Only)
  }

  // APK files must never be cached or replaced by offline HTML fallback.
  if (url.pathname.endsWith('.apk')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // --- 2. CACHE ASSETS (JS, CSS, WASM, FONTS) ---
  // Nostr/Crypto libraries often use WASM. We must cache it.
  if (
    url.pathname.includes('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.wasm') || // <--- ADDED WASM SUPPORT
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        // Return cache if found
        if (cached) return cached;

        // Otherwise fetch and cache
        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return networkResponse;
        });
      })
    );
    return;
  }

  // --- 3. NAVIGATION (HTML) ---
  // For the PWA to open when offline, we need to serve index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // If Offline: Return the cached index.html
          // This allows your React app to load, run your `useEffect`,
          // and start the Bluetooth/Mesh listeners.
          return caches.match('/index.html');
        })
    );
  }
});
