import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import { readSupabaseConfig } from "@/lib/env";

const userSchema = z.object({ id: z.uuid(), is_anonymous: z.boolean().optional() });
const tokensSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive(),
});
const ACCESS_COOKIE = "askready-access";
const REFRESH_COOKIE = "askready-refresh";
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

function config() {
  const value = readSupabaseConfig();
  if (!value.configured) {
    throw new ApiError(503, "NOT_CONFIGURED", "Practice is not available yet. The app owner needs to connect Supabase.");
  }
  return value;
}

/** Supabase Auth/PostgREST HTTP client. All user queries retain the user's JWT and RLS. */
export async function supabaseRequest(path: string, init: RequestInit = {}, accessToken?: string) {
  const env = config();
  const headers = new Headers(init.headers);
  headers.set("apikey", env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  let response: Response;
  try {
    response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}${path}`, {
      ...init, headers, cache: "no-store", signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new ApiError(503, "SUPABASE_UNAVAILABLE", "We could not connect. Check your connection and try again.");
  }
  return response;
}

/** Trusted writes only. Callers MUST verify ownership with the user JWT first. */
export async function adminRequest(path: string, init: RequestInit = {}) {
  const env = config();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new ApiError(503, "STORAGE_NOT_CONFIGURED", "Saving practice is not available yet. The app owner needs to configure server storage.");
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  if (!key.startsWith("sb_secret_")) headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");
  try {
    return await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`, {
      ...init, headers, cache: "no-store", signal: AbortSignal.timeout(12_000),
    });
  } catch { throw new ApiError(503, "STORAGE_UNAVAILABLE", "We could not save your work. Please try again."); }
}

async function saveTokens(data: unknown) {
  const parsed = tokensSchema.safeParse(data);
  if (!parsed.success) throw new ApiError(502, "INVALID_AUTH_RESPONSE", "Sign-in could not be completed. Please try again.");
  const jar = await cookies();
  // Keep the expired access token long enough to recognize an existing session and refresh it.
  jar.set(ACCESS_COOKIE, parsed.data.access_token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
  jar.set(REFRESH_COOKIE, parsed.data.refresh_token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
  return parsed.data.access_token;
}

async function verifyUser(accessToken: string) {
  const response = await supabaseRequest("/auth/v1/user", {}, accessToken);
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new ApiError(503, "AUTH_UNAVAILABLE", "We could not verify your session. Please try again.");
  const parsed = userSchema.safeParse(await response.json());
  if (!parsed.success) throw new ApiError(502, "INVALID_AUTH_RESPONSE", "We could not verify your session. Please try again.");
  return parsed.data;
}

/** Invoke from a Route Handler: refresh may set cookies. Identity is verified with Supabase. */
export async function getAuthenticatedUser() {
  const jar = await cookies();
  let accessToken = jar.get(ACCESS_COOKIE)?.value;
  if (accessToken) {
    const user = await verifyUser(accessToken);
    if (user) return { user, accessToken };
  }
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;
  const response = await supabaseRequest("/auth/v1/token?grant_type=refresh_token", {
    method: "POST", body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      throw new ApiError(401, "SESSION_EXPIRED", "Your anonymous session has expired. Clearing this site's cookies starts a new account; your previous results cannot be recovered.");
    }
    throw new ApiError(503, "AUTH_UNAVAILABLE", "We could not renew your session. Please try again.");
  }
  accessToken = await saveTokens(await response.json());
  const user = await verifyUser(accessToken);
  if (!user) throw new ApiError(401, "INVALID_SESSION", "Your session could not be verified. Please try again.");
  return { user, accessToken };
}

export async function ensureAnonymousUser() {
  const current = await getAuthenticatedUser();
  if (current) return current;
  const response = await supabaseRequest("/auth/v1/signup", {
    method: "POST", body: JSON.stringify({ data: {} }),
  });
  if (!response.ok) {
    if (response.status === 429) throw new ApiError(429, "AUTH_RATE_LIMITED", "Sign-in is temporarily rate limited. Wait a few minutes, then try again.");
    throw new ApiError(503, "SIGN_IN_FAILED", "Anonymous sign-in is unavailable. The app owner should check the Supabase key and enable anonymous sign-ins.");
  }
  const accessToken = await saveTokens(await response.json());
  const user = await verifyUser(accessToken);
  if (!user) throw new ApiError(401, "INVALID_SESSION", "Your new session could not be verified. Please try again.");
  return { user, accessToken };
}

export async function checkUserStorage(accessToken: string) {
  const response = await supabaseRequest("/rest/v1/sessions?select=id&limit=0", {}, accessToken);
  if (!response.ok) {
    throw new ApiError(503, "DATABASE_NOT_READY", "Your account is connected, but practice storage is unavailable. The app owner should apply the database migration.");
  }
}
