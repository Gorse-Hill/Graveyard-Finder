const trimSlash = (value: string) => value.replace(/\/$/, '')

export const config = {
  syncUrl: trimSlash(import.meta.env.VITE_SYNC_URL ?? ''),
  supabaseUrl: trimSlash(import.meta.env.VITE_SUPABASE_URL ?? ''),
  anonKey: import.meta.env.VITE_SYNC_ANON_KEY ?? '',
}

export const syncConfigured = Boolean(config.syncUrl && config.anonKey)
export const authConfigured = Boolean(config.supabaseUrl && config.anonKey)

export function apiUrl(path: string): string {
  return `${config.syncUrl}/${path.replace(/^\//, '')}`
}
