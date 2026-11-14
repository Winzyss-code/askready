import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

// Transpile only these pure modules in memory; production source remains unchanged.
// This avoids adding a test runner solely to resolve Next's TypeScript aliases.
const require = createRequire(import.meta.url);
const modules = new Map();
function load(relativePath) {
  const filename = path.resolve(relativePath);
  if (modules.has(filename)) return modules.get(filename);
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  const scopedRequire = (name) => name.startsWith("@/") ? load(`${name.slice(2)}.ts`) : require(name);
  new Function("module", "exports", "require", code)(compiledModule, compiledModule.exports, scopedRequire);
  modules.set(filename, compiledModule.exports);
  return compiledModule.exports;
}

const { deliveryStats, isExactQuote, assertGroundedScores, buildImprovements, answeredObjections, nextExercise } = load("lib/scoring.ts");
const { rubric } = load("config/rubric.ts");
const turn = (text, role = "user", duration = null, sequence = 0, attempt = 0) => ({
  id: `turn-${attempt}-${sequence}`, session_id: "session", role, text, audio_duration_ms: duration, attempt, sequence, created_at: "2026-01-01T00:00:00Z",
});
const setup = { role: "Analyst", desiredRaise: "A 10% raise", achievements: ["Reduced processing time by 20%", "Trained two colleagues"], objection: "Budget is frozen" };
const scores = (quote) => Object.fromEntries(rubric.map(({ id }) => [id, { score: 50, quote, reason: "Partly specific" }]));

test("delivery counts phrase boundaries and excludes manager words", () => {
  const stats = deliveryStats([
    turn("Um, maybe I think we could, you know, just improve. Unlike the last time, basically."),
    turn("Um uh like basically maybe", "assistant"),
  ]);
  assert.equal(stats.fillers.um, 1);
  assert.equal(stats.fillers.like, 0); // Unlike is not like.
  assert.equal(stats.fillers["you know"], 1);
  assert.equal(stats.fillers.basically, 1);
  assert.equal(stats.hedges["I think"], 1);
  assert.equal(stats.hedges.just, 1);
  assert.equal(stats.wordsPerMinute, null);
});

test("pace uses only recorded user words, and sums actual durations", () => {
  const stats = deliveryStats([
    turn("one two three four", "user", 2000),
    turn("five six", "user", 1000),
    turn("typed words must not inflate speaking pace", "user"),
    turn("manager words never count", "assistant", 1000),
  ]);
  assert.equal(stats.recordedWordCount, 6);
  assert.equal(stats.audioDurationMs, 3000);
  assert.equal(stats.wordsPerMinute, 120);
  assert.equal(stats.wordCount, 13);
});

test("phrase detection cannot join words from separate turns", () => {
  const stats = deliveryStats([turn("Do you"), turn("know the result?"), turn("I"), turn("think so")]);
  assert.equal(stats.fillers["you know"], 0);
  assert.equal(stats.hedges["I think"], 0);
});

test("quotes must be exact and cannot be stitched across separate answers", () => {
  assert.ok(isExactQuote("10% raise", ["I want a 10% raise."]));
  assert.equal(isExactQuote("10% Raise", ["I want a 10% raise."]), false);
  assert.equal(isExactQuote("a raise now", ["I'd like a raise", "now is good"]), false);
  assert.throws(() => assertGroundedScores(scores("fabricated"), ["My real words"]));
});

test("rewrites preserve actual supporting facts and reject invented numbers", () => {
  const plan = { quote: "maybe a raise", dimension: "evidence", supportingFact: "Reduced processing time by 20%", why: "Use your actual result." };
  const result = buildImprovements([plan], setup, ["I want maybe a raise"]);
  assert.match(result[0].rewrite, /Reduced processing time by 20%/);
  assert.throws(() => buildImprovements([{ ...plan, supportingFact: "Grew revenue by 50%" }], setup, ["I want maybe a raise"]));
  assert.match(buildImprovements([{ ...plan, supportingFact: "" }], setup, ["I want maybe a raise"])[0].rewrite, /\[add a measurable result\]/);
  assert.throws(() => buildImprovements([{ ...plan, supportingFact: "increase sales" }], setup, ["I did not increase sales", "I want maybe a raise"]));
});

test("focus candidates exclude greeting, unanswered final objection and retry", () => {
  const candidates = answeredObjections([
    turn("What would you like to discuss?", "assistant", null, 0),
    turn("A raise", "user", null, 1),
    turn("Why now?", "assistant", null, 2),
    turn("My responsibilities grew", "user", null, 3),
    turn("What results?", "assistant", null, 4),
    turn("My retry", "user", null, 0, 1),
  ]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].objection.text, "Why now?");
  assert.equal(candidates[0].answer.text, "My responsibilities grew");
});

test("next exercise follows the weakest dimension with stable ties", () => {
  const input = scores("My words");
  input.evidence.score = 25;
  assert.equal(nextExercise(input).id, "evidence");
});

