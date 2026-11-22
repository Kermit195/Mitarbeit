// Service Worker „Mitarbeit“
// WICHTIG: Bei jedem Update die VERSION erhöhen – nur dann erkennt das iPad die neue Version.
const VERSION = '3.0.0';
const CACHE = 'mitarbeit-v' + VERSION;

const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'css/app.css',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'js/app.js',
  'js/backup.js',
  'js/crypto.js',
  'js/db.js',
  'js/defaults.js',
  'js/explain.js',
  'js/feedback.js',
  'js/grading.js',
  'js/model.js',
  'js/nav.js',
  'js/sw-client.js',
  'js/ui.js',
  'js/undo.js',
  'js/util.js',
  'js/views/auth.js',
  'js/views/backupui.js',
  'js/views/common.js',
  'js/views/entries.js',
  'js/views/group.js',
  'js/views/periods.js',
  'js/views/pinpad.js',
  'js/views/present.js',
  'js/views/rate.js',
  'js/views/seatplan.js',
  'js/views/settings.js',
  'js/views/start.js',
  'js/views/students.js',
  'js/views/wizard.js',
  'js/views/written.js',
];

self.addEventListener('install', event => {
  // HTTP-Cache umgehen, damit wirklich die neuen Dateien geladen werden
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
  );
  // Kein automatisches skipWaiting: Die App fragt erst nach („Update verfügbar“).
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('mitarbeit-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  const msg = event.data || {};
  if (msg.type === 'SKIP_WAITING') self.skipWaiting();
  if (msg.type === 'GET_VERSION' && event.source) event.source.postMessage({ type: 'VERSION', version: VERSION });
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE).then(c => c.match('index.html')).then(r => r || fetch(req))
    );
    return;
  }
  event.respondWith(
    caches.open(CACHE).then(c => c.match(req, { ignoreSearch: true })).then(r => r || fetch(req))
  );
});
