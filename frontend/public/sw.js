const VERSION_URL = '/version.json';
const CACHE_PREFIX = 'runholix-shell-v';
const CACHE_NAME = new URL(self.location.href).searchParams.get('v')
  ? `${CACHE_PREFIX}${new URL(self.location.href).searchParams.get('v')}`
  : `${CACHE_PREFIX}0`;
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icon.png',
];

function isApiRequest(url) {
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/ical/');
}

async function cacheShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(APP_SHELL);
}

async function getRemoteVersion() {
  try {
    const res = await fetch(VERSION_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.version || null;
  } catch {
    return null;
  }
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
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
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
      const remoteVersion = await getRemoteVersion();
      const currentVersion = new URL(self.location.href).searchParams.get('v');
      const shouldRefreshShell = remoteVersion && currentVersion && remoteVersion !== currentVersion;

      if (!shouldRefreshShell) {
        const cachedShell = await cache.match('/') || await cache.match('/index.html');
        if (cachedShell) return cachedShell;
      }

      try {
        const fresh = await fetch('/');
        cache.put('/', fresh.clone());
        return fresh;
      } catch {
        const cachedShell = await cache.match('/') || await cache.match('/index.html');
        if (cachedShell) return cachedShell;
        return Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
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
