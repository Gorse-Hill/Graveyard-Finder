// Request validation for the caretaker, admin, and family functions. Pure TypeScript.
import { isUuid } from "./validate.ts";

export const FAMILY_TOKEN_RE = /^[A-Z2-7]{26}$/;
export const CONDITIONS = ["good", "needs_attention", "serious_damage"];

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateDeviceLink(input: unknown): Checked<{ device_id: string }> {
  if (!isObject(input)) return { ok: false, error: "body_not_object" };
  if (!isUuid(input.device_id)) return { ok: false, error: "invalid_device_id" };
  return { ok: true, value: { device_id: input.device_id } };
}

export function validateFamilyToken(token: string | null): Checked<string> {
  if (token === null || !FAMILY_TOKEN_RE.test(token)) {
    return { ok: false, error: "invalid_token" };
  }
  return { ok: true, value: token };
}

export type AdminAction =
  | { action: "assign_caretaker"; caretaker_user_id: string; cemetery_id: string; section: string }
  | { action: "publish_report"; report_id: string }
  | { action: "resolve_conflict"; conflict_id: string; resolution: string }
  | { action: "list_reports" }
  | { action: "list_conflicts" }
  | { action: "list_cemeteries" };

export function validateAdminAction(input: unknown): Checked<AdminAction> {
  if (!isObject(input)) return { ok: false, error: "body_not_object" };

  if (input.action === "assign_caretaker") {
    if (!isUuid(input.caretaker_user_id)) return { ok: false, error: "invalid_caretaker_user_id" };
    if (!isUuid(input.cemetery_id)) return { ok: false, error: "invalid_cemetery_id" };
    if (typeof input.section !== "string" || input.section.trim().length === 0 || input.section.length > 40) {
      return { ok: false, error: "invalid_section" };
    }
    return {
      ok: true,
      value: {
        action: "assign_caretaker",
        caretaker_user_id: input.caretaker_user_id,
        cemetery_id: input.cemetery_id,
        section: input.section.trim(),
      },
    };
  }

  if (input.action === "publish_report") {
    if (!isUuid(input.report_id)) return { ok: false, error: "invalid_report_id" };
    return { ok: true, value: { action: "publish_report", report_id: input.report_id } };
  }

  if (input.action === "resolve_conflict") {
    if (!isUuid(input.conflict_id)) return { ok: false, error: "invalid_conflict_id" };
    if (typeof input.resolution !== "string" || input.resolution.trim().length === 0 || input.resolution.length > 500) {
      return { ok: false, error: "invalid_resolution" };
    }
    return {
      ok: true,
      value: {
        action: "resolve_conflict",
        conflict_id: input.conflict_id,
        resolution: input.resolution.trim(),
      },
    };
  }

  if (input.action === "list_reports" || input.action === "list_conflicts" || input.action === "list_cemeteries") {
    return { ok: true, value: { action: input.action } };
  }

  return { ok: false, error: "unsupported_action" };
}
