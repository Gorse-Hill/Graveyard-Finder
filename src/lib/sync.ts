import { getDb, deviceIdentity, getSetting, setSetting } from './db'
import { apiUrl, syncConfigured, config } from './config'
import { backoffForAttempt, queueStateForResult, randomQrToken } from './domain'
import type { PhotoQueueItem, SyncEvent, SyncResult } from '../types'

let running = false

function headers(token?: string): HeadersInit {
  return {
    'content-type': 'application/json',
    apikey: config.anonKey,
    authorization: `Bearer ${config.anonKey}`,
    ...(token ? { 'x-device-token': token } : {}),
  }
}

async function responseError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: string }
    return body.error ?? `http_${response.status}`
  } catch {
    return `http_${response.status}`
  }
}

async function registerDevice(deviceId: string): Promise<Response> {
  return fetch(apiUrl('device-register'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ device_id: deviceId }),
  })
}

export async function ensureDeviceToken(): Promise<string | null> {
  if (!syncConfigured) return null
  const existing = await getSetting('device_token')
  if (existing) return existing
  let deviceId = await deviceIdentity()
  let response = await registerDevice(deviceId)
  if (response.status === 409) {
    // A cleared browser can lose the token but retain its device ID. Start with a
    // clean identity rather than becoming permanently unable to register.
    deviceId = crypto.randomUUID()
    await setSetting('device_id', deviceId)
    response = await registerDevice(deviceId)
  }
  if (response.status !== 201) return null
  const body = await response.json() as { token?: string; device_token?: string }
  const token = body.token ?? body.device_token
  if (!token) return null
  await setSetting('device_token', token)
  return token
}

function wireEvent(event: SyncEvent) {
  return {
    client_event_id: event.clientEventId,
    entity: event.entity,
    entity_id: event.entityId,
    op: event.op,
    entity_version: event.entityVersion,
    created_at: event.createdAt,
    payload: event.payload,
  }
}

async function scheduleRetry(events: SyncEvent[], reason: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('syncQueue', 'readwrite')
  for (const event of events) {
    const attempts = event.attempts + 1
    await tx.store.put({
      ...event,
      attempts,
      state: 'retry',
      lastError: reason,
      nextAttemptAt: new Date(Date.now() + backoffForAttempt(attempts) * 60_000).toISOString(),
    })
  }
  await tx.done
}

async function regenerateQrToken(event: SyncEvent): Promise<void> {
  if (event.entity !== 'graves') return
  const db = await getDb()
  const grave = await db.get('graves', event.entityId)
  if (!grave) return
  const tx = db.transaction(['graves', 'syncQueue'], 'readwrite')
  const qrToken = randomQrToken()
  await tx.objectStore('graves').put({ ...grave, qrToken, updatedAt: new Date().toISOString() })
  await tx.objectStore('syncQueue').put({
    ...event,
    payload: { ...event.payload, qr_token: qrToken },
    state: 'queued',
    attempts: 0,
    nextAttemptAt: null,
    lastError: 'new_qr_token_generated',
  })
  await tx.done
}

async function applyResults(results: SyncResult[]): Promise<void> {
  const db = await getDb()
  for (const result of results) {
    const event = await db.get('syncQueue', result.client_event_id)
    if (!event) continue
    if (result.result === 'rejected' && result.reason === 'qr_token_taken') {
      await regenerateQrToken(event)
      continue
    }
    const state = queueStateForResult(result.result, result.original_result)
    await db.put('syncQueue', {
      ...event,
      state,
      lastError: result.reason ?? null,
      nextAttemptAt: null,
    })
    if (event.entity === 'condition_reports') {
      const report = await db.get('conditionReports', event.entityId)
      if (report) {
        await db.put('conditionReports', {
          ...report,
          status: state === 'sent' ? 'received' : state === 'rejected' ? 'rejected' : 'queued',
        })
      }
    }
  }
}

