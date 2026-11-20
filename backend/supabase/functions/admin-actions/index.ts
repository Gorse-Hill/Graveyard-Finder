// POST /admin-actions
// Headers: x-admin-secret: <ADMIN_SECRET>. Body: one of
//   { "action": "assign_caretaker", "caretaker_user_id", "cemetery_id", "section" }
//   { "action": "publish_report", "report_id" }
// Needs the ADMIN_SECRET environment variable. The web console replaces this later.
import { json, readJson, serviceClient } from "../_shared/device_auth.ts";
import { validateAdminAction } from "../_shared/caretaker_validate.ts";
import { sameSecret } from "../_shared/admin_auth.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const expected = Deno.env.get("ADMIN_SECRET");
  if (!expected) return json({ error: "not_configured" }, 500);
  if (!sameSecret(req.headers.get("x-admin-secret") ?? "", expected)) {
    return json({ error: "unauthorized" }, 401);
  }

  const body = await readJson(req);
  if (body === undefined) return json({ error: "invalid_json" }, 400);

  const checked = validateAdminAction(body);
  if (!checked.ok) return json({ error: checked.error }, 400);
  const action = checked.value;

  const supabase = serviceClient();
  const { data, error } = action.action === "assign_caretaker"
    ? await supabase.rpc("create_caretaker_assignment", {
      p_user: action.caretaker_user_id,
      p_cemetery: action.cemetery_id,
      p_section: action.section,
    })
    : await supabase.rpc("publish_condition_report", { p_report: action.report_id });

  if (error) {
    console.error("admin action failed", action.action, error.code, error.message);
    return json({ error: "server_error" }, 500);
  }

  const result = data as { result: string; reason?: string };
  if (result.result === "applied") return json({ action: action.action, ...result }, 200);
  return json({ error: result.reason ?? "rejected" }, 404);
});
