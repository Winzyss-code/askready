import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse, requireSameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { loadSession, requireUser } from "@/lib/sessions";
import { transcribe } from "@/lib/stt";
export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_BODY = 3_700_000;

async function boundedForm(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) throw new ApiError(415, "INVALID_AUDIO", "Send an audio recording.");
  if (Number(request.headers.get("content-length")) > MAX_BODY) throw new ApiError(413, "AUDIO_TOO_LARGE", "Keep recordings under 90 seconds and 3.5 MB.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "INVALID_AUDIO", "Record an answer first.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); throw new ApiError(413, "AUDIO_TOO_LARGE", "Keep recordings under 90 seconds and 3.5 MB."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type")! } }).formData(); }
  catch { throw new ApiError(400, "INVALID_AUDIO", "The recording could not be read. Try again or type your answer."); }
}
export async function POST(request: Request) {
  const started = performance.now();
  try {
    requireSameOrigin(request);
    const { user, accessToken } = await requireUser();
    rateLimit(`stt:${user.id}`, 15);
    const form = await boundedForm(request);
    const input = z.object({ sessionId: z.uuid(), attempt: z.enum(["0", "1"]), audio: z.instanceof(File).refine(f => f.size > 0 && f.size <= 3_500_000 && /^(audio\/(webm|mp4|mpeg|wav|ogg)|video\/(webm|mp4))(;.*)?$/.test(f.type)) }).safeParse({ sessionId: form.get("sessionId"), attempt: form.get("attempt"), audio: form.get("audio") });
    if (!input.success) throw new ApiError(400, "INVALID_AUDIO", "Use a supported recording under 3.5 MB, or type your answer.");
    const bundle = await loadSession(input.data.sessionId, accessToken);
    const expectedStatus = input.data.attempt === "0" ? "practice" : "feedback";
    if (bundle.session.status !== expectedStatus) throw new ApiError(409, "SESSION_CLOSED", "This practice step has finished. Refresh your session to continue.");
    const result = await transcribe(input.data.audio);
    if (result.durationMs && result.durationMs > 180000) throw new ApiError(400, "AUDIO_TOO_LONG", "Keep answers under three minutes.");
    return NextResponse.json({ text: result.text, audioDurationMs: result.durationMs }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
  finally { console.info(JSON.stringify({ event: "stage_timing", stage: "transcribe_total", durationMs: Math.round(performance.now() - started) })); }
}
