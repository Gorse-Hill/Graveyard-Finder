// POST /sync-batch
// Authenticates the device, validates the batch, and hands it to the sync_push database function.
// Headers: x-device-token (the token from device-register). The Authorization header carries the anon key,
// which passes the Supabase gateway.

import { createClient } from "npm:@supabase/supabase-js@2";
import { MAX_BODY_BYTES, validateBatch } from "../_shared/validate.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return json({ error: "body_too_large" }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const checked = validateBatch(body);
  if (!checked.ok) return json({ error: checked.error }, 400);

  const { device_id, events } = checked.batch;
  const token = req.headers.get("x-device-token") ?? "";

  const { data: device, error: deviceError } = await supabase
    .from("devices")
    .select("token_hash")
    .eq("device_id", device_id)
    .maybeSingle();
  if (deviceError) return json({ error: "server_error" }, 500);

  const presented = await sha256Hex(token);
  if (!device || device.token_hash !== presented) {
    return json({ error: "unauthorized" }, 401);
  }

  const { data, error } = await supabase.rpc("sync_push", {
    p_device_id: device_id,
    p_events: events,
  });
  if (error) {
    console.error("sync_push failed", error.code, error.message);
    return json({ error: "server_error" }, 500);
  }

  return json(data, 200);
});
