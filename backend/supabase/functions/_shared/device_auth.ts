// Shared helpers for the Edge Functions: the service client, JSON responses, and device token checks.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/// Returns undefined when the body is not valid JSON.
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/// True when the presented token hashes to the device's stored hash.
export async function deviceTokenMatches(
  supabase: SupabaseClient,
  deviceId: string,
  token: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("devices")
    .select("token_hash")
    .eq("device_id", deviceId)
    .maybeSingle();
  if (error || !data) return false;
  return data.token_hash === (await sha256Hex(new TextEncoder().encode(token)));
}
