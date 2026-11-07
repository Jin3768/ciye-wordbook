const CACHE = 'ciye-v7';
const SHELL = [
  './', 'index.html', 'css/app.css',
  'js/util.js', 'js/data.js', 'js/entry.js', 'js/app.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-180.png',
  'icons/icon-192.png', 'icons/icon-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const isData = url.pathname.includes('/data/');
  const isNav = req.mode === 'navigate';
  if (isData) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(resp => {
      if (resp.ok) {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return resp;
    }).catch(() => new Response('', { status: 503 }))));
    return;
  }
  if (isNav) {
    e.respondWith(fetch(req).then(resp => {
      if (resp.ok) {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return resp;
    }).catch(() => caches.match(req).then(r => r || caches.match('index.html') || caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(resp => {
    if (resp.ok) {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
    }
    return resp;
  })));
});
