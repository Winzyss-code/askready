// Read-only provider/configuration preflight. Never print credentials or rows.
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

let failed = false;
const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY", "LLM_MODEL_FAST", "LLM_MODEL_STRONG"];
for (const name of required) {
  if (!process.env[name]?.trim()) { console.error(`MISSING ${name}`); failed = true; }
}
if (failed) process.exit(1);

const base = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: serviceKey, ...(serviceKey.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${serviceKey}` }) };
for (const [table, columns] of [
  ["sessions", "id,status,request_id"], ["turns", "id,attempt,sequence,request_id"],
  ["feedback", "id,focus"], ["waitlist", "id,user_id"],
]) {
  try {
    const response = await fetch(`${base}/rest/v1/${table}?select=${columns}&limit=0`, { headers, signal: AbortSignal.timeout(15_000) });
    const result = await response.json();
    console.log(`Database ${table}: ${response.ok ? "PASS" : `HTTP ${response.status}, ${result.code ?? "error"}`}`);
    if (!response.ok) failed = true;
  } catch { console.error(`Database ${table}: connection failed`); failed = true; }
}
for (const model of new Set([process.env.LLM_MODEL_FAST, process.env.LLM_MODEL_STRONG, "whisper-1", "tts-1"])) {
  try {
    const isVoice = model === "whisper-1" || model === "tts-1";
    const key = isVoice ? process.env.OPENAI_API_KEY : process.env.LLM_PROVIDER_API_KEY || process.env.OPENAI_API_KEY;
    const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
    console.log(`Model ${model}: ${response.ok ? "accessible" : `HTTP ${response.status}`}`);
    if (!response.ok) failed = true;
  } catch { console.error(`Model ${model}: connection failed`); failed = true; }
}
process.exitCode = failed ? 1 : 0;
