// Service worker: network-first with cache fallback.
// Lets the user view the plan, recipes and shopping list offline (with the
// last seen data) and makes the app installable.
const CACHE = 'menu-v4';

const PRECACHE = [
  '/',
  '/css/styles.css',
  '/js/utils.js',
  '/js/auth-view.js',
  '/js/blocks.js',
  '/js/data.js',
  '/js/recipes-view.js',
  '/js/validator-view.js',
  '/js/adjust-view.js',
  '/js/equivalences-view.js',
  '/js/plan-view.js',
  '/js/shopping-view.js',
  '/js/log-view.js',
  '/js/app.js',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only GET; mutations (POST/PUT/DELETE) and AI always go to the network.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // AI, backup and auth always go to the network (never cached).
  if (url.pathname.startsWith('/api/ai/') ||
      url.pathname.startsWith('/api/backup') ||
      url.pathname.startsWith('/api/auth/')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then(hit => hit || Response.error()))
  );
});
