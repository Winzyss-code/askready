import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// lib/emotion.ts has no imports, so it can be transpiled and evaluated on its own.
const compiled = { exports: {} };
new Function("module", "exports", ts.transpileModule(readFileSync("lib/emotion.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(compiled, compiled.exports);
const { createEmotionReader, parseEmotion } = compiled.exports;

function stream(chunks, allowed) {
  const reader = createEmotionReader(allowed);
  const released = chunks.map((chunk) => ({ chunk, out: reader.push(chunk), emotion: reader.emotion }));
  const rest = reader.end();
  return { released, text: (released.map((step) => step.out).join("") + rest).trim(), emotion: reader.emotion };
}

test("a valid tag sets the emotion and is removed", () => {
  assert.deepEqual(parseEmotion("[skeptical] I hear you, but budgets are tight."), { emotion: "skeptical", text: "I hear you, but budgets are tight." });
  assert.deepEqual(parseEmotion("  [Warm]Thanks for coming in."), { emotion: "warm", text: "Thanks for coming in." });
});

test("a missing tag is neutral and the text is untouched", () => {
  assert.deepEqual(parseEmotion("What did you have in mind?"), { emotion: "neutral", text: "What did you have in mind?" });
  assert.deepEqual(parseEmotion(""), { emotion: "neutral", text: "" });
});

test("an invalid or disallowed tag is neutral and still removed", () => {
  assert.deepEqual(parseEmotion("[furious] Fine."), { emotion: "neutral", text: "Fine." });
  assert.deepEqual(parseEmotion("[warm] Fine.", ["skeptical", "neutral"]), { emotion: "neutral", text: "Fine." });
  // A stray mood tag later in the reply never reaches the transcript or the voice.
  assert.deepEqual(parseEmotion("[impatient] Look. [skeptical] Why now?"), { emotion: "impatient", text: "Look. Why now?" });
  // An unclosed bracket that runs on is real text, not a tag.
  assert.equal(parseEmotion("[this is not a tag, it runs on far too long").text, "[this is not a tag, it runs on far too long");
});

test("a tag split across stream chunks is resolved before any text is released", () => {
  const { released, text, emotion } = stream(["[sk", "eptic", "al] I hear", " you."]);
  assert.deepEqual(released.map((step) => step.out), ["", "", "I hear", " you."]);
  // The emotion is known on the chunk that closes the tag, the same chunk that releases the first words.
  assert.equal(released[2].emotion, "skeptical");
  assert.equal(released[1].emotion, "neutral");
  assert.equal(text, "I hear you.");
  assert.equal(emotion, "skeptical");
});

test("streams without a tag, or with only a partial one, behave like whole replies", () => {
  assert.deepEqual(stream(["  ", "What", " brings you here?"]).released.map((step) => step.out), ["", "What", " brings you here?"]);
  assert.equal(stream(["[warm"]).text, "");
  // A split tag that is a real mood but not one this temperament shows: removed, and neutral.
  const disallowed = stream(["[im", "patient]", "", " Go on."], ["warm", "neutral"]);
  assert.equal(disallowed.text, "Go on.");
  assert.equal(disallowed.emotion, "neutral");
});
