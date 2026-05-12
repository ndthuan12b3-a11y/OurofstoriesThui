const CACHE_NAME = 'hub-love-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.ico',
];

// Install Event
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only cache GET requests
  if (event.request.method !== 'GET') return;

  // Special handling for Map Tiles (OpenStreetMap)
  const isMapTile = url.hostname.includes('tile.openstreetmap.org');
  const isStaticAsset = url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|woff2|css|js)$/i);
  const isAudio = url.pathname.match(/\.(mp3|wav|ogg)$/i) || url.pathname.includes('/storage/v1/object/public/music');

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached version if found
      if (cachedResponse) {
        // For map tiles, static assets, and audio, return cached version and update in background
        if (isMapTile || isStaticAsset || isAudio) {
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          }).catch(() => {}); // Ignore background fetch errors
        }
        return cachedResponse;
      }

      // If not in cache, fetch from network
      return fetch(event.request).then((networkResponse) => {
        // Cache valid responses for static assets, map tiles, and audio
        if (networkResponse && networkResponse.status === 200 && (isMapTile || isAudio || networkResponse.type === 'basic')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});
