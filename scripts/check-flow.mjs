// Live acceptance check. Uses real app routes, Supabase, and OpenAI (billable).
// Only fictional rehearsal data is submitted. Never prints tokens or keys.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const origin = new URL(process.env.ASKREADY_TEST_URL || "http://localhost:3000").origin;
const dimensions = ["clear_request", "evidence", "structure", "objection_handling", "next_step"];
const cookies = new Map();

async function request(path, body, expected = 200, jar = cookies) {
  const started = performance.now();
  const multipart = body instanceof FormData;
  const response = await fetch(`${origin}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: origin,
      ...(body !== undefined && !multipart ? { "Content-Type": "application/json" } : {}),
      Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join("; "),
    },
    body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(125_000),
  });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";")[0];
    const split = pair.indexOf("=");
    jar.set(pair.slice(0, split), pair.slice(split + 1));
  }
  const audio = response.headers.get("content-type")?.startsWith("audio/");
  const result = audio ? await response.blob() : await response.json();
  console.log(`${path}: HTTP ${response.status}, ${Math.round(performance.now() - started)} ms`);
  assert.equal(response.status, expected, `${path}: ${result.error?.code ?? "unexpected status"}`);
  return result;
}

function verifyScores(scores, sources) {
  assert.deepEqual(Object.keys(scores).sort(), [...dimensions].sort());
  for (const value of Object.values(scores)) {
    assert.ok(Number.isInteger(value.score) && value.score >= 0 && value.score <= 100);
    assert.ok(value.quote.trim() && sources.some((text) => text.includes(value.quote)), "Quotes must match actual answers");
  }
}

try {
  const auth = await request("/api/auth", {});
  const resumed = await request("/api/auth", {});
  assert.equal(auth.user.id, resumed.user.id);
  const setup = {
    role: "Operations analyst",
    desiredRaise: "A 10% raise",
    achievements: ["Reduced weekly reporting time from 5 hours to 3 hours", "Trained two new colleagues"],
    objection: "The budget is frozen until next quarter",
  };
  const start = { action: "start", scenarioId: "raise", personaId: "budget", setup, requestId: randomUUID() };
  let bundle = await request("/api/turn", start);
  const id = bundle.session.id;
  assert.deepEqual(bundle.session.setup, setup);
  assert.equal(bundle.turns.length, 1);
  const duplicate = await request("/api/turn", start);
  assert.equal(duplicate.session.id, id, "Start retries must not spend another session");
  console.log("PASS checkpoint 2: setup is validated and persisted with the selected configuration.");

  if (process.argv.includes("--voice")) {
    // Generated manager audio is a speech fixture, not evidence of physical mic capture.
    const audio = await request("/api/speak", { sessionId: id, turnId: bundle.turns[0].id });
    assert.ok(audio instanceof Blob && audio.size > 100);
    const form = new FormData();
    form.set("sessionId", id);
    form.set("attempt", "0");
    form.set("audio", audio, "manager-fixture.mp3");
    const transcription = await request("/api/transcribe", form);
    assert.ok(transcription.text.trim());
    assert.ok(transcription.audioDurationMs > 0);
    console.log("PASS voice services: real TTS audio transcribed by Whisper; physical mic/playback still require browser QA.");
  }

  for (const text of [
    "I think I deserve a 10% raise. I have been working hard and helping the team.",
    "I understand the budget is frozen until next quarter. I reduced weekly reporting time from 5 hours to 3 hours and trained two new colleagues. Could we discuss a raise when next quarter starts?",
  ]) {
    const input = { action: "reply", sessionId: id, requestId: randomUUID(), attempt: 0, text, audioDurationMs: null };
    bundle = await request("/api/turn", input);
    const count = bundle.turns.length;
    const retried = await request("/api/turn", input);
    assert.equal(retried.turns.length, count, "Request retry must not duplicate a turn");
    assert.ok(bundle.turns.some((turn) => turn.text === text));
  }
  assert.equal(bundle.turns.length, 5);
  console.log("PASS checkpoint 3: real manager conversation, saved transcript, idempotent sends.");

  bundle = await request("/api/feedback", { sessionId: id, attempt: 0 });
  const first = bundle.feedback.find((entry) => entry.attempt === 0);
  const originals = bundle.turns.filter((turn) => turn.role === "user" && turn.attempt === 0).map((turn) => turn.text);
  verifyScores(first.scores, originals);
  assert.equal(first.improvements.length, 3);
  for (const improvement of first.improvements) assert.ok(originals.some((text) => text.includes(improvement.quote)));
  verifyScores(first.focus.baselineScores, [first.focus.answer]);
  assert.ok(bundle.turns.some((turn) => turn.id === first.focus.objectionTurnId && turn.text === first.focus.objection));
  console.log("PASS checkpoint 4: persisted structured feedback, three grounded improvements, exact quotes.");

  const retryText = "I understand the timing and budget concern. I am asking for a 10% raise. I reduced weekly reporting time from 5 hours to 3 hours and trained two new colleagues. If an increase is not possible now, can we agree on the criteria and schedule a decision for the start of next quarter?";
  await request("/api/turn", { action: "reply", sessionId: id, requestId: randomUUID(), attempt: 1, text: retryText, audioDurationMs: null });
  bundle = await request("/api/feedback", { sessionId: id, attempt: 1 });
  const retry = bundle.feedback.find((entry) => entry.attempt === 1);
  verifyScores(retry.scores, [retryText]);
  assert.equal(bundle.turns.find((turn) => turn.attempt === 1 && turn.role === "assistant").text, first.focus.objection);
  assert.equal(bundle.session.status, "complete");
  const refreshed = await request(`/api/sessions/${id}`);
  assert.deepEqual(refreshed.feedback, bundle.feedback);
  console.log("PASS checkpoint 5: same-objection retry, same rubric, comparison persists after reload.");

  const limited = await request("/api/turn", { ...start, requestId: randomUUID() }, 429);
  assert.equal(limited.error.code, "DAILY_LIMIT");
  assert.equal(first.delivery_stats.wordsPerMinute, null);
  assert.equal(retry.delivery_stats.wordsPerMinute, null);
  console.log("PASS checkpoint 7: daily limit enforced; text-only answers have no fabricated speaking pace.");

  await request("/api/waitlist", { email: `askready-check-${randomUUID()}@example.com` });
  console.log("PASS checkpoint 8: real waitlist save with a fictional example.com test address.");

  const other = new Map();
  await request("/api/auth", {}, 200, other);
  await request(`/api/sessions/${id}`, undefined, 404, other);
  console.log("PASS isolation: a second anonymous account cannot read this session.");
  console.log(`PASS live flow at ${origin}; results stored at /results/${id}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Live acceptance failed");
  process.exitCode = 1;
}
