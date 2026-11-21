import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  CachedPhoto,
  Condition,
  ConditionReport,
  FamilyCacheEntry,
  Grave,
  LocalPhoto,
  PhotoQueueItem,
  SyncEvent,
} from '../types'
import { randomQrToken } from './domain'

const DB_NAME = 'graveyard-finder'
const DB_VERSION = 1

interface GraveyardDB extends DBSchema {
  graves: {
    key: string
    value: Grave
    indexes: { byToken: string }
  }
  photos: { key: string; value: LocalPhoto; indexes: { byGrave: string } }
  photoQueue: { key: string; value: PhotoQueueItem }
  syncQueue: { key: string; value: SyncEvent; indexes: { byCreated: string } }
  conditionReports: { key: string; value: ConditionReport; indexes: { byClientId: string } }
  familyCache: { key: string; value: FamilyCacheEntry }
  photoCache: { key: string; value: CachedPhoto }
  settings: { key: string; value: { key: string; value: string } }
}

let dbPromise: Promise<IDBPDatabase<GraveyardDB>> | undefined

export function getDb(): Promise<IDBPDatabase<GraveyardDB>> {
  dbPromise ??= openDB<GraveyardDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const graves = db.createObjectStore('graves', { keyPath: 'id' })
      graves.createIndex('byToken', 'qrToken', { unique: true })
      const photos = db.createObjectStore('photos', { keyPath: 'id' })
      photos.createIndex('byGrave', 'graveId')
      db.createObjectStore('photoQueue', { keyPath: 'photoId' })
      const queue = db.createObjectStore('syncQueue', { keyPath: 'clientEventId' })
      queue.createIndex('byCreated', 'createdAt')
      const reports = db.createObjectStore('conditionReports', { keyPath: 'id' })
      reports.createIndex('byClientId', 'clientReportId', { unique: true })
      db.createObjectStore('familyCache', { keyPath: 'token' })
      db.createObjectStore('photoCache', { keyPath: 'id' })
      db.createObjectStore('settings', { keyPath: 'key' })
    },
  })
  return dbPromise
}

export async function getSetting(key: string): Promise<string | null> {
  const row = await (await getDb()).get('settings', key)
  return row?.value ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  await (await getDb()).put('settings', { key, value })
}

export async function deviceIdentity(): Promise<string> {
  const existing = await getSetting('device_id')
  if (existing) return existing
  const id = crypto.randomUUID()
  await setSetting('device_id', id)
  return id
}

export interface SaveGraveInput {
  name: string
  gpsLat: number
  gpsLng: number
  gpsAccuracyM: number
  section: string
  block: string
  plot: string
  photo: LocalPhoto
}

export async function saveGrave(input: SaveGraveInput): Promise<Grave> {
  const db = await getDb()
  const now = new Date().toISOString()
  const grave: Grave = {
    id: crypto.randomUUID(),
    qrToken: randomQrToken(),
    name: input.name.trim(),
    gpsLat: input.gpsLat,
    gpsLng: input.gpsLng,
    gpsAccuracyM: input.gpsAccuracyM,
    section: input.section.trim(),
    block: input.block.trim(),
    plot: input.plot.trim(),
    status: 'active',
    entityVersion: 1,
    photoId: input.photo.id,
    createdAt: now,
    updatedAt: now,
  }
  const event: SyncEvent = {
    clientEventId: crypto.randomUUID(),
    entity: 'graves',
    entityId: grave.id,
    op: 'create',
    entityVersion: 1,
    payload: {
      qr_token: grave.qrToken,
      name: grave.name,
      gps_lat: grave.gpsLat,
      gps_lng: grave.gpsLng,
      gps_accuracy_m: grave.gpsAccuracyM,
      section: grave.section || null,
      block: grave.block || null,
      plot: grave.plot || null,
      status: grave.status,
    },
    state: 'queued',
    attempts: 0,
    nextAttemptAt: null,
    lastError: null,
    createdAt: now,
  }
  const photoQueue: PhotoQueueItem = {
    photoId: input.photo.id,
    graveId: grave.id,
    state: 'queued',
    attempts: 0,
    nextAttemptAt: null,
    lastError: null,
    createdAt: now,
  }
  const tx = db.transaction(['graves', 'photos', 'photoQueue', 'syncQueue'], 'readwrite')
  await tx.objectStore('graves').add(grave)
  await tx.objectStore('photos').add({ ...input.photo, graveId: grave.id })
  await tx.objectStore('photoQueue').add(photoQueue)
  await tx.objectStore('syncQueue').add(event)
  await tx.done
  return grave
}

export async function getGrave(id: string): Promise<Grave | undefined> {
  return (await getDb()).get('graves', id)
}

export async function getGraveByToken(token: string): Promise<Grave | undefined> {
  return (await getDb()).getFromIndex('graves', 'byToken', token)
}

export async function listGraves(): Promise<Grave[]> {
  const graves = await (await getDb()).getAll('graves')
  return graves.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getLocalPhoto(id: string): Promise<LocalPhoto | undefined> {
  return (await getDb()).get('photos', id)
}

export async function listSyncQueue(): Promise<SyncEvent[]> {
  const rows = await (await getDb()).getAll('syncQueue')
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function waitingCount(): Promise<number> {
  const rows = await listSyncQueue()
  return rows.filter((row) => row.state === 'queued' || row.state === 'retry').length
}

export async function saveConditionReport(input: {
  graveQrToken: string
  graveName: string
  condition: Condition
  note: string
  gpsLat: number
  gpsLng: number
  gpsAccuracyM: number
}): Promise<ConditionReport> {
  const db = await getDb()
  const now = new Date().toISOString()
  const report: ConditionReport = {
    id: crypto.randomUUID(),
    clientReportId: crypto.randomUUID(),
    graveQrToken: input.graveQrToken,
    graveName: input.graveName,
    condition: input.condition,
    note: input.note.trim(),
    gpsLat: input.gpsLat,
    gpsLng: input.gpsLng,
    gpsAccuracyM: input.gpsAccuracyM,
    visitDate: now,
    status: 'queued',
  }
  const event: SyncEvent = {
    clientEventId: report.clientReportId,
    entity: 'condition_reports',
    entityId: report.id,
    op: 'create',
    entityVersion: 1,
    payload: {
      client_report_id: report.clientReportId,
      grave_qr_token: report.graveQrToken,
      condition: report.condition,
      note: report.note || null,
      gps_lat: report.gpsLat,
      gps_lng: report.gpsLng,
      gps_accuracy_m: report.gpsAccuracyM,
      visit_date: report.visitDate,
    },
    state: 'queued',
    attempts: 0,
    nextAttemptAt: null,
    lastError: null,
    createdAt: now,
  }
  const tx = db.transaction(['conditionReports', 'syncQueue'], 'readwrite')
  await tx.objectStore('conditionReports').add(report)
  await tx.objectStore('syncQueue').add(event)
  await tx.done
  return report
}

export async function cacheFamily(entry: FamilyCacheEntry): Promise<void> {
  await (await getDb()).put('familyCache', entry)
}

export async function getFamilyCache(token: string): Promise<FamilyCacheEntry | undefined> {
  return (await getDb()).get('familyCache', token)
}

export async function putCachedPhoto(photo: CachedPhoto): Promise<void> {
  await (await getDb()).put('photoCache', photo)
}

export async function getCachedPhoto(id: string): Promise<CachedPhoto | undefined> {
  return (await getDb()).get('photoCache', id)
}
