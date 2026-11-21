// Ask the browser to keep this site's storage. Without it, Safari on iPhone can clear the
// records of a site that has not been opened for about a week, including graves that never synced.
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
