const CACHE_PREFIX = 'runholix-shell-v';
const PRIVATE_CACHE_PREFIX = 'runholix-private-v';
const CACHE_NAME = new URL(self.location.href).searchParams.get('v')
  ? `${CACHE_PREFIX}${new URL(self.location.href).searchParams.get('v')}`
  : `${CACHE_PREFIX}0`;
const PRIVATE_CACHE_NAME = new URL(self.location.href).searchParams.get('v')
  ? `${PRIVATE_CACHE_PREFIX}${new URL(self.location.href).searchParams.get('v')}`
  : `${PRIVATE_CACHE_PREFIX}0`;
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icon.png',
];

function isApiRequest(url) {
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/ical/');
}

function isPrivateFileRequest(url) {
  return (
    url.pathname.startsWith('/api/upload/attachment/') ||
    url.pathname.startsWith('/api/upload/route-file/')
  );
}

async function cacheShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(APP_SHELL);
}

async function clearPrivateCache() {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith(PRIVATE_CACHE_PREFIX)).map(key => caches.delete(key)));
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    await cacheShell();
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
        keys
            .filter(key => key !== CACHE_NAME && key !== PRIVATE_CACHE_NAME)
            .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

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

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedShell = await cache.match('/') || await cache.match('/index.html');
      if (cachedShell) return cachedShell;

      try {
        const fresh = await fetch('/');
        cache.put('/', fresh.clone());
        return fresh;
      } catch {
        return Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    if (isPrivateFileRequest(url)) {
      const cache = await caches.open(PRIVATE_CACHE_NAME);
      const cached = await cache.match(request);
      const fetchPromise = fetch(request).then(response => {
        if (response && response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    }

    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const fetchPromise = fetch(request).then(response => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    }).catch(() => cached);
    return cached || fetchPromise;
  })());
});
