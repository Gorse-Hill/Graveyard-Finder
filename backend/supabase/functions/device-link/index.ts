// POST /device-link
// Headers: x-device-token (the device token), Authorization: Bearer <caretaker's Supabase Auth access token>,
// apikey: <anon key> (the gateway needs it).
// Body: { "device_id": "<uuid>" }. Links the caretaker's account to this device.
import { deviceTokenMatches, json, readJson, serviceClient } from "../_shared/device_auth.ts";
import { validateDeviceLink } from "../_shared/caretaker_validate.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const body = await readJson(req);
  if (body === undefined) return json({ error: "invalid_json" }, 400);

  const checked = validateDeviceLink(body);
  if (!checked.ok) return json({ error: checked.error }, 400);
  const { device_id } = checked.value;

  const supabase = serviceClient();
  const authorised = await deviceTokenMatches(
    supabase,
    device_id,
    req.headers.get("x-device-token") ?? "",
  );
  if (!authorised) return json({ error: "unauthorized" }, 401);

  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "sign_in_required" }, 401);

  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !userData.user) return json({ error: "sign_in_required" }, 401);

  const { data, error } = await supabase.rpc("link_device_caretaker", {
    p_device: device_id,
    p_user: userData.user.id,
  });
  if (error) {
    console.error("link_device_caretaker failed", error.code, error.message);
    return json({ error: "server_error" }, 500);
  }

  const result = data as { result: string; reason?: string };
  if (result.result === "applied") return json({ status: "linked" }, 200);
  if (result.reason === "already_linked_other_user") return json({ error: result.reason }, 409);
  return json({ error: result.reason ?? "rejected" }, 403);
});
