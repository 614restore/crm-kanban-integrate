// Service worker for TrussCTR CRM
// This provides offline caching and PWA functionality

const CACHE_NAME = 'trussctr-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  // Static assets will be added by Workbox during build
];

// Install event - cache the app shell
self.addEventListener('install', (event) => {
  console.log('✅ Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('✅ Caching app shell');
        return cache.addAll(urlsToCache);
      })
  );
  // skipWaiting ensures the new SW takes over immediately on update so stale
  // cached chunks are never served after a new deployment.
  // The controllerchange reload in serviceWorker.ts is guarded by
  // hadPreviousController so first-time installs (incognito) never reload.
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Become available to all pages immediately
  self.clients.claim();
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  const isSameOrigin = url.origin === self.location.origin;
  const isAppPath = isSameOrigin;

  // Provide safe fallback for missing JSON assets requested by the app
  if (isSameOrigin && url.pathname.endsWith('.json') && request.method === 'GET') {
    event.respondWith(
      fetch(request).catch(() => {
        const body = JSON.stringify({ output: '', data: null });
        return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
      })
    );
    return;
  }

  // Only handle requests from our app path for the rest
  if (!isAppPath) {
    return;
  }

  // Never cache JS bundles - they have content hashes, always fetch fresh
  if (url.pathname.endsWith('.js')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() => {
        // If offline, try to find in cache as last resort
        return caches.match(request);
      })
    );
    return;
  }

  // Never cache HTML - always fetch fresh
  if (url.pathname.endsWith('.html') || url.pathname === '/' || request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() => {
        // If offline, serve cached HTML
        return caches.match(request).then((cachedPage) => {
          if (cachedPage) return cachedPage;
          return caches.match('/index.html');
        });
      })
    );
    return;
  }

  event.respondWith(
    // Always fetch latest app shell first to avoid stale hashed bundles.
    fetch(request)
      .then((fetchResponse) => {
        const shouldCache =
          request.method === 'GET' &&
          fetchResponse &&
          fetchResponse.status === 200 &&
          (request.mode === 'navigate' || request.destination === 'document');

        if (shouldCache) {
          const responseToCache = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }

        return fetchResponse;
      })
      .catch(() => {
        if (request.mode === 'navigate' || request.destination === 'document') {
          return caches.match(request).then((cachedPage) => {
            if (cachedPage) return cachedPage;
            return caches.match('/index.html');
          });
        }

        return caches.match(request);
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync event:', event.tag);
  
  if (event.tag === 'background-sync-photos') {
    event.waitUntil(syncPhotos());
  }
  
  if (event.tag === 'background-sync-data') {
    event.waitUntil(syncOfflineData());
  }
});

// Handle photo uploads in background
async function syncPhotos() {
  try {
    console.log('📸 Syncing photos in background...');
    // This would integrate with the sync engine
    // For now, just log that the sync was attempted
    return Promise.resolve();
  } catch (error) {
    console.error('❌ Photo sync failed:', error);
    throw error;
  }
}

// Handle other offline data sync
async function syncOfflineData() {
  try {
    console.log('💾 Syncing offline data in background...');
    // This would integrate with the sync engine
    return Promise.resolve();
  } catch (error) {
    console.error('❌ Data sync failed:', error);
    throw error;
  }
}

// Push notification handling (for future enhancement)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: data.tag || 'general',
    renotify: true,
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/icons/view-action.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/dismiss-action.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    // Open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('✅ TrussCTR Service Worker loaded');
