import "server-only";
import { ApiError } from "@/lib/api";
import { adminRequest, getAuthenticatedUser, supabaseRequest } from "@/lib/supabase";
import type { Feedback, Session, SessionBundle, Turn } from "@/types/domain";

export async function requireUser() {
  const auth = await getAuthenticatedUser();
  if (!auth) throw new ApiError(401, "SIGN_IN_REQUIRED", "Please reconnect your practice space and try again.");
  return auth;
}

export async function userQuery<T>(path: string, token: string): Promise<T> {
  const response = await supabaseRequest(`/rest/v1/${path}`, {}, token);
  if (!response.ok) {
    const failure = await response.json().catch(() => ({}));
    if (failure.code === "42703" || failure.code === "42P01") {
      throw new ApiError(503, "DATABASE_NOT_READY", "Practice storage needs an update. The app owner should apply the database migration.");
    }
    throw new ApiError(503, "STORAGE_UNAVAILABLE", "Your saved practice is temporarily unavailable. Please try again.");
  }
  return response.json() as Promise<T>;
}

export async function loadSession(id: string, token: string): Promise<SessionBundle> {
  const sessions = await userQuery<Session[]>(`sessions?id=eq.${id}&select=*`, token);
  if (!sessions[0]) throw new ApiError(404, "SESSION_NOT_FOUND", "This practice is unavailable in this browser. Return to your practice space.");
  const [turns, feedback] = await Promise.all([
    userQuery<Turn[]>(`turns?session_id=eq.${id}&order=attempt.asc,sequence.asc&select=*`, token),
    userQuery<Feedback[]>(`feedback?session_id=eq.${id}&order=attempt.asc&select=*`, token),
  ]);
  return { session: sessions[0], turns, feedback };
}

const dbErrors: Record<string, [number, string]> = {
  DAILY_LIMIT: [429, "You’ve used today’s free session. Resume your saved practice or come back tomorrow (UTC)."],
  SESSION_NOT_FOUND: [404, "This session is not available to your account."],
  SESSION_CHANGED: [409, "This practice changed in another tab. Refresh it before continuing."],
  SESSION_CLOSED: [409, "This conversation is finished. Open its feedback to continue."],
  TURN_LIMIT: [409, "You’ve reached six answers. Get your feedback to continue."],
  RETRY_EXISTS: [409, "Your retry is already saved. Open the comparison to continue."],
  MORE_PRACTICE_NEEDED: [400, "Give at least two answers before getting feedback."],
};

export async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const response = await adminRequest(`rpc/${name}`, { method: "POST", body: JSON.stringify(body) });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const entry = Object.entries(dbErrors).find(([code]) => typeof error.message === "string" && error.message.includes(code));
    if (entry) throw new ApiError(entry[1][0], entry[0], entry[1][1]);
    // Log stable error code only: upstream message can contain user input.
    console.error(JSON.stringify({ event: "database_error", code: error.code ?? "unknown", operation: name }));
    throw new ApiError(503, "DATABASE_NOT_READY", "Saving practice is unavailable. The app owner should check the database migration and server key.");
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// Prevent duplicate costly generation inside one instance. DB RPCs provide the
// durable ownership, idempotency, quota and state checks across all instances.
const active = new Set<string>();
/** Returns the release function. A streamed response keeps the lock until its stream closes. */
export function acquireSessionLock(id: string) {
  if (active.has(id)) throw new ApiError(409, "REQUEST_IN_PROGRESS", "A response is already being prepared. Please wait a moment.");
  active.add(id);
  let released = false;
  return () => { if (!released) { released = true; active.delete(id); } };
}
export async function withSessionLock<T>(id: string, run: () => Promise<T>): Promise<T> {
  const release = acquireSessionLock(id);
  try { return await run(); } finally { release(); }
}

let moodsPausedUntil = 0;
/**
 * Keeps a reply's mood so a reloaded conversation shows the same face. Best effort: it needs the emotion column
 * from supabase/migrations/003_resilience.sql, and without it moods simply aren't kept. The turn id comes from
 * a session already loaded with the user's own token.
 */
export async function saveEmotion(reaction: SessionBundle["reaction"]) {
  if (!reaction || Date.now() < moodsPausedUntil) return;
  try {
    const response = await adminRequest(`turns?id=eq.${reaction.turnId}&role=eq.assistant`, {
      method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ emotion: reaction.emotion }),
    });
    if (!response.ok) moodsPausedUntil = Date.now() + 5 * 60_000;
  } catch { /* The reply itself is saved; only its face is lost. */ }
}
