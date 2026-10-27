/* Hors-ligne et mises à jour.
   - Fichiers de l'app (HTML, CSS, JS, icônes, manifest) : réseau d'abord, en contournant le cache HTTP,
     pour que chaque ouverture avec du réseau récupère la dernière version publiée. Sans réseau
     (ou réseau trop lent), on sert la copie en cache.
   - Polices Google : cache d'abord (leurs fichiers ne changent jamais à URL constante).
   Changer VERSION à chaque publication force aussi le remplacement du cache chez tout le monde. */
const VERSION = 'v2';
const CACHE = 'sport-' + VERSION;
const CORE = ['./', './index.html', './css/app.css', './js/catalog.js', './js/app.js', './js/timer.js', './js/backup.js', './js/main.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];
const NET_TIMEOUT = 4000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(CORE.map(u => fetch(u, { cache:'no-cache' }).then(r => r.ok ? c.put(u, r) : null).catch(() => null))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('sport-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function networkFirst(req, key){
  const net = fetch(req, { cache:'no-cache' }).then(r => {
    if (r.ok){ const cp = r.clone(); caches.open(CACHE).then(c => c.put(key, cp)); }
    return r;
  });
  const timeout = new Promise(res => setTimeout(res, NET_TIMEOUT));
  // Le premier qui répond : le réseau, ou le cache si le réseau traîne. Sans cache, on attend le réseau.
  return Promise.race([net.catch(() => null), timeout.then(() => caches.match(key))])
    .then(r => r || net.catch(() => caches.match(key)))
    .then(r => r || caches.match(key));
}

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate'){ e.respondWith(networkFirst(req, './index.html')); return; }
  if (url.origin === location.origin){ e.respondWith(networkFirst(req, req)); return; }
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok || r.type === 'opaque'){ const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; })));
  }
});

/* Notification de fin de repos : la toucher ramène l'app au premier plan. */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
    const c = list.find(x => 'focus' in x); if (c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
