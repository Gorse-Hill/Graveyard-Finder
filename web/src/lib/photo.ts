import type { LocalPhoto, ProcessedPhoto } from '../types'
import { contentTypeForFile } from './domain'

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function loadImage(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) return createImageBitmap(file)
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('invalid_image'))
      image.src = url
    })
  } finally {
    // The loaded image retains its data after the object URL is released.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  const contentType = contentTypeForFile(file)
  if (!contentType) throw new Error('photo_type_not_supported')
  const image = await loadImage(file)
  const width = 'naturalWidth' in image ? image.naturalWidth : image.width
  const height = 'naturalHeight' in image ? image.naturalHeight : image.height
  if (!width || !height) throw new Error('invalid_image')
  const scale = Math.min(1, 1600 / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('photo_processing_unavailable')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  if ('close' in image) image.close()
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, contentType, contentType === 'image/jpeg' ? 0.88 : undefined)
  })
  if (!blob) throw new Error('photo_processing_failed')
  if (blob.size > 5_242_880) throw new Error('photo_too_large')
  return {
    blob,
    contentType,
    byteSize: blob.size,
    sha256: await sha256Hex(blob),
    previewUrl: URL.createObjectURL(blob),
  }
}

export function toLocalPhoto(graveId: string, photo: ProcessedPhoto): LocalPhoto {
  return {
    id: crypto.randomUUID(),
    graveId,
    blob: photo.blob,
    contentType: photo.contentType,
    byteSize: photo.byteSize,
    sha256: photo.sha256,
    createdAt: new Date().toISOString(),
  }
}
