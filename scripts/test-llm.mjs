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
    assert.match(request.messages[0].content, /Allowed tags: \[skeptical\] \[impatient\] \[impressed\]/);
    return completion("[skeptical] What would you like to discuss?");
  };
  assert.deepEqual(await roleplay(session, []), { text: "What would you like to discuss?", emotion: "skeptical" });
});

test("roleplay strips the mood tag and keeps the temperament's moods", async () => {
  const cases = [
    ["[impatient] Get to the point.", { text: "Get to the point.", emotion: "impatient" }],
    ["Get to the point.", { text: "Get to the point.", emotion: "neutral" }], // missing
    ["[furious] Get to the point.", { text: "Get to the point.", emotion: "neutral" }], // not a mood
    ["[warm] Get to the point.", { text: "Get to the point.", emotion: "neutral" }], // not one of the hard-liner's
  ];
  for (const [reply, expected] of cases) {
    globalThis.fetch = async () => completion(reply);
    assert.deepEqual(await roleplay(session, transcript), expected);
  }
  // The tag does not count toward the length limit; a reply that is only a tag is rejected.
  globalThis.fetch = async () => completion(`[skeptical] ${Array(65).fill("word").join(" ")}`);
  assert.equal((await roleplay(session, transcript)).text.split(" ").length, 65);
  globalThis.fetch = async () => completion("[skeptical]");
  await assert.rejects(roleplay(session, transcript), (error) => error.code === "AI_INVALID_RESPONSE");
});

test("roleplay keeps whole sentences up to three and 65 words, and rejects only what can't be cut", async () => {
  globalThis.fetch = async () => completion("[skeptical] One. Two. Three. Four.");
  assert.equal((await roleplay(session, transcript)).text, "One. Two. Three.");
  const long = `${Array(40).fill("word").join(" ")}. More ${Array(29).fill("more").join(" ")}.`;
  globalThis.fetch = async () => completion(long);
  assert.equal((await roleplay(session, transcript)).text.split(" ").length, 40); // the second sentence would pass 65
  globalThis.fetch = async () => completion(Array(66).fill("word").join(" "));
  await assert.rejects(roleplay(session, transcript), (error) => error.code === "AI_INVALID_RESPONSE");
  // Out of tokens mid-sentence: the cut-off sentence goes, and with nothing whole left the reply is rejected.
  const cut = (content) => new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content } }] }), { status: 200 });
  globalThis.fetch = async () => cut("A truncated");
  await assert.rejects(roleplay(session, transcript), (error) => error.code === "AI_INVALID_RESPONSE");
  globalThis.fetch = async () => cut("[skeptical] Fair point. But why");
  assert.equal((await roleplay(session, transcript)).text, "Fair point.");
});

// A streamed provider response, split at the given points, in the provider's server-sent event format.
const sse = (pieces, finish = "stop") => new Response(new ReadableStream({
  start(controller) {
    const encoder = new TextEncoder();
    for (const piece of pieces) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: piece }, finish_reason: null }] })}\n\n`));
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: finish }] })}\n\ndata: [DONE]\n\n`));
    controller.close();
  },
}), { status: 200, headers: { "Content-Type": "text/event-stream" } });

test("a streamed reply gives its mood first, then its words, then each sentence as soon as the next begins", async () => {
  let streamed;
  globalThis.fetch = async (_url, options) => { streamed = JSON.parse(options.body).stream; return sse(["[skep", "tical] I hear", " you. But budgets", " are frozen. Why", " now?"]); };
  const events = [];
  const result = await roleplay(session, transcript, (event) => events.push(event));
  assert.equal(streamed, true);
  assert.deepEqual(result, { text: "I hear you. But budgets are frozen. Why now?", emotion: "skeptical" });
  assert.deepEqual(events[0], { type: "emotion", emotion: "skeptical" });
  assert.ok(events.slice(1).every((event) => !JSON.stringify(event).includes("[skeptical]")), "the tag never reaches the words");
  const sentences = events.filter((event) => event.type === "sentence").map(({ text, index }) => [index, text]);
  assert.deepEqual(sentences, [[0, "I hear you."], [1, "But budgets are frozen."], [2, "Why now?"]]);
  // The first sentence is out before the last words arrive.
  assert.ok(events.findIndex((event) => event.type === "sentence") < events.findIndex((event) => event.type === "text" && event.text.includes("now")));
});

test("a streamed reply stops reading once three sentences are kept", async () => {
  let reads = 0;
  globalThis.fetch = async () => {
    const response = sse(["One. ", "Two. ", "Three. ", "Four. ", "Five. ", "Six."]);
    const reader = response.body.getReader();
    return new Response(new ReadableStream({ async pull(controller) { const { done, value } = await reader.read(); reads++; if (done) controller.close(); else controller.enqueue(value); } }), { status: 200 });
  };
  const result = await roleplay(session, transcript, () => {});
  assert.equal(result.text, "One. Two. Three.");
  assert.ok(reads < 7, `read ${reads} chunks; it should stop after the fourth sentence starts`);
});

test("a refusal or a broken stream is an error, never a reply", async () => {
  globalThis.fetch = async () => new Response(`data: ${JSON.stringify({ choices: [{ delta: { refusal: "No." }, finish_reason: null }] })}\n\ndata: [DONE]\n\n`, { status: 200 });
  await assert.rejects(roleplay(session, transcript, () => {}), (error) => error.code === "AI_REFUSAL");
  globalThis.fetch = async () => new Response("data: {not json\n\n", { status: 200 });
  await assert.rejects(roleplay(session, transcript, () => {}), (error) => error.code === "AI_INVALID_RESPONSE");
});

test("coaching reports each step only once the streamed JSON reaches it", async () => {
  const body = JSON.stringify(valid());
  const at = (key) => body.indexOf(`"${key}"`);
  globalThis.fetch = async () => sse([body.slice(0, 40), body.slice(40, at("improvements") + 5), body.slice(at("improvements") + 5, at("focus") + 3), body.slice(at("focus") + 3)]);
  const steps = [];
  await generateFeedback(session, transcript, (step) => steps.push(step));
  assert.deepEqual(steps, ["scoring", "changes", "moment", "checking"]);
  // A retry is reported, so the waiting screen can say why it's taking longer.
  let calls = 0;
  globalThis.fetch = async () => (calls++ === 0 ? sse(["{}"]) : sse([body]));
  const again = [];
  await generateFeedback(session, transcript, (step) => again.push(step));
  assert.deepEqual(again, ["scoring", "retrying", "scoring", "changes", "moment", "checking"]);
});
