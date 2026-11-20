// Run after compiling (see backend/README.md): node --test photo_validate.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePhotoConfirm, validatePhotoRequest } from "./photo_validate.ts";

const DEVICE = "d0000000-0000-4000-8000-000000000001";
const GRAVE = "a0000000-0000-4000-8000-000000000001";
const PHOTO = "f0000000-0000-4000-8000-000000000001";
const SHA = "a".repeat(64);

function slot(overrides: Record<string, unknown> = {}) {
  return {
    device_id: DEVICE,
    grave_id: GRAVE,
    photo_id: PHOTO,
    content_type: "image/jpeg",
    byte_size: 200_000,
    sha256: SHA,
    ...overrides,
  };
}

test("accepts a valid photo slot request", () => {
  assert.equal(validatePhotoRequest(slot()).ok, true);
});

test("accepts a PNG and rejects other types", () => {
  assert.equal(validatePhotoRequest(slot({ content_type: "image/png" })).ok, true);
  assert.deepEqual(validatePhotoRequest(slot({ content_type: "image/gif" })), {
    ok: false,
    error: "unsupported_content_type",
  });
});

test("rejects a size of zero and a size above 5 MB", () => {
  assert.equal(validatePhotoRequest(slot({ byte_size: 0 })).ok, false);
  assert.equal(validatePhotoRequest(slot({ byte_size: 5_242_881 })).ok, false);
  assert.equal(validatePhotoRequest(slot({ byte_size: 5_242_880 })).ok, true);
});

test("rejects a hash that is not 64 lowercase hex characters", () => {
  assert.deepEqual(validatePhotoRequest(slot({ sha256: "A".repeat(64) })), {
    ok: false,
    error: "invalid_sha256",
  });
  assert.equal(validatePhotoRequest(slot({ sha256: "a".repeat(63) })).ok, false);
});

test("rejects bad ids", () => {
  assert.deepEqual(validatePhotoRequest(slot({ grave_id: "x" })), {
    ok: false,
    error: "invalid_grave_id",
  });
  assert.deepEqual(validatePhotoRequest(slot({ photo_id: "x" })), {
    ok: false,
    error: "invalid_photo_id",
  });
});

test("confirm request needs a device and a photo id", () => {
  assert.equal(validatePhotoConfirm({ device_id: DEVICE, photo_id: PHOTO }).ok, true);
  assert.deepEqual(validatePhotoConfirm({ device_id: DEVICE }), {
    ok: false,
    error: "invalid_photo_id",
  });
});
