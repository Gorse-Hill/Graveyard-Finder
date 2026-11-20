// Run with Deno: deno test supabase/functions/_shared/validate.test.ts
// Also runs under Node after compiling (see backend/README.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_EVENTS, validateBatch } from "./validate.ts";

const DEVICE = "d0000000-0000-4000-8000-000000000001";
const EVENT = "e0000000-0000-4000-8000-000000000001";
const ENTITY = "a0000000-0000-4000-8000-000000000001";

function event(overrides: Record<string, unknown> = {}) {
  return {
    client_event_id: EVENT,
    entity: "graves",
    entity_id: ENTITY,
    op: "create",
    entity_version: 1,
    payload: { name: "Test" },
    ...overrides,
  };
}

function batch(events: unknown[] = [event()], device: unknown = DEVICE) {
  return { device_id: device, events };
}

test("accepts a valid batch", () => {
  const result = validateBatch(batch());
  assert.equal(result.ok, true);
});

test("rejects a body that is not an object", () => {
  assert.deepEqual(validateBatch(null), { ok: false, error: "body_not_object" });
  assert.deepEqual(validateBatch([]), { ok: false, error: "body_not_object" });
});

test("rejects a bad device id", () => {
  assert.deepEqual(validateBatch(batch([event()], "not-a-uuid")), {
    ok: false,
    error: "invalid_device_id",
  });
});

test("rejects an empty batch and an oversized batch", () => {
  assert.deepEqual(validateBatch(batch([])), { ok: false, error: "batch_size_out_of_range" });
  const tooMany = Array.from({ length: MAX_EVENTS + 1 }, () => event());
  assert.deepEqual(validateBatch(batch(tooMany)), { ok: false, error: "batch_size_out_of_range" });
});

test("accepts exactly MAX_EVENTS events", () => {
  const full = Array.from({ length: MAX_EVENTS }, () => event());
  assert.equal(validateBatch(batch(full)).ok, true);
});

test("rejects an unknown entity", () => {
  assert.deepEqual(validateBatch(batch([event({ entity: "users" })])), {
    ok: false,
    error: "events[0]_unsupported_entity",
  });
});

test("rejects an operation the entity does not allow", () => {
  assert.deepEqual(validateBatch(batch([event({ entity: "condition_reports", op: "update" })])), {
    ok: false,
    error: "events[0]_unsupported_op",
  });
});

test("rejects a non-integer or zero version", () => {
  assert.equal(validateBatch(batch([event({ entity_version: 0 })])).ok, false);
  assert.equal(validateBatch(batch([event({ entity_version: 1.5 })])).ok, false);
  assert.equal(validateBatch(batch([event({ entity_version: "2" })])).ok, false);
});

test("rejects a report note longer than 300 characters", () => {
  const longNote = "x".repeat(301);
  const result = validateBatch(
    batch([event({ entity: "condition_reports", payload: { note: longNote } })]),
  );
  assert.deepEqual(result, { ok: false, error: "events[0]_note_too_long" });
});

test("reports the index of the first bad event", () => {
  const result = validateBatch(batch([event(), event({ client_event_id: "bad" })]));
  assert.deepEqual(result, { ok: false, error: "events[1]_invalid_client_event_id" });
});
