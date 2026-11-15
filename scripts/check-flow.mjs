// Live acceptance check. Uses real app routes, Supabase, and OpenAI (billable).
// Only fictional rehearsal data is submitted. Never prints tokens or keys.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const origin = new URL(process.env.ASKREADY_TEST_URL || "http://localhost:3000").origin;
const dimensions = ["clear_request", "evidence", "structure", "objection_handling", "next_step"];
const cookies = new Map();
const option = (name, fallback) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;

// Fictional rehearsal data per live scenario: a weak first answer, a stronger second, and a retry.
const fixtures = {
  raise: {
    setup: {
      role: "Operations analyst",
      desiredRaise: "A 10% raise",
      achievements: ["Reduced weekly reporting time from 5 hours to 3 hours", "Trained two new colleagues"],
      objection: "The budget is frozen until next quarter",
    },
    answers: [
      "I think I deserve a 10% raise. I have been working hard and helping the team.",
      "I understand the budget is frozen until next quarter. I reduced weekly reporting time from 5 hours to 3 hours and trained two new colleagues. Could we discuss a raise when next quarter starts?",
    ],
    retry: "I understand the timing and budget concern. I am asking for a 10% raise. I reduced weekly reporting time from 5 hours to 3 hours and trained two new colleagues. If an increase is not possible now, can we agree on the criteria and schedule a decision for the start of next quarter?",
  },
  pushback: {
    setup: {
      role: "Operations analyst",
      desiredRaise: "Move the vendor audit to next sprint",
      achievements: ["The billing migration is due this Friday", "The quarterly report is due this Friday"],
      objection: "Everyone is stretched. I need you to make it work.",
    },
    answers: [
      "I guess I can try to fit the vendor audit in, I am just pretty busy right now.",
      "I want the audit done well too. The billing migration is due this Friday and the quarterly report is due this Friday. If I take the audit on now, one of them slips. Can we move the vendor audit to next sprint?",
    ],
    retry: "I understand everyone is stretched, and I want the audit done well. The billing migration is due this Friday and the quarterly report is due this Friday. If I start the audit now, one of them slips. Which one should move, or can the vendor audit start on Monday?",
  },
  feedback: {
    setup: {
      role: "Marketing manager",
      desiredRaise: "Send your section of the client report by Thursday noon",
      achievements: ["Last week your section arrived two days after the deadline", "I rewrote the summary overnight so the report could go out"],
      objection: "I've been swamped, and nobody told me it was urgent.",
    },
    answers: [
      "You are kind of always late with your part and it is becoming a problem.",
      "Last week your section arrived two days after the deadline, and I rewrote the summary overnight so the report could go out. I need your section of the client report by Thursday noon.",
    ],
    retry: "I hear that you have been swamped. Last week your section arrived two days after the deadline, and I rewrote the summary overnight so the report could go out. I need your section of the client report by Thursday noon. Can we agree on that and check in next Friday?",
  },
  boundary: {
    persona: "guilt",
    setup: {
      role: "Their older sister",
      desiredRaise: "I can't lend you my car on weekends anymore",
      achievements: ["Last month the car came back with an empty tank twice", "I missed my Saturday class because the car was not back on time"],
      objection: "After everything I've done for you? It's just one weekend.",
    },
    answers: [
      "Um, so the car thing is kind of a lot lately, I guess, I don't know.",
      "I love helping you, but I can't lend you my car on weekends anymore. Last month the car came back with an empty tank twice, and I missed my Saturday class because the car was not back on time.",
    ],
    retry: "I know you've done a lot for me, and I love you. I can't lend you my car on weekends anymore. Last month the car came back with an empty tank twice, and I missed my Saturday class because the car was not back on time. I can drive you to the station on Saturday mornings instead. Would that work for you?",
    // A friend or relative, not a manager: none of this should come from the counterpart.
    offRole: /\b(manager|boss|budget|promotion|raise|sprint|deadlines?|projects?|priorit\w*|approv\w*|company|office|team|performance)\b/i,
  },
};
const scenarioId = option("scenario", "raise");
const fixture = fixtures[scenarioId];

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

