import assert from 'node:assert/strict'
import { uninstallAllServiceWorkers } from '../src/lib/serviceWorkers'

const unregistered: string[] = []
const deletedCaches: string[] = []

const waiting = { postMessage: (msg: { type: string }) => {
  assert.equal(msg.type, 'SKIP_WAITING')
}}

;(globalThis as unknown as { navigator: unknown }).navigator = {
  serviceWorker: {
    getRegistrations: async () => [
      {
        waiting,
        active: waiting,
        unregister: async () => {
          unregistered.push('scope-a')
          return true
        },
      },
      {
        waiting: null,
        active: null,
        unregister: async () => {
          unregistered.push('scope-b')
          return true
        },
      },
    ],
  },
}

;(globalThis as unknown as { window: unknown }).window = globalThis
;(globalThis as unknown as { caches: unknown }).caches = {
  keys: async () => ['workbox-precache', 'html-pages'],
  delete: async (k: string) => {
    deletedCaches.push(k)
    return true
  },
}

const had = await uninstallAllServiceWorkers()
assert.equal(had, true)
assert.deepEqual(unregistered, ['scope-a', 'scope-b'])
assert.deepEqual(deletedCaches, ['workbox-precache', 'html-pages'])

;(globalThis as unknown as { navigator: { serviceWorker: { getRegistrations: () => Promise<unknown[]> } } }).navigator.serviceWorker.getRegistrations =
  async () => []
deletedCaches.length = 0
const hadNone = await uninstallAllServiceWorkers()
assert.equal(hadNone, false)
assert.deepEqual(deletedCaches, ['workbox-precache', 'html-pages'])

console.log('ok test-service-workers')
