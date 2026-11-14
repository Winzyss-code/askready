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

let pendingAuth: Promise<void> | null = null;
export function ensureClientAuth(): Promise<void> {
  if (!pendingAuth) {
    const connect = async () => { await api("/api/auth", {}); };
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
