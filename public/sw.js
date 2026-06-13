// DestinIQ Service Worker — handles push notifications and brings user back to app
const APP_URL = "https://destiniq.vercel.app";

// ── PUSH NOTIFICATION HANDLER ─────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = {};
  try { data = event.data.json(); } catch { data = { title: "DestinIQ", body: event.data.text() }; }

  const options = {
    body: data.body || "Tap to open DestinIQ",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.tag || "destiniq-nudge",
    renotify: true,
    requireInteraction: false,
    data: { url: data.url || APP_URL },
    actions: [
      { action: "open", title: "Open app" },
      { action: "dismiss", title: "Later" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "DestinIQ", options)
  );
});

// ── NOTIFICATION CLICK — brings user back to app ───────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const urlToOpen = event.notification.data?.url || APP_URL;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes("destiniq.vercel.app") && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});

// ── INSTALL & ACTIVATE ────────────────────────────────────────────────────────
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(clients.claim()));
