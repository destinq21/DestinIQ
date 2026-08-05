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

  let title = data.title || 'DestinIQ';
  let body  = data.body  || 'Open the app to continue your journey.';

  // ── FRESHNESS GUARD ─────────────────────────────────────────────────────────
  // A push can be QUEUED while the device is offline and delivered hours later
  // when it reconnects — so a 7am "Good morning" can land at 7:44pm. This handler
  // runs at DELIVERY time, so we check the real clock here and neutralise a
  // mistimed time-of-day message instead of showing it at the wrong time.
  // (Best paired with a short TTL on the server so these expire before delivery.)
  try {
    const hour = new Date().getHours();
    const text = (title + ' ' + body).toLowerCase();
    const slot = data.slot ||
      (/good morning|morning/.test(text)        ? 'morning'   :
       /midday|afternoon/.test(text)            ? 'afternoon' :
       /evening|reflection|good night|night/.test(text) ? 'evening' : '');
    const stale =
      (slot === 'morning'   && hour >= 11) ||             // morning msg after ~11am
      (slot === 'afternoon' && (hour < 11 || hour >= 17)) ||
      (slot === 'evening'   && hour < 16);                // evening msg before ~4pm
    if (stale) {
      // Don't greet "good morning" in the evening — show a time-neutral nudge instead.
      title = 'DestinIQ';
      body  = 'Your check-in is waiting whenever you\u2019re ready.';
    }
  } catch (_) { /* if anything goes wrong, fall through and show the original */ }

  const options = {
    body,
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