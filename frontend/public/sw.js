// sw.js - VRSEC Incubation Centre Service Worker
// Internet-only PWA application shell caching.
// STRICT INVARIANTS:
// 1. Static asset caching for fast shell launch in production.
// 2. Internet-only: All API and mutation requests (Supabase, /api/) bypass cache completely.
// 3. No sensitive authenticated data cached.
// 4. Development hosts (localhost / 127.0.0.1 / ::1): COMPLETE BYPASS - Immediately unregisters,
//    clears all caches, and NEVER attaches any fetch listeners.

const isDevHost =
  typeof self !== 'undefined' &&
  self.location &&
  (self.location.hostname === 'localhost' ||
    self.location.hostname === '127.0.0.1' ||
    self.location.hostname === '::1' ||
    self.location.hostname === '[::1]');

if (isDevHost) {
  // On development hosts, strictly self-unregister, clear all caches, and DO NOT intercept fetch
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.matchAll({ type: 'window' }))
        .then((clients) => {
          for (const client of clients) {
            if (client.url && 'navigate' in client) {
              client.navigate(client.url);
            }
          }
        })
    );
  });
} else {
  // PRODUCTION ONLY PWA APPLICATION SHELL CACHING
  const CACHE_NAME = 'vrsec-incubation-shell-v1';

  const STATIC_SHELL_ASSETS = [
    '/',
    '/index.html',
    '/manifest.webmanifest',
    '/manifest.json',
    '/favicon.svg',
    '/pwa-192x192.png',
    '/pwa-512x512.png',
    '/pwa-maskable-512x512.png',
    '/apple-touch-icon.png'
  ];

  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(STATIC_SHELL_ASSETS);
      }).then(() => self.skipWaiting())
    );
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((keys) => {
        return Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        );
      }).then(() => self.clients.claim())
    );
  });

  self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // 1. Never cache non-GET requests (mutations, uploads, posts)
    if (req.method !== 'GET') {
      return;
    }

    // 2. Never cache API, Supabase, or hardware endpoints (strictly internet-only)
    if (
      url.pathname.startsWith('/api') ||
      url.hostname.includes('supabase.co') ||
      url.port === '8001' ||
      url.port === '8000'
    ) {
      return; // Pass through directly to network
    }

    // 3. Navigation requests: Network-first, fallback to cached index.html shell
    if (req.mode === 'navigate') {
      event.respondWith(
        fetch(req).catch(() => {
          return caches.match('/index.html');
        })
      );
      return;
    }

    // 4. Static assets (CSS, JS chunks, fonts, images): Cache-first with network fallback
    if (
      url.origin === self.location.origin &&
      (url.pathname.startsWith('/assets/') ||
       url.pathname.endsWith('.js') ||
       url.pathname.endsWith('.css') ||
       url.pathname.endsWith('.svg') ||
       url.pathname.endsWith('.png') ||
       url.pathname.endsWith('.woff2'))
    ) {
      event.respondWith(
        caches.match(req).then((cached) => {
          if (cached) return cached;
          return fetch(req).then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseToCache);
            });
            return response;
          });
        })
      );
      return;
    }

    // 5. Default: Network with cache fallback
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
  });
}
