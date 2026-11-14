// Synthetic, fictional speech for browser recorder integration testing only.
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const response = await fetch("https://api.openai.com/v1/audio/speech", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "tts-1", voice: "alloy", response_format: "wav", input: "I am asking for a ten percent raise. I reduced weekly reporting time from five hours to three hours and trained two new colleagues." }),
  signal: AbortSignal.timeout(30_000),
});
if (!response.ok) throw new Error(`Voice fixture generation failed: HTTP ${response.status}`);
await writeFile(join(tmpdir(), "askready-voice-fixture.wav"), Buffer.from(await response.arrayBuffer()), { mode: 0o600 });
console.log("Prepared synthetic speech fixture in the temporary directory.");
