// POST /device-register
// Body: { "device_id": "<uuid made on the phone>" }
// Returns: { "token": "<64 hex characters>" } once. The server keeps only the SHA-256 hash.
// A device_id that is already registered returns 409. A lost token cannot be recovered
// without a new device_id, which is the expected path after a reinstall.

import { createClient } from "npm:@supabase/supabase-js@2";
import { isUuid } from "../_shared/validate.ts";
import { enforceRateLimit } from "../_shared/rate_limit.ts";

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

  const limited = await enforceRateLimit(supabase, req, "device-register", 10, 3600);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const deviceId = (body as { device_id?: unknown })?.device_id;
  if (!isUuid(deviceId)) return json({ error: "invalid_device_id" }, 400);

  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const tokenHash = await sha256Hex(token);

  const { error } = await supabase.from("devices").insert({
    device_id: deviceId,
    token_hash: tokenHash,
  });

  if (error) {
    if (error.code === "23505") return json({ error: "device_exists" }, 409);
    console.error("device insert failed", error.code, error.message);
    return json({ error: "server_error" }, 500);
  }

  return json({ token }, 201);
});
