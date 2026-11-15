import "server-only";
import { createHash } from "node:crypto";
import { ApiError } from "@/lib/api";
import { adminRequest } from "@/lib/supabase";

type Bucket = { count: number; resetsAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;
const limited = () => new ApiError(429, "RATE_LIMITED", "Too many attempts. Wait a minute, then try again.");

/** Per instance; resets on deploy. Always applies, and is all there is until the shared limit is set up. */
function memoryLimit(key: string, maximum: number, windowMs: number) {
  const now = Date.now();
  for (const [existingKey, bucket] of buckets) {
    if (bucket.resetsAt <= now) buckets.delete(existingKey);
  }
  const bucket = buckets.get(key);
  if (bucket && bucket.count >= maximum) throw limited();
  if (bucket) bucket.count++;
  else {
    if (buckets.size >= MAX_BUCKETS) {
      throw new ApiError(429, "RATE_LIMITED", "AskReady is busy. Please try again in a minute.");
    }
    buckets.set(key, { count: 1, resetsAt: now + windowMs });
  }
}

let sharedPausedUntil = 0;

/**
 * The same limit shared by every instance and kept across deploys, in the database (rate_limit_hit, from
 * supabase/migrations/003_resilience.sql). Keys are hashed, so no IP address or user id is stored. If the
 * function is missing or storage is down, it fails open and the per-instance limit still applies.
 */
async function sharedLimit(key: string, maximum: number, windowMs: number) {
  if (Date.now() < sharedPausedUntil || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return;
  let allowed: unknown;
  try {
    const response = await adminRequest("rpc/rate_limit_hit", {
      method: "POST", signal: AbortSignal.timeout(2500),
      body: JSON.stringify({ p_key: createHash("sha256").update(key).digest("hex"), p_max: maximum, p_window_seconds: Math.ceil(windowMs / 1000) }),
    });
    if (!response.ok) { sharedPausedUntil = Date.now() + 5 * 60_000; return; }
    allowed = await response.json();
  } catch { sharedPausedUntil = Date.now() + 30_000; return; }
  if (allowed === false) throw limited();
}

export async function rateLimit(key: string, maximum = 15, windowMs = 60_000) {
  memoryLimit(key, maximum, windowMs);
  await sharedLimit(key, maximum, windowMs);
}

export function requestIp(request: Request) {
  // Vercel overwrites this header. Do not trust caller-supplied forwarding headers elsewhere.
  return process.env.VERCEL
    ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    : "local";
}
