// Run after compiling (see backend/README.md): node --test caretaker_validate.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAdminAction, validateDeviceLink, validateFamilyToken } from "./caretaker_validate.ts";

const DEVICE = "d0000000-0000-4000-8000-000000000001";
const USER = "90000000-0000-4000-8000-000000000001";
const CEMETERY = "c0000000-0000-4000-8000-000000000001";
const REPORT = "70000000-0000-4000-8000-000000000001";

test("device link needs a device id", () => {
  assert.equal(validateDeviceLink({ device_id: DEVICE }).ok, true);
  assert.deepEqual(validateDeviceLink({}), { ok: false, error: "invalid_device_id" });
});

test("family token must be 26 characters from the base32 alphabet", () => {
  assert.equal(validateFamilyToken("ABCDEFGHIJKLMNOPQRSTUVWXYZ").ok, true);
  assert.equal(validateFamilyToken("ABCDEFGHIJKLMNOPQRSTUVWXY").ok, false);
  assert.equal(validateFamilyToken("ABCDEFGHIJKLMNOPQRSTUVWXY0").ok, false);
  assert.equal(validateFamilyToken("abcdefghijklmnopqrstuvwxyz").ok, false);
  assert.equal(validateFamilyToken(null).ok, false);
});

test("assign_caretaker trims the section and checks the ids", () => {
  const result = validateAdminAction({
    action: "assign_caretaker",
    caretaker_user_id: USER,
    cemetery_id: CEMETERY,
    section: "  B  ",
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.action === "assign_caretaker" && result.value.section, "B");
});

test("assign_caretaker refuses an empty or long section", () => {
  const base = { action: "assign_caretaker", caretaker_user_id: USER, cemetery_id: CEMETERY };
  assert.deepEqual(validateAdminAction({ ...base, section: "   " }), { ok: false, error: "invalid_section" });
  assert.deepEqual(validateAdminAction({ ...base, section: "x".repeat(41) }), { ok: false, error: "invalid_section" });
});

test("publish_report needs a report id", () => {
  assert.equal(validateAdminAction({ action: "publish_report", report_id: REPORT }).ok, true);
  assert.deepEqual(validateAdminAction({ action: "publish_report", report_id: "x" }), {
    ok: false,
    error: "invalid_report_id",
  });
});

test("resolve_conflict checks its id and resolution", () => {
  assert.equal(validateAdminAction({ action: "resolve_conflict", conflict_id: REPORT, resolution: " Kept current " }).ok, true);
  assert.deepEqual(validateAdminAction({ action: "resolve_conflict", conflict_id: "x", resolution: "Kept current" }), { ok: false, error: "invalid_conflict_id" });
  assert.deepEqual(validateAdminAction({ action: "resolve_conflict", conflict_id: REPORT, resolution: "  " }), { ok: false, error: "invalid_resolution" });
});

test("admin list actions are accepted", () => {
  assert.equal(validateAdminAction({ action: "list_reports" }).ok, true);
  assert.equal(validateAdminAction({ action: "list_conflicts" }).ok, true);
  assert.equal(validateAdminAction({ action: "list_cemeteries" }).ok, true);
});

test("unknown admin actions are refused", () => {
  assert.deepEqual(validateAdminAction({ action: "delete_grave" }), { ok: false, error: "unsupported_action" });
});
