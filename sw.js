const CACHE = 'ringtagebuch-2.0.0'; // wird von werkzeug/paket.sh aus VERSION gesetzt
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'manifest.json', 'icons.js', 'intro.js', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

// Beim Installieren einer Version alle Dateien auf einmal frisch vom Server speichern (für offline).
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

// Sofort übernehmen. Alte Speicher danach löschen, ohne darauf zu warten.
self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
  setTimeout(() => caches.keys().then(keys => keys.filter(k => k !== CACHE).forEach(k => caches.delete(k))), 3000);
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

// Online: nicht eingreifen – der Browser lädt alles direkt und frisch von der DiskStation (die App fragt mit
// „no-cache“ nach). Nur offline kommt die beim Installieren gespeicherte Version.
// Grund: Greift der Offline-Speicher in jede Anfrage ein, konnte eine neue Version beim Update manchmal nicht
// übernehmen und das Öffnen der App blieb hängen (in Tests nachgestellt, siehe pruefung/update-test.js).
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || self.navigator.onLine) return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(caches.match(req, { ignoreSearch: true })
    .then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : fetch(req))));
});
