// DestinIQ Service Worker — Background push notifications
// Place this file at: public/sw.js

const CACHE_NAME = 'destiniq-v1';

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// ── Push notification received ───────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'DestinIQ', body: event.data ? event.data.text() : 'You have a new message' };
  }

  const title   = data.title   || 'DestinIQ';
  const options = {
    body:    data.body    || 'Open the app to continue your journey.',
    icon:    data.icon    || '/icon-192.png',
    badge:   data.badge   || '/icon-192.png',
    tag:     data.tag     || 'destiniq',
    data:    { url: data.url || '/' },
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
    actions: data.actions || [
      { action: 'open', title: 'Open App' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If app already open, focus it
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ── Background sync (optional — for offline action logging) ──────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-actions') {
    // Future: sync offline action logs when connection restores
    event.waitUntil(Promise.resolve());
  }
});
