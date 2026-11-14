import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

const secrets = ["OPENAI_API_KEY", "LLM_PROVIDER_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "VERCEL_TOKEN", "VERCEL_OIDC_TOKEN"]
  .map((name) => ({ name, value: process.env[name] })).filter(({ value }) => value && value.length >= 16);
const sourceFiles = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? filesIn(join(directory, entry.name)) : [join(directory, entry.name)]));
  return nested.flat();
}
const files = [...new Set([...sourceFiles, ...await filesIn(".next/static")])];
let failed = false;
for (const file of files) {
  const contents = await readFile(file);
  for (const { name, value } of secrets) {
    if (contents.includes(value)) { console.error(`Private ${name} found in ${file}`); failed = true; }
  }
}
console.log(`${failed ? "FAIL" : "PASS"}: scanned ${files.length} repository/client-build files for configured private credentials.`);
process.exitCode = failed ? 1 : 0;