async function sendDueEvents(token: string): Promise<void> {
  const db = await getDb()
  const now = new Date().toISOString()
  const due = (await db.getAll('syncQueue'))
    .filter((event) => (event.state === 'queued' || event.state === 'retry') &&
      (!event.nextAttemptAt || event.nextAttemptAt <= now))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, 50)
  if (!due.length) return
  let response: Response
  try {
    response = await fetch(apiUrl('sync-batch'), {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ device_id: await deviceIdentity(), events: due.map(wireEvent) }),
    })
  } catch {
    await scheduleRetry(due, 'network_error')
    return
  }
  if (response.status === 200) {
    const body = await response.json() as { results?: SyncResult[] }
    await applyResults(body.results ?? [])
    return
  }
  const reason = await responseError(response)
  if (response.status === 400) {
    const match = reason.match(/^events\[(\d+)\]/)
    const refused = match && Number(match[1]) < due.length ? [due[Number(match[1])]] : due
    const tx = db.transaction('syncQueue', 'readwrite')
    for (const event of refused) {
      await tx.store.put({ ...event, state: 'rejected', lastError: reason, nextAttemptAt: null })
    }
    await tx.done
    return
  }
  await scheduleRetry(due, reason)
}

async function retryPhoto(item: PhotoQueueItem, reason: string): Promise<void> {
  const db = await getDb()
  const attempts = item.attempts + 1
  await db.put('photoQueue', {
    ...item,
    attempts,
    state: 'retry',
    lastError: reason,
    nextAttemptAt: new Date(Date.now() + backoffForAttempt(attempts) * 60_000).toISOString(),
  })
}

async function uploadPhoto(item: PhotoQueueItem, token: string): Promise<void> {
  const db = await getDb()
  const photo = await db.get('photos', item.photoId)
  if (!photo) {
    await db.put('photoQueue', { ...item, state: 'rejected', lastError: 'photo_file_missing' })
    return
  }
  let slotResponse: Response
  try {
    slotResponse = await fetch(apiUrl('photo-upload-url'), {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        device_id: await deviceIdentity(),
        grave_id: item.graveId,
        photo_id: item.photoId,
        content_type: photo.contentType,
        byte_size: photo.byteSize,
        sha256: photo.sha256,
      }),
    })
  } catch {
    await retryPhoto(item, 'network_error')
    return
  }
  if (slotResponse.status === 400 || slotResponse.status === 403) {
    await db.put('photoQueue', { ...item, state: 'rejected', lastError: await responseError(slotResponse) })
    return
  }
  if (!slotResponse.ok) {
    await retryPhoto(item, slotResponse.status === 409 ? 'grave_not_synced_yet' : await responseError(slotResponse))
    return
  }
  const slot = await slotResponse.json() as { status: string; upload_url?: string }
  if (slot.status === 'ready') {
    await db.put('photoQueue', { ...item, state: 'sent', lastError: null, nextAttemptAt: null })
    return
  }
  if (!slot.upload_url) {
    await retryPhoto(item, 'bad_upload_response')
    return
  }
  const put = await fetch(slot.upload_url, {
    method: 'PUT',
    headers: { 'content-type': photo.contentType },
    body: photo.blob,
  })
  if (!put.ok) {
    await retryPhoto(item, `upload_${put.status}`)
    return
  }
  const confirm = await fetch(apiUrl('photo-confirm'), {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ device_id: await deviceIdentity(), photo_id: item.photoId }),
  })
  if (confirm.ok) {
    await db.put('photoQueue', { ...item, state: 'sent', lastError: null, nextAttemptAt: null })
  } else if (confirm.status === 422) {
    await db.put('photoQueue', { ...item, state: 'rejected', lastError: await responseError(confirm) })
  } else {
    await retryPhoto(item, `confirm_${confirm.status}`)
  }
}

async function uploadDuePhotos(token: string): Promise<void> {
  const db = await getDb()
  const now = new Date().toISOString()
  const due = (await db.getAll('photoQueue'))
    .filter((item) => (item.state === 'queued' || item.state === 'retry') &&
      (!item.nextAttemptAt || item.nextAttemptAt <= now))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, 5)
  for (const item of due) {
    try {
      await uploadPhoto(item, token)
    } catch {
      await retryPhoto(item, 'network_error')
    }
  }
}

export async function syncNow(): Promise<boolean> {
  if (!syncConfigured || running) return false
  running = true
  try {
    const token = await ensureDeviceToken()
    if (!token) return false
    await sendDueEvents(token)
    await uploadDuePhotos(token)
    return true
  } finally {
    running = false
  }
}
