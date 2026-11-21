import { createClient } from '@supabase/supabase-js'
import { apiUrl, authConfigured, config, syncConfigured } from './config'
import { cacheFamily, deviceIdentity, getCachedPhoto, getFamilyCache, putCachedPhoto, setSetting } from './db'
import { parseFamilyResponse } from './domain'
import { ensureDeviceToken } from './sync'
import type { FamilyResponse } from '../types'

export const supabase = authConfigured
  ? createClient(config.supabaseUrl, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null

export async function fetchFamily(token: string): Promise<FamilyResponse> {
  if (!syncConfigured || !navigator.onLine) throw new Error('offline')
  const response = await fetch(`${apiUrl('family-grave')}?token=${encodeURIComponent(token)}`, {
    headers: { apikey: config.anonKey, authorization: `Bearer ${config.anonKey}` },
  })
  if (response.status === 404) throw new Error('not_found')
  if (!response.ok) throw new Error(`http_${response.status}`)
  const parsed = parseFamilyResponse(await response.json())
  if (!parsed) throw new Error('bad_response')
  await cacheFamily({ token, response: parsed, savedAt: new Date().toISOString() })
  return parsed
}

export async function cachedFamily(token: string): Promise<FamilyResponse | null> {
  return (await getFamilyCache(token))?.response ?? null
}

export async function cachePhotoById(id: string, url: string): Promise<Blob> {
  const existing = await getCachedPhoto(id)
  if (existing) return existing.blob
  if (!navigator.onLine) throw new Error('offline')
  const response = await fetch(url)
  if (!response.ok) throw new Error('photo_unavailable')
  const blob = await response.blob()
  await putCachedPhoto({
    id,
    blob,
    contentType: blob.type || 'image/jpeg',
    savedAt: new Date().toISOString(),
  })
  return blob
}

export async function requestPhoneCode(phone: string): Promise<void> {
  if (!supabase) throw new Error('not_configured')
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: true },
  })
  if (error) throw new Error(error.message)
}

export async function verifyPhoneAndLink(phone: string, code: string): Promise<void> {
  if (!supabase || !syncConfigured) throw new Error('not_configured')
  const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' })
  if (error) throw new Error(error.message)
  const accessToken = data.session?.access_token
  if (!accessToken) throw new Error('no_access_token')
  const deviceId = await deviceIdentity()
  const deviceToken = await ensureDeviceToken()
  if (!deviceToken) throw new Error('device_not_registered')
  const response = await fetch(apiUrl('device-link'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: config.anonKey,
      authorization: `Bearer ${accessToken}`,
      'x-device-token': deviceToken,
    },
    body: JSON.stringify({ device_id: deviceId }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `link_${response.status}`)
  }
  await setSetting('caretaker_linked', '1')
}

export interface AdminActionBody {
  action: 'assign_caretaker' | 'publish_report' | 'resolve_conflict' |
    'list_reports' | 'list_conflicts' | 'list_cemeteries'
  [key: string]: unknown
}

export async function adminAction<T>(secret: string, body: AdminActionBody): Promise<T> {
  if (!syncConfigured) throw new Error('not_configured')
  const response = await fetch(apiUrl('admin-actions'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: config.anonKey,
      authorization: `Bearer ${config.anonKey}`,
      'x-admin-secret': secret,
    },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(result.error ?? `http_${response.status}`)
  return result as T
}
