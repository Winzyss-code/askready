// Explicit deployment helper: pipe selected values into Vercel, never argv/logs.
import { spawnSync } from "node:child_process";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

const keys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY", "LLM_PROVIDER_API_KEY", "LLM_MODEL_FAST", "LLM_MODEL_STRONG"];
for (const key of keys) {
  const value = process.env[key]?.trim();
  if (!value && key === "LLM_PROVIDER_API_KEY") continue;
  if (!value) throw new Error(`Missing ${key}; configure .env.local before deployment`);
  const secret = !key.startsWith("NEXT_PUBLIC_") && key.endsWith("KEY");
  const result = spawnSync("npx", ["--yes", "vercel@65.16.0", "env", "add", key,
    "--environment", "production", "--force", "--yes", secret ? "--sensitive" : "--no-sensitive"], {
    input: value, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 60_000,
  });
  if (result.status !== 0) {
    // Upstream output is deliberately not dumped: stdin contained a secret.
    console.error(`Failed to configure ${key}; run vercel env ls to inspect the project.`);
    let diagnostic = `${result.error?.message ?? ""}\n${result.stderr ?? ""}`;
    for (const name of [...keys, "VERCEL_TOKEN", "VERCEL_OIDC_TOKEN"]) {
      if (process.env[name]) diagnostic = diagnostic.replaceAll(process.env[name], "[redacted]");
    }
    console.error(diagnostic);
    process.exit(1);
  }
  console.log(`Configured ${key} (${secret ? "secret" : "config"})`);
}
