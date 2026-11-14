import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) { super(message); }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, {
      status: error.status,
      headers: { "Cache-Control": "no-store" },
    });
  }
  // Never log request bodies, cookies, tokens, or upstream responses.
  console.error(JSON.stringify({ event: "api_error", type: error instanceof Error ? error.name : "unknown" }));
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } }, { status: 500 });
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  // Next normalizes loopback request URLs to localhost. The HTTP Host retains
  // the address the browser actually visited (e.g. 127.0.0.1:3000).
  // Browsers cannot override Host, so matching it still rejects cross-site POSTs.
  const expected = new URL(request.url);
  const host = request.headers.get("host");
  if (host) expected.host = host;
  if (!origin || origin !== expected.origin) {
    throw new ApiError(403, "INVALID_ORIGIN", "This request must come from AskReady.");
  }
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new ApiError(415, "INVALID_CONTENT_TYPE", "Send a JSON request.");
  }
  if (Number(request.headers.get("content-length")) > 16_384) {
    throw new ApiError(413, "INPUT_TOO_LARGE", "The request is too large.");
  }
  // Bound the streamed body too; Content-Length alone is not a trustworthy limit.
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 16_384) {
          await reader.cancel();
          throw new ApiError(413, "INPUT_TOO_LARGE", "The request is too large.");
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ApiError(400, "INVALID_JSON", "Send valid JSON."); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "INVALID_INPUT", "The request contains invalid fields.");
  return parsed.data;
}
