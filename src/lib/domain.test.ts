import { describe, expect, it } from 'vitest'
import {
  backoffForAttempt,
  conditionLabel,
  contentTypeForFile,
  directionsUrl,
  familyUrl,
  isValidCoordinate,
  locationInWords,
  normalizePhone,
  parseFamilyResponse,
  parseQrInput,
  queueStateForResult,
  randomQrToken,
} from './domain'

const TOKEN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

describe('Family Card tokens and links', () => {
  it('creates unique 26-character base32 tokens', () => {
    const tokens = new Set(Array.from({ length: 200 }, randomQrToken))
    expect(tokens.size).toBe(200)
    for (const token of tokens) expect(token).toMatch(/^[A-Z2-7]{26}$/)
  })

  it('uses the required family URL', () => {
    expect(familyUrl(TOKEN)).toBe(`https://gl.app/g/${TOKEN}`)
  })

  it('parses a token, production link, and hash-routed preview link', () => {
    expect(parseQrInput(TOKEN)).toBe(TOKEN)
    expect(parseQrInput(` https://gl.app/g/${TOKEN} `)).toBe(TOKEN)
    expect(parseQrInput(`https://example.test/#/g/${TOKEN}`)).toBe(TOKEN)
  })

  it('rejects malformed and unrelated QR values', () => {
    expect(parseQrInput('hello')).toBeNull()
    expect(parseQrInput('ABCDEFGHIJKLMNOPQRSTUVWXY0')).toBeNull()
    expect(parseQrInput('https://gl.app/other/ABCDEFGHIJKLMNOPQRSTUVWXYZ')).toBeNull()
  })
})

describe('queue rules', () => {
  it('uses the 1, 2, 4, 8, 15 minute schedule and caps later retries', () => {
    expect([1, 2, 3, 4, 5, 6, 20].map(backoffForAttempt)).toEqual([1, 2, 4, 8, 15, 15, 15])
    expect(backoffForAttempt(0)).toBe(0)
  })

  it('maps per-event and duplicate results to local states', () => {
    expect(queueStateForResult('applied')).toBe('sent')
    expect(queueStateForResult('conflict')).toBe('conflict')
    expect(queueStateForResult('duplicate', 'applied')).toBe('sent')
    expect(queueStateForResult('duplicate', 'rejected')).toBe('rejected')
    expect(queueStateForResult('rejected')).toBe('rejected')
  })
})

describe('input validation', () => {
  it('validates international phone numbers', () => {
    expect(normalizePhone('+252 63 123 4567')).toBe('+252631234567')
    expect(normalizePhone('0631234567')).toBeNull()
    expect(normalizePhone('+252')).toBeNull()
  })

  it('accepts JPEG and PNG only', () => {
    expect(contentTypeForFile(new File(['x'], 'grave.jpg', { type: 'image/jpeg' }))).toBe('image/jpeg')
    expect(contentTypeForFile(new File(['x'], 'grave.png', { type: '' }))).toBe('image/png')
    expect(contentTypeForFile(new File(['x'], 'grave.gif', { type: 'image/gif' }))).toBeNull()
  })

  it('checks coordinate bounds', () => {
    expect(isValidCoordinate(9.56, 44.06)).toBe(true)
    expect(isValidCoordinate(91, 44.06)).toBe(false)
    expect(isValidCoordinate(9.56, 181)).toBe(false)
  })
})

describe('family responses and directions', () => {
  it('accepts only public fields in the expected shape', () => {
    const response = parseFamilyResponse({
      name: 'Amina Ali',
      location: { section: 'B', block: '2', plot: '14' },
      coordinates: { lat: 9.56, lng: 44.06 },
      photos: [{ id: 'photo-1', url: 'https://example.test/photo.jpg' }],
      reports: [{ condition: 'good', note: null, visit_date: '2026-11-22T08:00:00Z' }],
      gps_accuracy_m: 4,
    })
    expect(response?.name).toBe('Amina Ali')
    expect(response?.reports).toHaveLength(1)
    expect(parseFamilyResponse({ name: 'Missing fields' })).toBeNull()
  })

  it('formats plot details and map directions', () => {
    expect(locationInWords({ section: 'B', block: '2', plot: '14' })).toBe('Section B · Block 2 · Plot 14')
    expect(locationInWords({})).toBe('No section details were added')
    expect(directionsUrl(9.56, 44.06)).toContain('destination=9.56,44.06')
    expect(conditionLabel('needs_attention')).toBe('Needs attention')
  })
})
