// Cache only the public offline page. Authenticated HTML, API responses and
// actions always use the network, so neither private data nor old releases stick.
const CACHE = 'tanchat-offline-v1'
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add('/chat/offline.html')),
  )
})
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('tanchat-offline-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
  )
})
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (
    event.request.method !== 'GET' ||
    event.request.mode !== 'navigate' ||
    url.origin !== self.location.origin ||
    (url.pathname !== '/chat' && !url.pathname.startsWith('/chat/')) ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/api/')
  )
    return
  event.respondWith(
    fetch(event.request).catch(
      async () =>
        (await caches.match('/chat/offline.html')) ||
        new Response('You’re offline. Reconnect and reload TanChat.', {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }),
    ),
  )
})