// The streamed form of a route: every event in order with when it arrived, then the saved bundle.
async function streamRequest(path, body) {
  const started = performance.now();
  const response = await fetch(`${origin}${path}`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", Accept: "application/x-ndjson", Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; ") },
    body: JSON.stringify(body), signal: AbortSignal.timeout(125_000),
  });
  assert.equal(response.status, 200, `${path} (stream): HTTP ${response.status}`);
  assert.match(response.headers.get("content-type") ?? "", /application\/x-ndjson/);
  const events = [];
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    for (let newline = buffer.indexOf("\n"); newline !== -1; newline = buffer.indexOf("\n")) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (line.trim()) events.push({ ...JSON.parse(line), at: Math.round(performance.now() - started) });
    }
  }
  const error = events.find((event) => event.type === "error");
  assert.ok(!error, `${path} (stream): ${error?.error?.code}`);
  const done = events.find((event) => event.type === "done");
  assert.ok(done, `${path} (stream) ended without saving`);
  console.log(`${path} (stream): ${events.length} events, saved at ${done.at} ms`);
  return { events, bundle: done.bundle };
}

function verifyScores(scores, sources) {
  assert.deepEqual(Object.keys(scores).sort(), [...dimensions].sort());
  for (const value of Object.values(scores)) {
    assert.ok(Number.isInteger(value.score) && value.score >= 0 && value.score <= 100);
    assert.ok(value.quote.trim() && sources.some((text) => text.includes(value.quote)), "Quotes must match actual answers");
  }
}

