import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test, { after, before } from "node:test";
import ts from "typescript";

// Provider responses are mocked ONLY in this isolated regression test.
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
const { generateFeedback, generateRetryFeedback, roleplay } = load("lib/llm.ts");
const { rubric } = load("config/rubric.ts");
const originalFetch = globalThis.fetch;
const variables = ["LLM_PROVIDER_API_KEY", "OPENAI_API_KEY", "LLM_MODEL_FAST", "LLM_MODEL_STRONG"];
const originalEnv = Object.fromEntries(variables.map((key) => [key, process.env[key]]));
before(() => {
  process.env.LLM_PROVIDER_API_KEY = "test-only-not-a-real-key";
  process.env.LLM_MODEL_FAST = "test-fast";
  process.env.LLM_MODEL_STRONG = "test-strong";
});
after(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
const setup = { role: "Analyst", desiredRaise: "A 10% raise", achievements: ["Reduced processing time by 20%", "Trained two colleagues"], objection: "Budgets are frozen" };
const session = { id: "session", user_id: "user", scenario_id: "raise", persona_id: "budget", setup, status: "practice", created_at: "2026-01-01" };
const turn = (id, role, text, sequence, attempt = 0) => ({ id, session_id: "session", role, text, sequence, attempt, audio_duration_ms: null, created_at: "2026-01-01" });
const transcript = [turn("opener", "assistant", "What brings you here?", 0), turn("first", "user", "I would like a raise.", 1), turn("objection", "assistant", "Why now?", 2), turn("answer", "user", "My responsibilities grew.", 3)];
const scores = (quote) => Object.fromEntries(rubric.map(({ id }) => [id, { score: 50, quote, reason: "This is partly specific." }]));
const plans = (quote) => ["evidence", "clear_request", "next_step"].map((dimension) => ({ quote, dimension, supportingFact: "Reduced processing time by 20%", why: "Make the point more specific." }));
const valid = () => ({ scores: scores("I would like a raise."), improvements: plans("I would like a raise."), focus: { objectionTurnId: "objection", answerTurnId: "answer", baselineScores: scores("My responsibilities grew.") } });
const completion = (content) => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content, refusal: null } }] }), { status: 200 });

test("malformed feedback retries once, then returns a recoverable error", async () => {
  let count = 0;
  globalThis.fetch = async () => { count++; return completion("not JSON"); };
  await assert.rejects(generateFeedback(session, transcript), (error) => error.code === "FEEDBACK_INVALID" && error.status === 502);
  assert.equal(count, 2);
});

test("a baseline quoting the wrong answer is rejected and repaired once", async () => {
  const wrong = valid();
  wrong.focus.baselineScores = scores("I would like a raise.");
  let count = 0;
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.equal(request.model, "test-strong");
    assert.equal(request.response_format.json_schema.strict, true);
    const factChoices = request.response_format.json_schema.schema.properties.improvements.items.properties.supportingFact.enum;
    assert.ok(factChoices.includes(setup.achievements[0]));
    assert.ok(factChoices.includes(""), "Missing evidence must allow a placeholder");
    assert.ok(!factChoices.includes("processing time by 20%"), "Partial facts must not be available choices");
    return completion(JSON.stringify(++count === 1 ? wrong : valid()));
  };
  const result = await generateFeedback(session, transcript);
  assert.equal(count, 2);
  assert.equal(result.focus.objection, "Why now?");
  assert.equal(result.focus.answer, "My responsibilities grew.");
  assert.equal(result.improvements.length, 3);
  assert.match(result.improvements[0].rewrite, /20%/);
});

test("empty, truncated and invalid-envelope completions each receive one repair attempt", async () => {
  for (const invalid of [
    { choices: [{ finish_reason: "stop", message: { content: null } }] },
    { choices: [{ finish_reason: "length", message: { content: '{"scores":' } }] },
    { choices: [] },
  ]) {
    let count = 0;
    globalThis.fetch = async () => ++count === 1 ? new Response(JSON.stringify(invalid), { status: 200 }) : completion(JSON.stringify(valid()));
    const result = await generateFeedback(session, transcript);
    assert.equal(count, 2);
    assert.equal(result.focus.answerTurnId, "answer");
  }
});

test("valid JSON with out-of-range scores is retried then rejected", async () => {
  const invalid = valid();
  invalid.scores.evidence.score = 101;
  let count = 0;
  globalThis.fetch = async () => { count++; return completion(JSON.stringify(invalid)); };
  await assert.rejects(generateFeedback(session, transcript), (error) => error.code === "FEEDBACK_INVALID");
  assert.equal(count, 2);
});

test("retry scoring gets the same objection and no previous scores or answer", async () => {
  const retry = turn("retry", "user", "I reduced processing time by 20%.", 0, 1);
  const focus = { objectionTurnId: "objection", answerTurnId: "answer", objection: "Why now?", answer: "My responsibilities grew.", baselineScores: scores("My responsibilities grew.") };
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    const evidence = JSON.parse(request.messages[1].content);
    assert.equal(evidence.objection, focus.objection);
    assert.equal(evidence.answer, retry.text);
    assert.equal(evidence.baselineScores, undefined);
    assert.equal(JSON.stringify(request).includes(focus.answer), false);
    return completion(JSON.stringify({ scores: scores(retry.text), improvements: plans(retry.text) }));
  };
  const result = await generateRetryFeedback(session, focus, retry);
  assert.equal(result.scores.evidence.quote, retry.text);
});

test("provider errors do not retry as malformed JSON", async () => {
  let count = 0;
  globalThis.fetch = async () => { count++; return new Response("{}", { status: 429 }); };
  await assert.rejects(generateFeedback(session, transcript), (error) => error.code === "AI_BUSY");
  assert.equal(count, 1);
});

test("roleplay uses fast model and actual setup without a fake fallback", async () => {
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.equal(request.model, "test-fast");
    assert.match(request.messages[1].content, /Reduced processing time by 20%/);
    assert.match(request.messages[0].content, /Never give coaching/);
    assert.match(request.messages[0].content, /You play the user's manager/);
    assert.doesNotMatch(request.messages[1].content, /desiredRaise/);
    return completion("What would you like to discuss?");
  };
  assert.equal(await roleplay(session, []), "What would you like to discuss?");
});

test("roleplay output must stay short and complete", async () => {
  for (const text of ["One. Two. Three. Four.", Array(66).fill("word").join(" ")]) {
    globalThis.fetch = async () => completion(text);
    await assert.rejects(roleplay(session, transcript), (error) => error.code === "AI_INVALID_RESPONSE");
  }
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "A truncated" } }] }), { status: 200 });
  await assert.rejects(roleplay(session, transcript), (error) => error.code === "AI_INVALID_RESPONSE");
});
