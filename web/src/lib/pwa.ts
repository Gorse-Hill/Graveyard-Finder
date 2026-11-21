import { syncNow } from './sync'

export async function requestBackgroundSync(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  try {
    const registration = await navigator.serviceWorker.ready
    const syncRegistration = registration as ServiceWorkerRegistration & {
      sync?: { register(tag: string): Promise<void> }
    }
    if (syncRegistration.sync) {
      await syncRegistration.sync.register('graveyard-sync')
    } else {
      window.setTimeout(() => void syncNow(), 0)
    }
  } catch {
    window.setTimeout(() => void syncNow(), 0)
  }
}
