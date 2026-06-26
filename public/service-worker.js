const CACHE_NAME = 'nails-by-karina-v5';
const STATIC_ASSETS = [
    '/',
    '/styles.css',
    '/servicos.js',
    '/manifest.webmanifest',
    '/icon.svg',
    '/lookbook-1.svg',
    '/lookbook-2.svg',
    '/lookbook-3.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        ))
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (url.pathname.startsWith('/api/')) return;
    event.respondWith(
        caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
});
