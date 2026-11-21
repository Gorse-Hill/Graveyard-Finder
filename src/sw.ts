/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { syncNow } from './lib/sync'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: unknown[] }

self.skipWaiting()
clientsClaim()
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Keep one app-shell response for a completely offline launch. Normal navigations
// remain network-first, so updated HTML wins whenever a connection is available.
const shellCache = 'graveyard-shell-v1'
const shellUrl = () => new URL('./', self.registration.scope).toString()
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(shellCache).then((cache) => cache.add(shellUrl())))
})
const navigationStrategy = new NetworkFirst({
  cacheName: 'graveyard-pages',
  networkTimeoutSeconds: 3,
})
registerRoute(
  ({ request }) => request.mode === 'navigate',
  async (context) => {
    try {
      return await navigationStrategy.handle(context)
    } catch (error) {
      const cachedShell = await caches.match(shellUrl())
      if (cachedShell) return cachedShell
      throw error
    }
  },
)
registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({ cacheName: 'graveyard-images' }),
)

self.addEventListener('sync', (event) => {
  const syncEvent = event as Event & {
    tag: string
    waitUntil(promise: Promise<unknown>): void
  }
  if (syncEvent.tag === 'graveyard-sync') syncEvent.waitUntil(syncNow())
})
self.addEventListener('message', (event) => {
  if (event.data?.type === 'RUN_SYNC') event.waitUntil(syncNow())
})
