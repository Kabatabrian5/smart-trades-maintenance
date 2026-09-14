const CACHE_NAME = 'smart-trades-safe-v1';

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    self.clients.claim().then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Let native static assets and the bot builder bundle pass through directly.
  if (url.pathname.startsWith('/bot-builder/') || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/static/')) {
    return;
  }

  // Avoid caching HTML navigations inside the generated SPA shell.
  if (request.mode === 'navigate') {
    return;
  }

  event.respondWith(
    fetch(request).catch(() => {
      return new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain' },
      });
    })
  );
});
