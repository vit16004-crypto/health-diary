const CACHE_VERSION = 'v2';
const CACHE_NAME = 'health-cache-' + CACHE_VERSION;
const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'icon.svg',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js'
];

// Установка: кладём основные файлы в новый кэш и сразу перехватываем управление
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// Активация: удаляем кэши старых версий, берём страницы под контроль
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k.startsWith('health-cache-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const accept = req.headers.get('accept') || '';
  const isPage = req.mode === 'navigate' || accept.includes('text/html');

  // Страницы: сперва сеть (чтобы обновления приходили сразу), офлайн — из кэша
  if (isPage) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('index.html')))
    );
    return;
  }

  // Остальное (CDN, манифест, иконки): кэш, при отсутствии — сеть
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
