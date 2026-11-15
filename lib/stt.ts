import "server-only";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import { recordTiming } from "@/lib/timing";

const resultSchema = z.object({
  text: z.string().trim().max(3000),
  duration: z.number().positive().optional(),
});

/** `prompt` is the text just before this audio, so a piece of a longer answer is transcribed in context. */
export async function transcribe(audio: File, prompt?: string): Promise<{ text: string; durationMs: number | null }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new ApiError(503, "VOICE_NOT_CONFIGURED", "Voice transcription is unavailable. You can type your answer instead.");
  if (!audio.size || audio.size > 3_500_000) throw new ApiError(413, "AUDIO_TOO_LARGE", "Use a recording smaller than 3.5 MB, or type your answer.");
  const body = new FormData();
  body.set("file", audio);
  body.set("model", "whisper-1");
  body.set("response_format", "verbose_json");
  body.set("language", "en");
  if (prompt?.trim()) body.set("prompt", prompt.trim());
  const started = performance.now();
  try {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: `Bearer ${key}` }, body,
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) {
      throw new ApiError(response.status === 429 ? 429 : 502, "TRANSCRIPTION_FAILED", "We couldn’t transcribe that recording. Try again or type your answer.");
    }
    const parsed = resultSchema.safeParse(await response.json());
    if (!parsed.success || !parsed.data.text) throw new ApiError(422, "NO_SPEECH", "We couldn’t hear a clear answer. Try recording again or type it below.");
    if (parsed.data.duration && parsed.data.duration > 95) throw new ApiError(413, "AUDIO_TOO_LONG", "Keep each answer under 90 seconds, or type your answer.");
    return { text: parsed.data.text, durationMs: parsed.data.duration ? Math.round(parsed.data.duration * 1000) : null };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "TRANSCRIPTION_UNAVAILABLE", "Transcription took too long or could not connect. Try again or type your answer.");
  } finally {
    recordTiming("transcribe", performance.now() - started);
  }
}