try {
  assert.ok(fixture, `No fixture for scenario "${scenarioId}". Use one of: ${Object.keys(fixtures).join(", ")}`);
  const auth = await request("/api/auth", {});
  const resumed = await request("/api/auth", {});
  assert.equal(auth.user.id, resumed.user.id);
  const before = (await request("/api/progress")).progress;
  assert.equal(before.completed, 0);
  assert.equal(before.today.used, false);
  assert.ok(before.skills.every((skill) => skill.score === null));
  const setup = fixture.setup;
  const start = { action: "start", scenarioId, personaId: option("persona", fixture?.persona ?? "budget"), setup, requestId: randomUUID() };
  let bundle = await request("/api/turn", start);
  const id = bundle.session.id;
  assert.deepEqual(bundle.session.setup, setup);
  assert.equal(bundle.turns.length, 1);
  const duplicate = await request("/api/turn", start);
  assert.equal(duplicate.session.id, id, "Start retries must not spend another session");
  console.log("PASS checkpoint 2: setup is validated and persisted with the selected configuration.");

  if (process.argv.includes("--voice")) {
    // Generated counterpart audio is a speech fixture, not evidence of physical mic capture.
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

  const moods = ["neutral", "skeptical", "warm", "impatient", "impressed"];
  const reactions = [bundle.reaction];
  for (const [index, text] of fixture.answers.entries()) {
    const input = { action: "reply", sessionId: id, requestId: randomUUID(), attempt: 0, text, audioDurationMs: null };
    if (index === 1) {
      // The streamed reply: mood first, then words, then each sentence and its voice, then the saved session.
      const { events, bundle: saved } = await streamRequest("/api/turn", input);
      bundle = saved;
      assert.equal(events[0].type, "emotion");
      const sentences = events.filter((event) => event.type === "sentence");
      const audio = events.filter((event) => event.type === "audio");
      assert.ok(sentences.length >= 1 && sentences.length <= 3, "A reply is one to three sentences");
      assert.equal(audio.length, sentences.length, "Every kept sentence gets its voice, or a fallback");
      assert.ok(audio.every((event) => typeof event.data === "string" && event.data.length > 100), "Sentence speech failed");
      const reply = bundle.turns.filter((turn) => turn.role === "assistant").sort((a, b) => b.sequence - a.sequence)[0];
      assert.equal(reply.text, sentences.map((event) => event.text).join(" "), "What was spoken is what was saved");
      assert.equal(bundle.reaction.emotion, events[0].emotion);
      console.log(`PASS streaming reply: ${sentences.length} sentence(s); first sentence at ${sentences[0].at} ms, first voice at ${audio[0].at} ms, saved at ${events.find((event) => event.type === "done").at} ms.`);
    } else bundle = await request("/api/turn", input);
    reactions.push(bundle.reaction);
    const count = bundle.turns.length;
    const retried = await request("/api/turn", input);
    assert.equal(retried.turns.length, count, "Request retry must not duplicate a turn");
    assert.ok(bundle.turns.some((turn) => turn.text === text));
  }
  assert.equal(bundle.turns.length, 5);
  console.log("PASS checkpoint 3: real conversation, saved transcript, idempotent sends.");
  // Each fresh counterpart reply carries a mood for the character; the tag itself never reaches the saved text.
  const assistantTurns = bundle.turns.filter((turn) => turn.role === "assistant");
  assert.ok(reactions.every((reaction) => reaction && moods.includes(reaction.emotion) && assistantTurns.some((turn) => turn.id === reaction.turnId)), "Every new reply needs a reaction");
  assert.ok(assistantTurns.every((turn) => !/\[[a-z]+\]/i.test(turn.text)), "A mood tag leaked into a saved reply");
  console.log(`PASS mood: tags stripped from saved replies; reactions ${reactions.map((reaction) => reaction.emotion).join(", ")}.`);
  if (fixture.offRole) {
    const offRole = bundle.turns.filter((turn) => turn.role === "assistant" && fixture.offRole.test(turn.text));
    assert.equal(offRole.length, 0, `The counterpart stepped out of role in ${offRole.length} turn(s); run with --print to read them`);
    console.log("PASS role: the counterpart never used workplace or manager language.");
  }

  const coaching = await streamRequest("/api/feedback", { sessionId: id, attempt: 0 });
  bundle = coaching.bundle;
  const steps = coaching.events.filter((event) => event.type === "step").map((event) => event.step);
  const expected = ["reading", "scoring", "changes", "moment", "checking", "saving"];
  assert.deepEqual(steps.filter((step) => step !== "retrying" && expected.includes(step)).filter((step, index, all) => all.indexOf(step) === index), expected, `Coaching steps out of order: ${steps.join(", ")}`);
  console.log(`PASS coaching steps, as reached: ${coaching.events.filter((event) => event.type === "step").map((event) => `${event.step} ${event.at} ms`).join(" → ")}.`);
  const first = bundle.feedback.find((entry) => entry.attempt === 0);
  const originals = bundle.turns.filter((turn) => turn.role === "user" && turn.attempt === 0).map((turn) => turn.text);
  verifyScores(first.scores, originals);
  assert.equal(first.improvements.length, 3);
  for (const improvement of first.improvements) assert.ok(originals.some((text) => text.includes(improvement.quote)));
  verifyScores(first.focus.baselineScores, [first.focus.answer]);
  assert.ok(bundle.turns.some((turn) => turn.id === first.focus.objectionTurnId && turn.text === first.focus.objection));
  console.log("PASS checkpoint 4: persisted structured feedback, three grounded improvements, exact quotes.");

  const retryText = fixture.retry;
  await request("/api/turn", { action: "reply", sessionId: id, requestId: randomUUID(), attempt: 1, text: retryText, audioDurationMs: null });
  bundle = await request("/api/feedback", { sessionId: id, attempt: 1 });
  const retry = bundle.feedback.find((entry) => entry.attempt === 1);
  verifyScores(retry.scores, [retryText]);
  assert.equal(bundle.turns.find((turn) => turn.attempt === 1 && turn.role === "assistant").text, first.focus.objection);
  assert.equal(bundle.session.status, "complete");
  const refreshed = await request(`/api/sessions/${id}`);
  assert.deepEqual(refreshed.feedback, bundle.feedback);
  // Saved moods need migration 003. Without it the column is simply absent and replies reload as neutral.
  const savedMoods = refreshed.turns.filter((turn) => turn.role === "assistant" && turn.attempt === 0).map((turn) => turn.emotion);
  if (savedMoods.every((mood) => mood === undefined)) console.log("NOTE moods: not saved (migration 003 isn't applied); reloads show neutral.");
  else {
    assert.deepEqual(savedMoods, reactions.map((reaction) => reaction.emotion), "Saved moods must match the moods sent with each reply");
    console.log("PASS moods saved: a reloaded conversation keeps each reply's expression.");
  }
  console.log("PASS checkpoint 5: same-objection retry, same rubric, comparison persists after reload.");

  const { progress } = await request("/api/progress");
  assert.equal(progress.completed, 1);
  assert.deepEqual(progress.today, { used: true, sessionId: id, scenarioId, status: "complete" });
  assert.equal(progress.streak.current, 1);
  // With one completed session, each skill is exactly that session's first-attempt score.
  for (const skill of progress.skills) assert.equal(skill.score, first.scores[skill.id].score);
  assert.notEqual(progress.next.scenarioId, scenarioId);
  console.log("PASS checkpoint 6: progress is derived from the saved session and matches its first-attempt scores.");

  const limited = await request("/api/turn", { ...start, requestId: randomUUID() }, 429);
  assert.equal(limited.error.code, "DAILY_LIMIT");
  assert.equal(first.delivery_stats.wordsPerMinute, null);
  assert.equal(retry.delivery_stats.wordsPerMinute, null);
  console.log("PASS checkpoint 7: daily limit enforced; text-only answers have no fabricated speaking pace.");

  const { account } = await request("/api/account");
  assert.deepEqual(account, { email: null, pendingEmail: null, anonymous: true });
  const calendar = await fetch(`${origin}/api/calendar?scenario=${progress.next.scenarioId}&focus=next_step&start=20261116T0930`);
  const ics = await calendar.text();
  assert.match(calendar.headers.get("content-type") ?? "", /text\/calendar/);
  assert.match(ics, /BEGIN:VEVENT[\s\S]*DTSTART:20261116T093000\r\n[\s\S]*END:VCALENDAR/);
  assert.equal((await fetch(`${origin}/api/calendar?scenario=nope&start=20261116T0930`)).status, 400);
  const timing = await fetch(`${origin}/api/timing`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; ") }, body: JSON.stringify({ stage: "client_coaching_total", durationMs: 1234 }) });
  assert.equal(timing.status, 204);
  assert.equal((await fetch(`${origin}/speed`)).status, 200);
  console.log("PASS account, calendar, timing and speed: anonymous account reported; a valid calendar file; timings accepted; /speed renders.");

  await request("/api/waitlist", { email: `askready-check-${randomUUID()}@example.com` });
  console.log("PASS checkpoint 8: real waitlist save with a fictional example.com test address.");

  const other = new Map();
  await request("/api/auth", {}, 200, other);
  await request(`/api/sessions/${id}`, undefined, 404, other);
  assert.equal((await request("/api/progress", undefined, 200, other)).progress.completed, 0);
  console.log("PASS isolation: a second anonymous account cannot read this session.");
  if (process.argv.includes("--print")) {
    // Fictional fixture data only, for reading the counterpart's role and the rewrites by eye.
    for (const turn of refreshed.turns) console.log(`[${turn.attempt}:${turn.sequence}] ${turn.role}: ${turn.text}`);
    for (const improvement of first.improvements) console.log(`REWRITE: ${improvement.rewrite}`);
  }
  console.log(`PASS live flow (${scenarioId}) at ${origin}; results stored at /results/${id}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Live acceptance failed");
  process.exitCode = 1;
}
