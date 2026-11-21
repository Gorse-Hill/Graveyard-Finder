// GET /family-grave?token=<26-character QR token>
// Read-only view for families. Returns the grave's name, location in words, GPS coordinates for
// the map pin, ready photos as signed links that expire after one hour, and published reports only.
// Nothing here returns GPS accuracy, device IDs, or unpublished reports.
import { json, serviceClient } from "../_shared/device_auth.ts";
import { validateFamilyToken } from "../_shared/caretaker_validate.ts";
import { enforceRateLimit } from "../_shared/rate_limit.ts";

const LINK_SECONDS = 3600;

Deno.serve(async (req) => {
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const checked = validateFamilyToken(new URL(req.url).searchParams.get("token"));
  if (!checked.ok) return json({ error: checked.error }, 400);

  const supabase = serviceClient();
  const limited = await enforceRateLimit(supabase, req, "family-grave", 60, 60);
  if (limited) return limited;

  const { data: grave, error } = await supabase
    .from("graves")
    .select("id, name, section, block, plot, status, gps_lat, gps_lng")
    .eq("qr_token", checked.value)
    .maybeSingle();
  if (error) {
    console.error("grave lookup failed", error.code, error.message);
    return json({ error: "server_error" }, 500);
  }
  if (!grave) return json({ error: "not_found" }, 404);

  const { data: photos, error: photoError } = await supabase
    .from("grave_photos")
    .select("id, storage_path")
    .eq("grave_id", grave.id)
    .eq("status", "ready")
    .order("created_at", { ascending: true });
  if (photoError) return json({ error: "server_error" }, 500);

  const photoList: { id: string; url: string }[] = [];
  for (const photo of photos ?? []) {
    const { data: signed } = await supabase.storage
      .from("grave-photos")
      .createSignedUrl(photo.storage_path, LINK_SECONDS);
    if (signed?.signedUrl) photoList.push({ id: photo.id, url: signed.signedUrl });
  }

  const { data: reports, error: reportError } = await supabase
    .from("condition_reports")
    .select("condition, note, visit_date")
    .eq("grave_id", grave.id)
    .eq("status", "published")
    .order("visit_date", { ascending: false });
  if (reportError) return json({ error: "server_error" }, 500);

  return json({
    name: grave.name,
    status: grave.status,
    location: { section: grave.section, block: grave.block, plot: grave.plot },
    coordinates: { lat: grave.gps_lat, lng: grave.gps_lng },
    photos: photoList,
    reports: reports ?? [],
  }, 200);
});
