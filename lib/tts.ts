import "server-only";
import { ApiError } from "@/lib/api";
import { recordTiming } from "@/lib/timing";

export async function synthesize(text: string): Promise<ArrayBuffer> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new ApiError(503, "VOICE_NOT_CONFIGURED", "AI speech is unavailable. Your browser can read the reply instead.");
  if (!text.trim() || text.length > 2000) throw new ApiError(400, "INVALID_SPEECH_TEXT", "The reply cannot be read aloud.");
  const started = performance.now();
  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "tts-1", voice: "alloy", input: text, response_format: "mp3" }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new ApiError(502, "SPEECH_FAILED", "AI speech is unavailable. Your browser can read the reply instead.");
    const audio = await response.arrayBuffer();
    if (!audio.byteLength) throw new ApiError(502, "SPEECH_FAILED", "The reply audio was empty. Read the reply or try playback again.");
    return audio;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "SPEECH_UNAVAILABLE", "AI speech took too long or could not connect. Read the reply or use browser speech.");
  } finally {
    recordTiming("speak", performance.now() - started);
  }
}
