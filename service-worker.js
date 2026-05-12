// Able service worker — minimum surface needed for web push (P2 #14).
// Not a full PWA install yet; just enough to receive and display
// background push notifications from the send-push Edge Function.
//
// Register from app.html with:
//   navigator.serviceWorker.register('/service-worker.js')
//
// The worker handles two events:
//   - push: receives the payload, shows a notification.
//   - notificationclick: opens / focuses the app at the deep-link URL.

self.addEventListener('install', (event) => {
  // Skip waiting so a freshly registered worker takes over immediately.
  // Safe because we don't cache anything aggressively yet.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    // Some Resend-style pushes deliver a plain string. Fall back gracefully.
    payload = { title: 'Able', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Able';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/favicon-32.png',
    tag: payload.tag || 'able-default',
    renotify: !!payload.renotify,
    requireInteraction: !!payload.requireInteraction,
    data: { url: payload.url || '/app.html' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification?.data?.url || '/app.html';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Reuse an existing tab if one is open; otherwise spawn a new one.
    for (const client of all) {
      // Use exact hostname match — .includes() would match becomeable.app.evil.com.
      let host = '';
      try { host = new URL(client.url).hostname; } catch (_) { /* skip non-URL clients */ }
      if ((host === 'becomeable.app' || host === 'www.becomeable.app' || host === 'localhost' || host === '127.0.0.1') && 'focus' in client) {
        client.navigate(target);
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});
