// POST /admin-actions
// Header: x-admin-secret: <ADMIN_SECRET>. The secret is checked in constant time.
// Supports section assignment, report publishing, conflict resolution, and read-only admin lists.
import { json, readJson, serviceClient } from "../_shared/device_auth.ts";
import { validateAdminAction } from "../_shared/caretaker_validate.ts";
import { sameSecret } from "../_shared/admin_auth.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed", message: "Use POST." }, 405);

  const expected = Deno.env.get("ADMIN_SECRET");
  if (!expected) return json({ error: "not_configured", message: "Admin access is not configured." }, 500);
  if (!sameSecret(req.headers.get("x-admin-secret") ?? "", expected)) {
    return json({ error: "unauthorized", message: "The admin secret is not valid." }, 401);
  }

  const body = await readJson(req);
  if (body === undefined) return json({ error: "invalid_json", message: "Send a JSON body." }, 400);

  const checked = validateAdminAction(body);
  if (!checked.ok) return json({ error: checked.error, message: "The admin request is not valid." }, 400);
  const action = checked.value;
  const supabase = serviceClient();

  if (action.action === "list_cemeteries") {
    const { data, error } = await supabase.from("cemeteries").select("id, name, municipality").order("name");
    if (error) return json({ error: "server_error", message: "Cemeteries could not be loaded." }, 500);
    return json({ items: data ?? [] }, 200);
  }

  if (action.action === "list_reports") {
    const { data, error } = await supabase
      .from("condition_reports")
      .select("id, condition, note, visit_date, status, graves(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return json({ error: "server_error", message: "Reports could not be loaded." }, 500);
    const items = (data ?? []).map((row) => {
      const grave = row.graves as unknown as { name?: string } | { name?: string }[] | null;
      const graveName = Array.isArray(grave) ? grave[0]?.name : grave?.name;
      return {
        id: row.id,
        condition: row.condition,
        note: row.note,
        visit_date: row.visit_date,
        status: row.status,
        grave_name: graveName ?? "Unknown grave",
      };
    });
    return json({ items }, 200);
  }

  if (action.action === "list_conflicts") {
    const { data, error } = await supabase
      .from("sync_conflicts")
      .select("id, entity, entity_id, current_version, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return json({ error: "server_error", message: "Conflicts could not be loaded." }, 500);
    return json({ items: data ?? [] }, 200);
  }

  if (action.action === "resolve_conflict") {
    const { data, error } = await supabase.rpc("resolve_sync_conflict", {
      p_conflict: action.conflict_id,
      p_resolution: action.resolution,
    });
    if (error) {
      console.error("admin action failed", action.action, error.code, error.message);
      return json({ error: "server_error", message: "The admin action could not be completed." }, 500);
    }
    const result = data as { result: string; reason?: string };
    if (result.result === "applied") return json({ action: action.action, ...result }, 200);
    return json({ error: result.reason ?? "rejected", message: "The admin action was rejected." }, 404);
  }

  if (action.action === "publish_report") {
    const { data, error } = await supabase.rpc("publish_condition_report", { p_report: action.report_id });
    if (error) {
      console.error("admin action failed", action.action, error.code, error.message);
      return json({ error: "server_error", message: "The admin action could not be completed." }, 500);
    }
    const result = data as { result: string; reason?: string };
    if (result.result === "applied") return json({ action: action.action, ...result }, 200);
    return json({ error: result.reason ?? "rejected", message: "The admin action was rejected." }, 404);
  }

  const { data, error } = await supabase.rpc("create_caretaker_assignment", {
    p_user: action.caretaker_user_id,
    p_cemetery: action.cemetery_id,
    p_section: action.section,
  });

  if (error) {
    console.error("admin action failed", action.action, error.code, error.message);
    return json({ error: "server_error", message: "The admin action could not be completed." }, 500);
  }

  const result = data as { result: string; reason?: string };
  if (result.result === "applied") return json({ action: action.action, ...result }, 200);
  return json({ error: result.reason ?? "rejected", message: "The admin action was rejected." }, 404);
});
