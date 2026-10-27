// public/sw.js
// Service Worker untuk PWA SedayaClick
// Strategi: cache "app shell" statis, sedangkan panggilan ke /api/* SELALU network langsung.

const CACHE_NAME = 'sedayaclick-shell-v7';
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
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
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

  // Data dinamis (API) dan file upload: selalu network langsung, tidak pernah disajikan dari cache.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/secure-uploads/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ success: false, message: 'Gagal terhubung ke server (Koneksi terputus).' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // App shell: network-first untuk HTML/JS utama dengan fallback cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => cached || caches.match('/index.html'));
      })
  );
});

// ------------------- WEB PUSH NOTIFICATION LISTENERS -------------------
self.addEventListener('push', (event) => {
  let data = {
    title: 'SedayaClick Presensi',
    body: 'Anda memiliki notifikasi baru.',
    icon: '/icons/icon-192.png',
    badge: '/favicon.png',
    url: '/employee/dashboard.html',
    tag: 'sedayaclick-push'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/favicon.png',
    tag: data.tag || `sedayaclick-push-${Date.now()}`,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: data.url || '/employee/dashboard.html'
    },
    actions: [
      { action: 'open', title: 'Buka' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) 
    ? event.notification.data.url 
    : '/employee/dashboard.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Jika tab sudah terbuka, fokuskan tab tersebut
      for (const client of clientList) {
        if (client.url && client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Jika belum ada, buka jendela baru
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
