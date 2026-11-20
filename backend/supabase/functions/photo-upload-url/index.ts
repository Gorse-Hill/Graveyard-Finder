// POST /photo-upload-url
// Headers: x-device-token. Body: device_id, grave_id, photo_id, content_type, byte_size, sha256.
// Returns a signed upload link. The app PUTs the bytes to upload_url, then calls photo-confirm.
// 409 grave_not_found means the grave is not on the server yet. The app retries later.
import { deviceTokenMatches, json, readJson, serviceClient } from "../_shared/device_auth.ts";
import { validatePhotoRequest } from "../_shared/photo_validate.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const body = await readJson(req);
  if (body === undefined) return json({ error: "invalid_json" }, 400);

  const checked = validatePhotoRequest(body);
  if (!checked.ok) return json({ error: checked.error }, 400);
  const r = checked.request;

  const supabase = serviceClient();
  const authorised = await deviceTokenMatches(
    supabase,
    r.device_id,
    req.headers.get("x-device-token") ?? "",
  );
  if (!authorised) return json({ error: "unauthorized" }, 401);

  const { data, error } = await supabase.rpc("create_photo_slot", {
    p_device: r.device_id,
    p_grave: r.grave_id,
    p_photo: r.photo_id,
    p_content_type: r.content_type,
    p_bytes: r.byte_size,
    p_sha256: r.sha256,
  });
  if (error) {
    console.error("create_photo_slot failed", error.code, error.message);
    return json({ error: "server_error" }, 500);
  }

  const slot = data as { result: string; reason?: string; storage_path?: string };
  if (slot.result === "already_ready") {
    return json({ photo_id: r.photo_id, status: "ready" }, 200);
  }
  if (slot.result !== "ok" || !slot.storage_path) {
    const status = slot.reason === "grave_not_found" ? 409 : 403;
    return json({ error: slot.reason ?? "rejected" }, status);
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("grave-photos")
    .createSignedUploadUrl(slot.storage_path);
  if (signError || !signed) {
    console.error("createSignedUploadUrl failed", signError?.message);
    return json({ error: "server_error" }, 500);
  }

  return json({
    photo_id: r.photo_id,
    status: "pending",
    upload_url: signed.signedUrl,
    content_type: r.content_type,
  }, 200);
});
