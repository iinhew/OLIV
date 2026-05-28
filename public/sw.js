const CACHE_STATIC = 'oliv-static-v2';
const CACHE_DYNAMIC = 'oliv-dynamic-v2';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon.svg',
  '/images/olive.png',
  '/images/olive_neo.png',
  '/images/coin.png',
  '/images/ima.png',
  '/images/redcoin.png',
  '/images/crown.png',
  '/images/icon_pause.png',
  '/images/icon_play.png',
  '/images/icon_trophy.png',
  '/images/icon_sound.png',
  '/images/icon_sound_muted.png',
  '/images/icon_music.png',
  '/images/icon_music_muted.png',
  '/images/skin_olive_rainbow.png',
  '/images/skin_pear.png',
  '/images/skin_orange.png',
  '/images/skin_pepper.png',
  '/images/skin_banana.png',
  '/images/skin_bacon.png',
  '/sounds/pop.wav',
  '/sounds/coin.wav',
  '/sounds/jump.wav',
  '/sounds/death.wav',
  '/sounds/pause.wav',
  '/sounds/break.wav',
  '/sounds/ima.wav',
  '/sounds/redcoin.wav',
  '/sounds/bgm.mp3',
  '/sounds/bgm_matrix.mp3',
  '/sounds/bgm_hardmode.mp3'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
          .map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.hostname.includes('supabase')) {
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_STATIC).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  if (
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/sounds/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/favicon.svg'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_STATIC).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_DYNAMIC).then((cache) => cache.put(request, clone));
        return response;
      }).catch(() => {
        return caches.match(request).then((cached) => {
          return cached || caches.match('/');
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(request).then((response) => {
      const clone = response.clone();
      caches.open(CACHE_DYNAMIC).then((cache) => cache.put(request, clone));
      return response;
    }).catch(() => {
      return caches.match(request);
    })
  );
});
