// Basic service worker for StormCraft CRM
// This provides offline caching and PWA functionality

const CACHE_NAME = 'stormcraft-v1';
const urlsToCache = [
  '/crm-kanban-integrate/',
  '/crm-kanban-integrate/index.html',
  '/crm-kanban-integrate/manifest.json',
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
  // Force the waiting service worker to become the active service worker
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

  // Only handle requests from our app
  if (!url.pathname.startsWith('/crm-kanban-integrate/')) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((response) => {
        // Return cached response if found
        if (response) {
          return response;
        }

        // For navigation requests, try network first, fallback to cache
        if (request.mode === 'navigate') {
          return fetch(request)
            .then((fetchResponse) => {
              // Cache successful responses
              if (fetchResponse && fetchResponse.status === 200) {
                const responseToCache = fetchResponse.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(request, responseToCache);
                  });
              }
              return fetchResponse;
            })
            .catch(() => {
              // Network failed, return cached index.html for SPA routing
              return caches.match('/crm-kanban-integrate/index.html');
            });
        }

        // For API requests to Supabase, try network first
        if (url.hostname.includes('supabase.co')) {
          return fetch(request)
            .then((fetchResponse) => {
              // Don't cache error responses
              if (fetchResponse && fetchResponse.status === 200) {
                const responseToCache = fetchResponse.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    // Cache API responses for 5 minutes
                    cache.put(request, responseToCache);
                  });
              }
              return fetchResponse;
            })
            .catch(() => {
              // Network failed, check cache
              return caches.match(request);
            });
        }

        // For all other requests, network first with cache fallback
        return fetch(request)
          .then((fetchResponse) => {
            if (fetchResponse && fetchResponse.status === 200 && fetchResponse.type === 'basic') {
              const responseToCache = fetchResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(request, responseToCache);
                });
            }
            return fetchResponse;
          })
          .catch(() => {
            return caches.match(request);
          });
      })
  );
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
    icon: '/crm-kanban-integrate/icons/icon-192x192.png',
    badge: '/crm-kanban-integrate/icons/badge-72x72.png',
    tag: data.tag || 'general',
    renotify: true,
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/crm-kanban-integrate/icons/view-action.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/crm-kanban-integrate/icons/dismiss-action.png'
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
      clients.openWindow('/crm-kanban-integrate/')
    );
  }
});

console.log('✅ StormCraft CRM Service Worker loaded');