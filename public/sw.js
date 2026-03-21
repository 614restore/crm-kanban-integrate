// TrussCTR CRM — Service Worker
// Provides offline caching and PWA functionality for the root-deployed app.

const CACHE_NAME = 'trussctr-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ── Install: cache app shell ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing TrussCTR service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell');
      // addAll fails silently on individual 404s — catch per-URL
      return Promise.allSettled(urlsToCache.map(url => cache.add(url)));
    })
  );
  // Skip waiting so the new SW activates immediately on deploy
  self.skipWaiting();
});

// ── Activate: delete stale caches ─────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating TrussCTR service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    )
  );
  // Take control of all open clients immediately
  self.clients.claim();
});

// ── Fetch handler ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  // ── Never intercept cross-origin requests (Supabase, Stripe, etc.) ──────────
  if (!isSameOrigin) return;

  // ── API routes: always network-first, no cache ────────────────────────────
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // ── JS/CSS bundles: always network-first (content-hashed, never stale) ────
  if (url.pathname.match(/\.(js|css)$/)) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() => caches.match(request))
    );
    return;
  }

  // ── HTML / navigation: always fetch fresh; fall back to index.html offline ─
  if (
    request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html')
  ) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() =>
        caches.match('/index.html').then((r) => r || caches.match('/'))
      )
    );
    return;
  }

  // ── Static assets (images, fonts, etc.): stale-while-revalidate ──────────
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((response) => {
        if (response && response.status === 200 && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
      // Return cached version immediately if available, update in background
      return cached || networkFetch;
    })
  );
});

// ── Message handler ───────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
