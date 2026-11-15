import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";

// Live and billable: sends each fixed answer in scripts/calibration-set.json to the real coach (LLM_MODEL_STRONG)
// and checks every score against the expected range. `--runs=3` scores each answer three times to show spread.
// `--only=raise` limits it to case ids containing that text. Exits non-zero when fewer than 90% of scores land.
const args = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")).map(([key, value]) => [key, value ?? true]));
const runs = Math.max(1, Number(args.runs ?? 1));

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

const require = createRequire(import.meta.url);
const modules = new Map();
class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
function load(relativePath) {
  const filename = path.resolve(relativePath);
  if (modules.has(filename)) return modules.get(filename);
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  const scopedRequire = (name) => {
    if (name === "server-only") return {};
    if (name === "@/lib/api") return { ApiError };
    return name.startsWith("@/") ? load(`${name.slice(2)}.ts`) : require(name);
  };
  new Function("module", "exports", "require", code)(compiledModule, compiledModule.exports, scopedRequire);
  modules.set(filename, compiledModule.exports);
  return compiledModule.exports;
}
const { generateRetryFeedback } = load("lib/llm.ts");
const { rubric } = load("config/rubric.ts");
const set = JSON.parse(readFileSync("scripts/calibration-set.json", "utf8"));
const cases = set.cases.filter((item) => !args.only || item.id.includes(args.only));

async function score(item) {
  const session = { id: "calibration", user_id: "calibration", scenario_id: item.scenario, persona_id: "budget", setup: set.setups[item.scenario], status: "feedback", created_at: new Date().toISOString() };
  const retry = { id: "answer", session_id: "calibration", role: "user", text: item.answer, attempt: 1, sequence: 1, audio_duration_ms: null, created_at: session.created_at };
  const { scores } = await generateRetryFeedback(session, { objection: set.objections[item.scenario] }, retry);
  return rubric.map(({ id }) => scores[id].score);
}

// A few at a time keeps within provider rate limits.
const jobs = cases.flatMap((item) => Array.from({ length: runs }, () => item));
const results = new Map(cases.map((item) => [item.id, []]));
let next = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < jobs.length) {
    const item = jobs[next++];
    try { results.get(item.id).push(await score(item)); }
    catch (error) { results.get(item.id).push(error); console.error(`${item.id}: ${error.code ?? error.message}`); }
  }
}));

let inRange = 0, total = 0, failedCalls = 0, maxSpread = 0;
const generous = [];
const short = rubric.map(({ id }) => id.split("_").map((word) => word[0]).join("").toUpperCase());
console.log(`\n${"case".padEnd(26)} ${short.map((label) => label.padStart(14)).join("")}`);
for (const item of cases) {
  const attempts = results.get(item.id).filter((value) => Array.isArray(value));
  failedCalls += results.get(item.id).length - attempts.length;
  const cells = rubric.map((_, index) => {
    const values = attempts.map((scores) => scores[index]);
    const [low, high] = item.expect[index];
    const hits = values.filter((value) => value >= low && value <= high).length;
    inRange += hits; total += values.length;
    if (values.length > 1) maxSpread = Math.max(maxSpread, Math.max(...values) - Math.min(...values));
    return `${hits === values.length ? " " : "✗"}${values.join("/")} [${low}-${high}]`.padStart(14);
  });
  // A decent first answer must leave room to improve: at most two skills at 100.
  if (item.decent && attempts.some((scores) => scores.filter((value) => value === 100).length > 2)) generous.push(item.id);
  console.log(`${item.id.padEnd(26)} ${cells.join("")}`);
}
const share = total ? Math.round((inRange / total) * 100) : 0;
console.log(`\n${inRange}/${total} scores in range (${share}%) across ${cases.length} answers × ${runs} run${runs === 1 ? "" : "s"}.${runs > 1 ? ` Largest spread for one skill on one answer: ${maxSpread} points.` : ""}`);
if (failedCalls) console.log(`${failedCalls} coach call${failedCalls === 1 ? "" : "s"} failed and are not counted.`);
if (generous.length) console.log(`Decent first answers with more than two 100s: ${generous.join(", ")}`);
process.exit(share >= 90 && !generous.length && !failedCalls ? 0 : 1);
