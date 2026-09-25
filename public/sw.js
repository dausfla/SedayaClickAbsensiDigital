// public/sw.js
// Service Worker sederhana untuk mendukung instalasi PWA standalone penuh.
// Strategi: cache "app shell" (halaman statis + JS/CSS), sedangkan panggilan
// ke /api/* SELALU diambil langsung dari network (data absensi tidak boleh basi/cache).

const CACHE_NAME = 'sedayaclick-shell-v3';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/employee/dashboard.html',
  '/admin/dashboard.html',
  '/superadmin/dashboard.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {
      // Jika salah satu asset gagal di-cache saat install (mis. dijalankan
      // sebelum server ready), jangan gagalkan seluruh instalasi SW.
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Data dinamis (API) dan file upload: selalu network, tidak pernah dari cache.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/secure-uploads/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // App shell: cache-first agar aplikasi tetap bisa dibuka (walau fitur live
  // seperti kamera/GPS/API tetap butuh koneksi) saat sinyal lemah.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request)
          .then((response) => {
            if (response && response.status === 200 && event.request.method === 'GET') {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => caches.match('/index.html'))
      );
    })
  );
});
