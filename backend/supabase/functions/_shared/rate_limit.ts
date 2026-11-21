// Shared fixed-window rate limiting for public Edge Function entry points.
import { json } from "./device_auth.ts";

interface RateLimitClient {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

export function callerKey(req: Request, deviceId?: string): string {
  if (deviceId) return `device:${deviceId}`;
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = req.headers.get("cf-connecting-ip") ?? forwarded ?? "unknown";
  return `ip:${ip}`;
}

export async function enforceRateLimit(
  supabase: RateLimitClient,
  req: Request,
  scope: string,
  limit: number,
  windowSeconds: number,
  deviceId?: string,
): Promise<Response | null> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: `${scope}:${callerKey(req, deviceId)}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit failed", scope, error.message);
    return json({ error: "server_error", message: "The request could not be checked." }, 500);
  }
  if (data !== true) {
    return json({ error: "rate_limited", message: "Too many requests. Try again later." }, 429);
  }
  return null;
}
