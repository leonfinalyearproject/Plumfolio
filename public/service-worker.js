/* public/service-worker.js */
const CACHE_NAME = 'plumfolio-v1';
const STATIC_ASSETS = [
  '/Plumfolio/',
  '/Plumfolio/index.html',
  '/Plumfolio/logo192.png',
  '/Plumfolio/logo512.png',
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API calls and Supabase requests - always go to network
  const url = new URL(event.request.url);
  if (url.hostname.includes('supabase') || url.pathname.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline - serve from cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // If requesting a page, return the cached index.html (SPA)
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/Plumfolio/index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
