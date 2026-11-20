// Request validation for the photo functions. Pure TypeScript, no runtime imports.
import { isUuid } from "./validate.ts";

export const MAX_PHOTO_BYTES = 5_242_880;
export const ALLOWED_CONTENT_TYPES: string[] = ["image/jpeg", "image/png"];
const SHA256_RE = /^[0-9a-f]{64}$/;

export interface PhotoSlotRequest {
  device_id: string;
  grave_id: string;
  photo_id: string;
  content_type: string;
  byte_size: number;
  sha256: string;
}

export interface PhotoConfirmRequest {
  device_id: string;
  photo_id: string;
}

export type PhotoValidation<T> = { ok: true; request: T } | { ok: false; error: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validatePhotoRequest(input: unknown): PhotoValidation<PhotoSlotRequest> {
  if (!isObject(input)) return { ok: false, error: "body_not_object" };
  if (!isUuid(input.device_id)) return { ok: false, error: "invalid_device_id" };
  if (!isUuid(input.grave_id)) return { ok: false, error: "invalid_grave_id" };
  if (!isUuid(input.photo_id)) return { ok: false, error: "invalid_photo_id" };
  if (typeof input.content_type !== "string" || !ALLOWED_CONTENT_TYPES.includes(input.content_type)) {
    return { ok: false, error: "unsupported_content_type" };
  }
  if (
    typeof input.byte_size !== "number" ||
    !Number.isInteger(input.byte_size) ||
    input.byte_size < 1 ||
    input.byte_size > MAX_PHOTO_BYTES
  ) {
    return { ok: false, error: "invalid_byte_size" };
  }
  if (typeof input.sha256 !== "string" || !SHA256_RE.test(input.sha256)) {
    return { ok: false, error: "invalid_sha256" };
  }
  return {
    ok: true,
    request: {
      device_id: input.device_id,
      grave_id: input.grave_id,
      photo_id: input.photo_id,
      content_type: input.content_type,
      byte_size: input.byte_size,
      sha256: input.sha256,
    },
  };
}

export function validatePhotoConfirm(input: unknown): PhotoValidation<PhotoConfirmRequest> {
  if (!isObject(input)) return { ok: false, error: "body_not_object" };
  if (!isUuid(input.device_id)) return { ok: false, error: "invalid_device_id" };
  if (!isUuid(input.photo_id)) return { ok: false, error: "invalid_photo_id" };
  return { ok: true, request: { device_id: input.device_id, photo_id: input.photo_id } };
}
