const CACHE_NAME = 'conexao-consciente-v1';
const STATIC_ASSETS = [
  './',
  'index.html',
  'dashboard.html',
  'chat.html',
  'apoio.html',
  'quiz.html',
  'conteudo.html',
  'css/style.css',
  'js/firebase-config.js',
  'js/auth.js',
  'js/app.js',
  'js/chat.js',
  'js/apoio.js',
  'js/quiz.js',
  'js/conteudo.js',
  'icons/icon-192.svg',
  'icons/icon-512.svg'
];

// Instalar — cachear assets estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Ativar — limpar caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch — Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignorar requests não-GET e do Firebase
  if (request.method !== 'GET') return;
  if (request.url.includes('firebaseio.com') ||
      request.url.includes('googleapis.com/identitytoolkit') ||
      request.url.includes('firestore.googleapis.com')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cachear a resposta fresca
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Sem rede — buscar do cache
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // Fallback para navegação: mostrar index
          if (request.mode === 'navigate') {
            return caches.match('index.html');
          }
        });
      })
  );
});
