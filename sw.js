const SW_VERSION = 'v1-2026-04-22'
const SHELL_CACHE = `ent-hub-shell-${SW_VERSION}`
const SHELL_FILES = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/manifest.json',
  '/favicon.ico',
  '/pwa-64x64.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon-180x180.png',
  '/maskable-icon-512x512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // Never cache API calls: Convex, TMDB, or anything that looks like an API.
  const isApi = /\.convex\.(cloud|site)$/.test(url.hostname)
    || /api\.themoviedb\.org$/.test(url.hostname)
    || /image\.tmdb\.org$/.test(url.hostname)
    || /^\/api\//.test(url.pathname)
  if (isApi) return // fall through to network

  // Navigations: serve cached shell, fall back to network.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cached) => cached || fetch(req))
    )
    return
  }

  // Same-origin static assets: cache-first, fall back to network, populate cache.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached
        return fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone()
            caches.open(SHELL_CACHE).then((c) => c.put(req, copy))
          }
          return res
        }).catch(() => caches.match('/index.html'))
      })
    )
  }
})
