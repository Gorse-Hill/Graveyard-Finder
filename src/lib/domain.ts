import { z } from 'zod'
import type { Condition, FamilyResponse, QueueState } from '../types'
import { t } from './strings'

export const MAX_BATCH_SIZE = 50
export const BACKOFF_MINUTES = [1, 2, 4, 8, 15] as const
export const QR_TOKEN_PATTERN = /^[A-Z2-7]{26}$/
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function randomQrToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let token = ''
  let index = 0
  while (token.length < 26) {
    if (index >= bytes.length) crypto.getRandomValues(bytes)
    const value = bytes[index % bytes.length]
    index += 1
    // Rejection sampling avoids modulo bias. Each accepted byte is below 224.
    if (value < 224) token += BASE32[value % 32]
  }
  return token
}

export function familyUrl(token: string): string {
  return `https://gl.app/g/${token}`
}

export function parseQrInput(raw: string): string | null {
  const value = raw.trim()
  if (QR_TOKEN_PATTERN.test(value)) return value
  try {
    const url = new URL(value)
    const hashPath = url.hash.startsWith('#/') ? url.hash.slice(1) : ''
    const match = (hashPath || url.pathname).match(/\/g\/([A-Z2-7]{26})\/?$/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

export function backoffForAttempt(attempts: number): number {
  if (attempts <= 0) return 0
  return BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length) - 1]
}

export function queueStateForResult(
  result: string,
  originalResult?: string,
): QueueState {
  if (result === 'applied') return 'sent'
  if (result === 'conflict') return 'conflict'
  if (result === 'duplicate') return queueStateForResult(originalResult ?? 'rejected')
  return 'rejected'
}

export function normalizePhone(raw: string): string | null {
  const phone = raw.replace(/[\s()-]/g, '')
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null
}

export function isValidCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

export function contentTypeForFile(file: File): 'image/jpeg' | 'image/png' | null {
  if (file.type === 'image/jpeg' || file.type === 'image/png') return file.type
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'png') return 'image/png'
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  return null
}

const familySchema = z.object({
  name: z.string().min(1),
  status: z.enum(['active', 'archived']).optional(),
  location: z.object({
    section: z.string().nullable(),
    block: z.string().nullable(),
    plot: z.string().nullable(),
  }),
  coordinates: z.object({ lat: z.number(), lng: z.number() }),
  photos: z.array(z.object({ id: z.string(), url: z.string().url() })),
  reports: z.array(z.object({
    condition: z.enum(['good', 'needs_attention', 'serious_damage']),
    note: z.string().nullable(),
    visit_date: z.string(),
  })),
})

export function parseFamilyResponse(value: unknown): FamilyResponse | null {
  const parsed = familySchema.safeParse(value)
  if (!parsed.success || !isValidCoordinate(
    parsed.data.coordinates.lat,
    parsed.data.coordinates.lng,
  )) return null
  return parsed.data
}

export function locationInWords(location: {
  section?: string | null
  block?: string | null
  plot?: string | null
}): string {
  const parts = [
    location.section?.trim() ? t.sectionWord(location.section.trim()) : '',
    location.block?.trim() ? t.blockWord(location.block.trim()) : '',
    location.plot?.trim() ? t.plotWord(location.plot.trim()) : '',
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : t.noSectionDetails
}

export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

export function conditionLabel(condition: Condition): string {
  return {
    good: t.good,
    needs_attention: t.needsAttention,
    serious_damage: t.seriousDamage,
  }[condition]
}
