const CACHE = 'ringtagebuch-1.4.0'; // wird von werkzeug/paket.sh aus VERSION gesetzt
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'manifest.json', 'intro.js', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

// Beim Installieren alles frisch vom Server holen (nicht aus dem Browser-Zwischenspeicher)
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Immer zuerst die DiskStation fragen (mit Nachfrage, ob sich die Datei geändert hat),
// nur ohne Netz die gespeicherte Kopie nehmen. So kommt jedes Update beim nächsten Öffnen an.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Versionsprüfung nie zwischenspeichern
  if (url.pathname.endsWith('/version.json')) { e.respondWith(fetch(req, { cache: 'no-store' })); return; }
  const fresh = req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req, { cache: 'no-cache' });
  e.respondWith(
    fresh
      .then(r => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return r;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
