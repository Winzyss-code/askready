"use client";

export class ClientError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number) { super(message); }
}

export async function api<T>(path: string, body?: unknown, options: { signal?: AbortSignal } = {}): Promise<T> {
  let response: Response;
  const timeout = AbortSignal.timeout(125_000);
  try {
    response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ClientError("The connection took too long or was interrupted. Your saved practice is safe. Please try again.", "CONNECTION_FAILED", 0);
  }
  let result;
  try { result = await response.json(); }
  catch { throw new ClientError("The server returned an unexpected response. Please try again.", "INVALID_RESPONSE", response.status); }
  if (!response.ok) throw new ClientError(result.error?.message || "We couldn’t complete that step. Please try again.", result.error?.code || "REQUEST_FAILED", response.status);
  return result as T;
}

export type StreamEvent = { type: string } & Record<string, unknown>;
const interrupted = () => new ClientError("The connection was interrupted before this step was saved. Your saved practice is safe. Please try again.", "CONNECTION_FAILED", 0);

/**
 * Like api(), but reads a response the server streams one event per line. Resolves with the `bundle` of the
 * `done` event, or with the plain JSON body when the server answered at once (as it does for a repeated request).
 * Events that come after `done`, such as the last of a reply's audio, still reach onEvent; onClose runs when the
 * stream has ended, however it ended.
 */
export async function streamApi<T>(path: string, body: unknown, onEvent: (event: StreamEvent) => void, options: { signal?: AbortSignal; onClose?: () => void } = {}): Promise<T> {
  const timeout = AbortSignal.timeout(125_000);
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
      body: JSON.stringify(body), cache: "no-store",
      signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
    });
  } catch (error) {
    options.onClose?.();
    if (options.signal?.aborted) throw error;
    throw new ClientError("The connection took too long or was interrupted. Your saved practice is safe. Please try again.", "CONNECTION_FAILED", 0);
  }
  if (!response.headers.get("content-type")?.includes("application/x-ndjson") || !response.body) {
    options.onClose?.();
    let result;
    try { result = await response.json(); }
    catch { throw new ClientError("The server returned an unexpected response. Please try again.", "INVALID_RESPONSE", response.status); }
    if (!response.ok) throw new ClientError(result.error?.message || "We couldn’t complete that step. Please try again.", result.error?.code || "REQUEST_FAILED", response.status);
    return result as T;
  }
  const reader = response.body.getReader();
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const settle = (finish: () => void) => { if (!settled) { settled = true; finish(); } };
    const handle = (line: string) => {
      if (!line.trim()) return;
      const event = JSON.parse(line) as StreamEvent;
      if (event.type === "done") settle(() => resolve(event.bundle as T));
      else if (event.type === "error") {
        const error = event.error as { code?: string; message?: string } | undefined;
        settle(() => reject(new ClientError(error?.message || "We couldn’t complete that step. Please try again.", error?.code || "REQUEST_FAILED", 500)));
      } else onEvent(event);
    };
    void (async () => {
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          for (let newline = buffer.indexOf("\n"); newline !== -1; newline = buffer.indexOf("\n")) {
            handle(buffer.slice(0, newline));
            buffer = buffer.slice(newline + 1);
          }
        }
        handle(buffer);
        settle(() => reject(interrupted()));
      } catch (error) {
        settle(() => reject(options.signal?.aborted ? error : interrupted()));
      } finally { options.onClose?.(); }
    })();
  });
}

/** Sends one timing measured in this browser to the /speed page. Fire and forget: it never affects practice. */
export function reportTiming(stage: "client_reply_first_audio" | "client_coaching_total", durationMs: number) {
  void fetch("/api/timing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage, durationMs: Math.round(durationMs) }), keepalive: true }).catch(() => undefined);
}

let pendingAuth: Promise<void> | null = null;
export function ensureClientAuth(): Promise<void> {
  if (!pendingAuth) {
    const connect = async () => {
      try { await api("/api/auth", {}); }
      catch (error) {
        // Only a brand-new anonymous account is asked to prove it's a person.
        if (!(error instanceof ClientError) || error.code !== "CAPTCHA_REQUIRED") throw error;
        const { captchaToken } = await import("@/lib/captcha");
        let token: string;
        try { token = await captchaToken(); }
        catch { throw new ClientError("We couldn’t confirm you’re a person. Reload the page and try again.", "CAPTCHA_FAILED", 401); }
        await api("/api/auth", { captchaToken: token });
      }
    };
    const boot = async () => {
      if (navigator.locks) await navigator.locks.request("askready-auth", connect);
      else await connect();
    };
    pendingAuth = boot().finally(() => { pendingAuth = null; });
  }
  return pendingAuth;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
