import { describe, expect, it } from 'vitest'
import {
  deviceIdentity,
  getGraveByToken,
  getLocalPhoto,
  listSyncQueue,
  saveConditionReport,
  saveGrave,
  waitingCount,
} from './db'
import type { LocalPhoto } from '../types'

const photo: LocalPhoto = {
  id: crypto.randomUUID(),
  graveId: '',
  blob: new Blob(['test image'], { type: 'image/jpeg' }),
  contentType: 'image/jpeg',
  byteSize: 10,
  sha256: 'a'.repeat(64),
  createdAt: new Date().toISOString(),
}

describe('IndexedDB repository', () => {
  it('saves the grave, photo, and sync event as one local record', async () => {
    const grave = await saveGrave({
      name: '  Amina Ali  ',
      gpsLat: 9.56,
      gpsLng: 44.06,
      gpsAccuracyM: 5.5,
      section: ' B ',
      block: ' 2 ',
      plot: ' 14 ',
      photo,
    })
    expect(grave.name).toBe('Amina Ali')
    expect(grave.section).toBe('B')
    expect(await getGraveByToken(grave.qrToken)).toEqual(grave)
    expect((await getLocalPhoto(photo.id))?.graveId).toBe(grave.id)
    const queue = await listSyncQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].entityId).toBe(grave.id)
    expect(queue[0].payload).toMatchObject({ qr_token: grave.qrToken, gps_accuracy_m: 5.5 })
    expect(await waitingCount()).toBe(1)
  })

  it('stores caretaker reports with their QR token and accuracy', async () => {
    const grave = (await listSyncQueue())[0]
    expect(grave).toBeDefined()
    const savedGrave = await getGraveByToken(String(grave.payload.qr_token))
    expect(savedGrave).toBeDefined()
    const report = await saveConditionReport({
      graveQrToken: savedGrave!.qrToken,
      graveName: savedGrave!.name,
      condition: 'needs_attention',
      note: 'The headstone needs cleaning.',
      gpsLat: 9.56,
      gpsLng: 44.06,
      gpsAccuracyM: 7,
    })
    const queue = await listSyncQueue()
    expect(queue).toHaveLength(2)
    const event = queue.find((row) => row.entityId === report.id)
    expect(event?.payload).toMatchObject({ grave_qr_token: savedGrave!.qrToken, gps_accuracy_m: 7 })
    expect(await waitingCount()).toBe(2)
  })

  it('creates a stable device identity', async () => {
    const first = await deviceIdentity()
    const second = await deviceIdentity()
    expect(first).toMatch(/^[0-9a-f-]{36}$/)
    expect(second).toBe(first)
  })
})