test("scenario config is complete: tracks, unique ids, and a three-step lesson for every live scenario", () => {
  const { scenarios } = load("config/scenarios.ts");
  const { tracks } = load("config/tracks.ts");
  const { personas } = load("config/personas.ts");
  const dimensions = rubric.map(({ id }) => id);
  assert.equal(new Set(scenarios.map(({ id }) => id)).size, scenarios.length);
  assert.ok(scenarios.some(({ live }) => live));
  for (const scenario of scenarios) {
    assert.ok(tracks.some(({ id }) => id === scenario.trackId), `${scenario.id} has an unknown track`);
    for (const text of [scenario.userRole, scenario.counterpart.role, scenario.counterpart.label, scenario.opening, scenario.systemPrompt, scenario.fields.request.label, scenario.fields.facts.legend, scenario.fields.objection.label]) assert.ok(text.trim(), `${scenario.id} has empty config`);
    assert.equal(scenario.fields.facts.labels.length, 2);
    if (!scenario.live) continue;
    assert.ok(scenario.lesson, `${scenario.id} is live without a lesson`);
    assert.equal(scenario.lesson.steps.length, 3);
    for (const step of scenario.lesson.steps) assert.ok(dimensions.includes(step.dimension), `${scenario.id} lesson uses an unknown dimension`);
    assert.ok(scenario.lesson.weak.trim() && scenario.lesson.strong.trim());
  }
  // The counterpart's role comes from the scenario, so temperaments must not name one.
  for (const persona of personas) assert.doesNotMatch(persona.systemPrompt, /manager|employee/i);
});

const { buildProgress, levelFor } = load("lib/progress.ts");
const { liveScenarios } = load("config/scenarios.ts");
const NOW = new Date("2026-11-15T10:00:00Z");
const flat = (value) => Object.fromEntries(rubric.map(({ id }) => [id, { score: value, quote: "q", reason: "r" }]));
const saved = (day, scenario_id = "raise", status = "complete", value = 50) => ({
  id: `${scenario_id}-${day}`, scenario_id, status, created_at: `${day}T08:00:00Z`, scores: status === "practice" ? null : flat(value),
});

test("progress is empty, with no placeholder numbers, before any session", () => {
  const progress = buildProgress([], NOW);
  assert.equal(progress.completed, 0);
  assert.deepEqual(progress.today, { used: false, sessionId: null, scenarioId: null, status: null });
  assert.equal(progress.streak.current, 0);
  assert.equal(progress.streak.week.length, 7);
  assert.equal(progress.streak.week[6].date, "2026-11-15");
  assert.ok(progress.skills.every((skill) => skill.score === null && skill.level === null && skill.samples === 0));
  assert.deepEqual(progress.next, { scenarioId: liveScenarios[0].id, focus: null });
});

test("a session still in practice uses up today but is not a completed session", () => {
  const progress = buildProgress([saved("2026-11-15", "pushback", "practice")], NOW);
  assert.deepEqual(progress.today, { used: true, sessionId: "pushback-2026-11-15", scenarioId: "pushback", status: "practice" });
  assert.equal(progress.completed, 0);
  assert.equal(progress.streak.current, 0);
  assert.equal(progress.skills[0].score, null);
});

test("days in a row count consecutive UTC days ending today or yesterday", () => {
  const three = [saved("2026-11-15"), saved("2026-11-14"), saved("2026-11-13"), saved("2026-11-11")];
  assert.equal(buildProgress(three, NOW).streak.current, 3);
  assert.equal(buildProgress(three.slice(1), NOW).streak.current, 2); // today still open
  assert.equal(buildProgress([saved("2026-11-13"), saved("2026-11-12")], NOW).streak.current, 0); // ended two days ago
  assert.deepEqual(buildProgress(three, NOW).streak.week.map((day) => day.done), [false, false, true, false, true, true, true]);
  // 23:30 UTC on the 14th and 00:30 UTC on the 15th are different days, whatever the viewer's time zone.
  const late = [{ ...saved("2026-11-14"), created_at: "2026-11-14T23:30:00Z" }, { ...saved("2026-11-15"), created_at: "2026-11-15T00:30:00Z" }];
  assert.equal(buildProgress(late, NOW).streak.current, 2);
});

test("skill levels average the last three first attempts and change at 40, 60 and 80", () => {
  assert.deepEqual([0, 39, 40, 59, 60, 79, 80, 100].map(levelFor), [1, 1, 2, 2, 3, 3, 4, 4]);
  const progress = buildProgress([saved("2026-11-15", "raise", "complete", 90), saved("2026-11-14", "raise", "feedback", 60), saved("2026-11-13", "raise", "complete", 30), saved("2026-11-12", "raise", "complete", 0)], NOW);
  assert.ok(progress.skills.every((skill) => skill.score === 60 && skill.level === 3 && skill.samples === 3));
  const uneven = saved("2026-11-15");
  uneven.scores.next_step.score = 20;
  assert.equal(buildProgress([uneven], NOW).next.focus, "next_step");
  assert.equal(buildProgress([saved("2026-11-15")], NOW).next.focus, rubric[0].id); // a tie goes to rubric order
});

test("the next conversation is one never practiced, then the one practiced longest ago", () => {
  const [first, second, third] = liveScenarios.map((scenario) => scenario.id);
  assert.equal(buildProgress([saved("2026-11-15", first)], NOW).next.scenarioId, second);
  assert.equal(buildProgress([saved("2026-11-15", first), saved("2026-11-14", second)], NOW).next.scenarioId, third);
  const all = buildProgress([saved("2026-11-15", second), saved("2026-11-14", third), saved("2026-11-13", first), saved("2026-11-12", second)], NOW);
  assert.equal(all.next.scenarioId, first);
  assert.deepEqual(all.scenarios.find((item) => item.id === second), { id: second, completed: 2, lastAt: "2026-11-15T08:00:00Z" });
  // A session abandoned in practice does not count as having practiced that conversation.
  assert.equal(buildProgress([saved("2026-11-15", first, "practice")], NOW).next.scenarioId, first);
});
