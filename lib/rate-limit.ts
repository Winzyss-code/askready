import "server-only";
import { ApiError } from "@/lib/api";

type Bucket = { count: number; resetsAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

/** Best-effort per-instance limit. Use a shared store before scaling traffic. */
export function rateLimit(key: string, maximum = 15, windowMs = 60_000) {
  const now = Date.now();
  for (const [existingKey, bucket] of buckets) {
    if (bucket.resetsAt <= now) buckets.delete(existingKey);
  }
  const bucket = buckets.get(key);
  if (bucket && bucket.count >= maximum) {
    throw new ApiError(429, "RATE_LIMITED", "Too many attempts. Wait a minute, then try again.");
  }
  if (bucket) bucket.count++;
  else {
    if (buckets.size >= MAX_BUCKETS) {
      throw new ApiError(429, "RATE_LIMITED", "AskReady is busy. Please try again in a minute.");
    }
    buckets.set(key, { count: 1, resetsAt: now + windowMs });
  }
}

export function requestIp(request: Request) {
  // Vercel overwrites this header. Do not trust caller-supplied forwarding headers elsewhere.
  return process.env.VERCEL
    ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    : "local";
}
