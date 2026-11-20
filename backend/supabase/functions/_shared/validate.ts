// Request validation for POST /sync-batch. Pure TypeScript, no runtime imports,
// so it runs under Deno (Edge Functions) and under Node for tests.

export const MAX_EVENTS = 50;
export const MAX_BODY_BYTES = 1_000_000;
export const MAX_NOTE_LENGTH = 300;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_VERSION = 2_147_483_647;

// Each entity lists the operations the sync path accepts. Anything else is rejected here.
export const ALLOWED_OPS: Record<string, readonly string[]> = {
  graves: ["create", "update"],
  condition_reports: ["create"],
};

export interface SyncEvent {
  client_event_id: string;
  entity: string;
  entity_id: string;
  op: string;
  entity_version: number;
  created_at?: string;
  payload: Record<string, unknown>;
}

export interface SyncBatch {
  device_id: string;
  events: SyncEvent[];
}

export type ValidationResult =
  | { ok: true; batch: SyncBatch }
  | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function validateEvent(raw: unknown, index: number): string | null {
  const prefix = `events[${index}]`;
  if (!isPlainObject(raw)) return `${prefix}_not_object`;

  if (!isUuid(raw.client_event_id)) return `${prefix}_invalid_client_event_id`;
  if (!isUuid(raw.entity_id)) return `${prefix}_invalid_entity_id`;

  if (
    typeof raw.entity !== "string" ||
    !Object.prototype.hasOwnProperty.call(ALLOWED_OPS, raw.entity)
  ) {
    return `${prefix}_unsupported_entity`;
  }
  const entity = raw.entity;

  if (typeof raw.op !== "string" || !ALLOWED_OPS[entity].includes(raw.op)) {
    return `${prefix}_unsupported_op`;
  }

  if (
    typeof raw.entity_version !== "number" ||
    !Number.isInteger(raw.entity_version) ||
    raw.entity_version < 1 ||
    raw.entity_version > MAX_VERSION
  ) {
    return `${prefix}_invalid_entity_version`;
  }

  if (!isPlainObject(raw.payload)) return `${prefix}_invalid_payload`;

  if (
    entity === "condition_reports" &&
    typeof raw.payload.note === "string" &&
    raw.payload.note.length > MAX_NOTE_LENGTH
  ) {
    return `${prefix}_note_too_long`;
  }

  return null;
}

export function validateBatch(input: unknown): ValidationResult {
  if (!isPlainObject(input)) return { ok: false, error: "body_not_object" };

  if (!isUuid(input.device_id)) return { ok: false, error: "invalid_device_id" };

  if (!Array.isArray(input.events)) return { ok: false, error: "events_not_array" };
  if (input.events.length === 0 || input.events.length > MAX_EVENTS) {
    return { ok: false, error: "batch_size_out_of_range" };
  }

  for (let i = 0; i < input.events.length; i++) {
    const problem = validateEvent(input.events[i], i);
    if (problem) return { ok: false, error: problem };
  }

  return {
    ok: true,
    batch: {
      device_id: input.device_id,
      events: input.events as SyncEvent[],
    },
  };
}
