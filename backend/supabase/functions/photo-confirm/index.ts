// POST /photo-confirm
// Headers: x-device-token. Body: device_id, photo_id.
// Downloads the uploaded bytes, checks the size and SHA-256 the app declared, then marks the photo ready.
// 422 means the bytes do not match what was declared. The app marks that photo rejected.
import { deviceTokenMatches, json, readJson, serviceClient, sha256Hex } from "../_shared/device_auth.ts";
import { validatePhotoConfirm } from "../_shared/photo_validate.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const body = await readJson(req);
  if (body === undefined) return json({ error: "invalid_json" }, 400);

  const checked = validatePhotoConfirm(body);
  if (!checked.ok) return json({ error: checked.error }, 400);
  const r = checked.request;

  const supabase = serviceClient();
  const authorised = await deviceTokenMatches(
    supabase,
    r.device_id,
    req.headers.get("x-device-token") ?? "",
  );
  if (!authorised) return json({ error: "unauthorized" }, 401);

  const { data: row, error } = await supabase
    .from("grave_photos")
    .select("storage_path, sha256, byte_size, status, uploaded_by_device")
    .eq("id", r.photo_id)
    .maybeSingle();
  if (error) {
    console.error("grave_photos lookup failed", error.code, error.message);
    return json({ error: "server_error" }, 500);
  }
  if (!row) return json({ error: "photo_not_found" }, 404);
  if (row.uploaded_by_device !== r.device_id) return json({ error: "not_allowed" }, 403);
  if (row.status === "ready") return json({ photo_id: r.photo_id, status: "ready" }, 200);

  const { data: blob, error: downloadError } = await supabase.storage
    .from("grave-photos")
    .download(row.storage_path);
  if (downloadError || !blob) return json({ error: "not_uploaded" }, 409);

  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length !== row.byte_size) return json({ error: "size_mismatch" }, 422);
  if ((await sha256Hex(bytes)) !== row.sha256) return json({ error: "hash_mismatch" }, 422);

  const { error: updateError } = await supabase
    .from("grave_photos")
    .update({ status: "ready", ready_at: new Date().toISOString() })
    .eq("id", r.photo_id);
  if (updateError) {
    console.error("grave_photos update failed", updateError.code, updateError.message);
    return json({ error: "server_error" }, 500);
  }

  return json({ photo_id: r.photo_id, status: "ready" }, 200);
});
