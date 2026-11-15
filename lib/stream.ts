import "server-only";
import { ApiError } from "@/lib/api";

export type Send = (event: Record<string, unknown>) => void;

/**
 * A response that sends one JSON object per line as work progresses. The last line is either
 * { type: "done", ... } or { type: "error", error: { code, message } }, in the same shape as JSON errors.
 * Checks that can fail before any work starts should run first, so they still answer with a plain JSON error.
 */
export function ndjson(run: (send: Send) => Promise<void>, onClose?: () => void) {
  const encoder = new TextEncoder();
  let open = true;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      // If the browser goes away mid-stream the work still finishes (and saves); nothing more is sent.
      const send: Send = (event) => {
        if (!open) return;
        try { controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); } catch { open = false; }
      };
      try { await run(send); }
      catch (error) {
        if (error instanceof ApiError) send({ type: "error", error: { code: error.code, message: error.message } });
        else {
          console.error(JSON.stringify({ event: "api_error", type: error instanceof Error ? error.name : "unknown" }));
          send({ type: "error", error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } });
        }
      } finally {
        onClose?.();
        if (open) { open = false; try { controller.close(); } catch { /* already closed */ } }
      }
    },
    cancel() { open = false; },
  });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}

export const wantsStream = (request: Request) => request.headers.get("accept")?.includes("application/x-ndjson") ?? false;
