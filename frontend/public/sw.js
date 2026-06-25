import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

// Injected by vite-plugin-pwa at build time — contains all hashed assets
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const PRIVATE_CACHE_PREFIX = 'runholix-private-v';
const PRIVATE_CACHE_NAME = `${PRIVATE_CACHE_PREFIX}1`;

function isApiRequest(url) {
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/ical/');
}

function isPrivateFileRequest(url) {
  return (
    url.pathname.startsWith('/api/upload/attachment/') ||
    url.pathname.startsWith('/api/upload/route-file/')
  );
}

async function clearPrivateCache() {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith(PRIVATE_CACHE_PREFIX)).map(key => caches.delete(key)));
}

self.addEventListener('message', event => {
  if (event.data?.type === 'CLEAR_PRIVATE_CACHE') {
    event.waitUntil(clearPrivateCache());
  }
});

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let payload = {};
    try {
      payload = event.data ? event.data.json() : {};
    } catch {
      payload = {};
    }
    const title = payload.title || 'Runholix reminder';
    const options = {
      body: payload.body || '',
      icon: '/icon.png',
      badge: '/icon.png',
      tag: payload.tag || undefined,
      data: { url: payload.url || '/' },
    };
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) {
          await client.navigate(targetUrl);
        }
        return;
      }
    }
    await self.clients.openWindow(targetUrl);
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin || isApiRequest(url)) {
    return;
  }

  // Private files: cache-first with network fallback
  if (isPrivateFileRequest(url)) {
    event.respondWith((async () => {
      try {
        const cache = await caches.open(PRIVATE_CACHE_NAME);
        const cached = await cache.match(request);
        const networkFetch = fetch(request).then(response => {
          if (response?.ok) cache.put(request, response.clone());
          return response;
        }).catch(() => null);
        return cached || await networkFetch || Response.error();
      } catch {
        return Response.error();
      }
    })());
  }

  // All other requests are handled by workbox precacheAndRoute above
});