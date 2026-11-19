// Service worker: deixa o app abrir sem internet e recebe as notificações.
importScripts('./config.js');

const VERSAO = 'materiais-v3';
const BASE = ['./', './index.html', './style.css', './app.js', './config.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Arquivos do app: tenta a rede (pega atualizações) e cai no cache se estiver offline.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copia = r.clone();
        caches.open(VERSAO).then((c) => c.put(e.request, copia));
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))),
  );
});

// Notificações (Firebase Cloud Messaging). Com app fechado, o Firebase mostra sozinho.
if (self.CONFIG && self.CONFIG.FIREBASE && self.CONFIG.FIREBASE.apiKey) {
  importScripts(
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js',
  );
  firebase.initializeApp(self.CONFIG.FIREBASE);
  firebase.messaging();
}
