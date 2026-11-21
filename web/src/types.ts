export type QueueState = 'queued' | 'retry' | 'sent' | 'rejected' | 'conflict'
export type PhotoQueueState = 'queued' | 'retry' | 'sent' | 'rejected'
export type Condition = 'good' | 'needs_attention' | 'serious_damage'

export interface Grave {
  id: string
  qrToken: string
  name: string
  gpsLat: number
  gpsLng: number
  gpsAccuracyM: number
  section: string
  block: string
  plot: string
  status: 'active' | 'archived'
  entityVersion: number
  photoId: string
  createdAt: string
  updatedAt: string
}

export interface LocalPhoto {
  id: string
  graveId: string
  blob: Blob
  contentType: 'image/jpeg' | 'image/png'
  byteSize: number
  sha256: string
  createdAt: string
}

export interface PhotoQueueItem {
  photoId: string
  graveId: string
  state: PhotoQueueState
  attempts: number
  nextAttemptAt: string | null
  lastError: string | null
  createdAt: string
}

export interface SyncEvent {
  clientEventId: string
  entity: 'graves' | 'condition_reports'
  entityId: string
  op: 'create' | 'update'
  entityVersion: number
  payload: Record<string, unknown>
  state: QueueState
  attempts: number
  nextAttemptAt: string | null
  lastError: string | null
  createdAt: string
}

export interface ConditionReport {
  id: string
  clientReportId: string
  graveQrToken: string
  graveName: string
  condition: Condition
  note: string
  gpsLat: number
  gpsLng: number
  gpsAccuracyM: number
  visitDate: string
  status: 'queued' | 'received' | 'flagged' | 'published' | 'rejected'
}

export interface FamilyReport {
  condition: Condition
  note: string | null
  visit_date: string
}

export interface FamilyResponse {
  name: string
  status?: 'active' | 'archived'
  location: { section: string | null; block: string | null; plot: string | null }
  coordinates: { lat: number; lng: number }
  photos: { id: string; url: string }[]
  reports: FamilyReport[]
}

export interface FamilyCacheEntry {
  token: string
  response: FamilyResponse
  savedAt: string
}

export interface CachedPhoto {
  id: string
  blob: Blob
  contentType: string
  savedAt: string
}

export interface ProcessedPhoto {
  blob: Blob
  contentType: 'image/jpeg' | 'image/png'
  byteSize: number
  sha256: string
  previewUrl: string
}

export interface GpsFix {
  lat: number
  lng: number
  accuracy: number
}

export interface SyncResult {
  client_event_id: string
  result: 'applied' | 'duplicate' | 'conflict' | 'rejected'
  original_result?: 'applied' | 'conflict' | 'rejected'
  reason?: string
}
