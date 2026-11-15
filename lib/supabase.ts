import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import { readSupabaseConfig } from "@/lib/env";

const userSchema = z.object({
  id: z.uuid(), is_anonymous: z.boolean().optional(),
  // An anonymous account that asked to save its progress has new_email until the link is opened.
  email: z.string().nullish(), new_email: z.string().nullish(),
});
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
      ...init, headers, cache: "no-store", signal: init.signal ?? AbortSignal.timeout(12_000),
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

/** True when anonymous sign-up needs a CAPTCHA token (Cloudflare Turnstile, also enabled in Supabase Auth). */
export function captchaRequired() { return Boolean((Reflect.get(process.env, "NEXT_PUBLIC_TURNSTILE_SITE_KEY") as string | undefined)?.trim()); }
const captchaFailed = () => new ApiError(401, "CAPTCHA_FAILED", "We couldn’t confirm you’re a person. Reload the page and try again.");

export async function ensureAnonymousUser(captchaToken?: string) {
  const current = await getAuthenticatedUser();
  if (current) return current;
  // Only a brand-new account needs the check, so returning visitors never see it.
  if (captchaRequired() && !captchaToken) throw new ApiError(401, "CAPTCHA_REQUIRED", "Confirm you’re a person to start practicing.");
  const response = await supabaseRequest("/auth/v1/signup", {
    method: "POST", body: JSON.stringify({ data: {}, ...(captchaToken ? { gotrue_meta_security: { captcha_token: captchaToken } } : {}) }),
  });
  if (!response.ok) {
    if (response.status === 429) throw new ApiError(429, "AUTH_RATE_LIMITED", "Sign-in is temporarily rate limited. Wait a few minutes, then try again.");
    if (captchaToken && response.status === 400) throw captchaFailed();
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

// Accounts that survive: an anonymous account can add an email (same account, so nothing moves), and a saved
// account can sign in on another browser with a link. Supabase sends both emails. The link opens /auth/callback,
// which hands the new session to adoptSession so the tokens end up in the same HTTP-only cookies as before.

export type Account = { email: string | null; pendingEmail: string | null; anonymous: boolean };
export function accountOf(user: z.infer<typeof userSchema>): Account {
  return { email: user.email || null, pendingEmail: user.new_email || null, anonymous: user.is_anonymous ?? !user.email };
}

async function authError(response: Response) {
  const body = await response.json().catch(() => ({}));
  return { status: response.status, code: String(body.error_code ?? body.code ?? ""), message: String(body.msg ?? body.message ?? body.error_description ?? "") };
}
const emailRateLimited = () => new ApiError(429, "EMAIL_RATE_LIMITED", "Too many emails have been sent. Wait an hour, then try again.");

/** Sends a link that saves this anonymous account under an email. Opening it makes the account permanent. */
export async function requestSaveLink(accessToken: string, email: string, redirectTo: string) {
  const response = await supabaseRequest(`/auth/v1/user?redirect_to=${encodeURIComponent(redirectTo)}`, { method: "PUT", body: JSON.stringify({ email }) }, accessToken);
  if (response.ok) return;
  const failure = await authError(response);
  if (failure.code === "email_exists" || /already (been )?registered|already exists/i.test(failure.message)) {
    throw new ApiError(409, "EMAIL_TAKEN", "That email already has saved progress. Sign in with it instead.");
  }
  if (failure.status === 429 || failure.code === "over_email_send_rate_limit") throw emailRateLimited();
  if (failure.code === "email_address_invalid" || failure.status === 422) throw new ApiError(400, "INVALID_EMAIL", "Check the email address and try again.");
  throw new ApiError(503, "EMAIL_UNAVAILABLE", "We couldn’t send the email. The app owner should check Supabase email settings.");
}

/** Sends a sign-in link to a saved account. Says nothing about whether the account exists. */
export async function requestSignInLink(email: string, redirectTo: string, captchaToken?: string) {
  const response = await supabaseRequest(`/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST", body: JSON.stringify({ email, create_user: false, ...(captchaToken ? { gotrue_meta_security: { captcha_token: captchaToken } } : {}) }),
  });
  if (response.ok) return;
  const failure = await authError(response);
  if (failure.status === 429 || failure.code === "over_email_send_rate_limit") throw emailRateLimited();
  if (/captcha/i.test(failure.code + failure.message)) throw captchaFailed();
  // No account with that email: answer as if a link was sent, so the form can't be used to look up addresses.
  if (failure.status === 400 || failure.status === 422 || failure.status === 404) return;
  throw new ApiError(503, "EMAIL_UNAVAILABLE", "We couldn’t send the email. The app owner should check Supabase email settings.");
}

/** Takes over the session from a link: tokens from the link's #fragment, or a token hash to verify. */
export async function adoptSession(input: { accessToken: string; refreshToken: string; expiresIn?: number } | { tokenHash: string; type: string }) {
  let tokens: unknown;
  if ("tokenHash" in input) {
    const response = await supabaseRequest("/auth/v1/verify", { method: "POST", body: JSON.stringify({ token_hash: input.tokenHash, type: input.type }) });
    if (!response.ok) throw new ApiError(401, "LINK_EXPIRED", "That link has expired or was already used. Ask for a new one.");
    tokens = await response.json();
  } else {
    tokens = { access_token: input.accessToken, refresh_token: input.refreshToken, expires_in: input.expiresIn ?? 3600 };
  }
  const parsed = tokensSchema.safeParse(tokens);
  if (!parsed.success) throw new ApiError(401, "LINK_EXPIRED", "That link has expired or was already used. Ask for a new one.");
  const user = await verifyUser(parsed.data.access_token);
  if (!user) throw new ApiError(401, "LINK_EXPIRED", "That link has expired or was already used. Ask for a new one.");
  await saveTokens(parsed.data);
  return accountOf(user);
}

/** Signs a saved account out of this browser. Its progress stays with the email; this browser starts fresh. */
export async function signOut(accessToken: string) {
  await supabaseRequest("/auth/v1/logout?scope=local", { method: "POST" }, accessToken).catch(() => undefined);
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}
