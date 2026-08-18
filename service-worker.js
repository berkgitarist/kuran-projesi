const CACHE_VERSION = 'kuran-teyit-v64';

const STATIC_CACHE =
  `${CACHE_VERSION}-static`;

const DATA_CACHE =
  `${CACHE_VERSION}-data`;

const APP_SHELL = [
  './',
  './index.html',
  './guide.html',
  './evidence.html',
  './privacy.html',
  './licenses.html',
  './manifest.webmanifest',

  './css/style.css?v=61',
  './css/style.css?v=63',
  './css/evidence.css?v=62',

  './js/script.js?v=64',
  './js/evidence.js?v=64',
  './js/guide.js?v=64',

  './js/modules/core-utils.js',
  './js/modules/navigation-utils.js',
  './js/modules/meal-normalizer.js',
  './js/modules/note-validator.js',
  './js/modules/platform-utils.js',

  './assets/images/logo-main.png',
  './assets/images/logo-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        Promise.allSettled(
          APP_SHELL.map((url) =>
            cache.add(url)
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheKeys) =>
        Promise.all(
          cacheKeys
            .filter(
              (key) =>
                key.startsWith('kuran-teyit-') &&
                key !== STATIC_CACHE &&
                key !== DATA_CACHE
            )
            .map((key) =>
              caches.delete(key)
            )
        )
      )
      .then(() =>
        self.clients.claim()
      )
  );
});

async function cacheFirst(
  request,
  cacheName
) {
  const cache =
    await caches.open(cacheName);

  const cachedResponse =
    await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse =
    await fetch(request);

  if (networkResponse.ok) {
    await cache.put(
      request,
      networkResponse.clone()
    );
  }

  return networkResponse;
}

async function networkFirst(request) {
  const cache =
    await caches.open(STATIC_CACHE);

  try {
    const networkResponse =
      await fetch(request, {
        cache: 'no-cache'
      });

    if (networkResponse.ok) {
      await cache.put(
        request,
        networkResponse.clone()
      );
    }

    return networkResponse;
  } catch (error) {
    const cachedResponse =
      await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    return cache.match('./index.html');
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  const url =
    new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request)
    );

    return;
  }

  if (
    url.pathname.includes('/data/') ||
    url.pathname.endsWith('.json')
  ) {
    event.respondWith(
      cacheFirst(
        request,
        DATA_CACHE
      )
    );

    return;
  }

  if (
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js')
  ) {
    event.respondWith(
      networkFirst(request)
    );

    return;
  }

  event.respondWith(
    cacheFirst(
      request,
      STATIC_CACHE
    )
  );
});