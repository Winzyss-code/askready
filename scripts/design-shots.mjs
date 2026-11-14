// Design review captures. Drives the running dev server with mocked /api responses so every
// screen and state can be inspected without live Supabase or OpenAI calls. Nothing here runs in production.
//   node scripts/design-shots.mjs [name-filter] [--base http://localhost:3000] [--motion]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const base = args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:3000";
const reduceMotion = !args.includes("--motion");
const filter = args.find((value, index) => !value.startsWith("--") && args[index - 1] !== "--base");
const out = join(process.cwd(), "test-results", "design");
mkdirSync(out, { recursive: true });

const SESSION = "6f1c2c1e-3b1d-4a53-9a55-0d8f6d1f2a10";
const now = "2026-11-14T09:30:00.000Z";
const turn = (n, role, text, attempt = 0, ms = null) => ({ id: `00000000-0000-4000-8000-00000000000${n}`, session_id: SESSION, role, text, audio_duration_ms: ms, attempt, sequence: n, created_at: now });
const session = (status) => ({ id: SESSION, user_id: "u1", scenario_id: "raise", persona_id: "budget", created_at: now, status, setup: { role: "Operations analyst", desiredRaise: "A 10% raise, from $82,000 to $90,200", achievements: ["Cut weekly reporting from 5 hours to 3 with a new template", "Trained two new analysts who now run the Monday report"], objection: "The budget is frozen until next quarter" } });
const opening = turn(1, "assistant", "Thanks for setting this up. You said you wanted to talk about compensation. What did you have in mind?");
const answer1 = turn(2, "user", "I'd like to ask for a 10% raise. Over the last year I cut our weekly reporting time from five hours to three, and I trained two new analysts.", 0, 11200);
const objection = turn(3, "assistant", "I appreciate that, and the reporting work was noticed. But the budget is frozen until next quarter. I can't move numbers right now.");
const answer2 = turn(4, "user", "I understand the budget is frozen. I have been working hard, and I just think maybe we could revisit this next quarter?", 0, 8400);
const closing = turn(5, "assistant", "We can look at it again next quarter. No promises, though.");
const retryAnswer = turn(6, "user", "I understand the budget is frozen until next quarter. I'm asking for 10% based on cutting reporting from five hours to three and training two analysts. Can we agree on the criteria now and set a decision meeting for the first week of next quarter?", 1);
const score = (value, quote, reason) => ({ score: value, quote, reason });
const baseline = {
  clear_request: score(50, "maybe we could revisit this next quarter?", "The request turns into a question about timing and drops the 10% figure."),
  evidence: score(25, "I have been working hard", "Effort is mentioned, but neither achievement is repeated when it matters."),
  structure: score(50, "I understand the budget is frozen.", "Opens well by acknowledging the concern, then trails off."),
  objection_handling: score(40, "I understand the budget is frozen.", "Names the concern but offers no way around it."),
  next_step: score(35, "revisit this next quarter", "A rough timeframe with no date, owner, or criteria."),
};
const improved = {
  clear_request: score(85, "I'm asking for 10%", "States the number plainly, with no softening."),
  evidence: score(80, "cutting reporting from five hours to three and training two analysts", "Both achievements are specific and tied to the request."),
  structure: score(75, "Can we agree on the criteria now", "Concern, request, evidence, next step, in that order."),
  objection_handling: score(70, "I understand the budget is frozen until next quarter.", "Accepts the constraint and works within it."),
  next_step: score(90, "set a decision meeting for the first week of next quarter", "Asks for a dated decision meeting and criteria."),
};
const sessionScores = {
  clear_request: score(70, "I'd like to ask for a 10% raise.", "Clear in the opening, softer after the pushback."),
  evidence: score(60, "cut our weekly reporting time from five hours to three", "Strong first answer; the evidence disappears later."),
  structure: score(55, "I have been working hard, and I just think maybe", "The second answer loses its shape."),
  objection_handling: score(40, "I understand the budget is frozen.", "Acknowledges the freeze without proposing a path."),
  next_step: score(35, "revisit this next quarter", "No date or decision owner."),
};
const improvements = [
  { quote: "I have been working hard", rewrite: "I cut weekly reporting from five hours to three and trained two analysts who now run the Monday report.", why: "Effort is easy to wave away. A result your manager already noticed is not." },
  { quote: "I just think maybe we could revisit this next quarter?", rewrite: "Can we agree on the criteria now and set a decision meeting for the first week of next quarter?", why: "A dated meeting with agreed criteria turns a deferral into a commitment." },
  { quote: "I understand the budget is frozen.", rewrite: "I understand the budget is frozen until next quarter, so I'm not asking you to move numbers today.", why: "Showing you heard the constraint makes the next ask easier to say yes to." },
];
const delivery = (wpm) => ({ wordCount: 52, recordedWordCount: 52, audioDurationMs: 19600, wordsPerMinute: wpm, fillers: { um: 2, like: 1, "you know": 0 }, hedges: { "I think": 1, maybe: 1, just: 1, "kind of": 0 } });
const focus = { objectionTurnId: objection.id, answerTurnId: answer2.id, objection: objection.text, answer: answer2.text, baselineScores: baseline };
const fb0 = { id: "f0", session_id: SESSION, attempt: 0, scores: sessionScores, improvements, delivery_stats: delivery(142), focus, created_at: now };
const fb1 = { id: "f1", session_id: SESSION, attempt: 1, scores: improved, improvements: improvements.slice(0, 2).concat({ quote: "I'm asking for 10%", rewrite: "I'm asking for a 10% raise, to $90,200.", why: "Saying the figure once, in full, leaves nothing to interpret." }), delivery_stats: { ...delivery(null), wordCount: 44, recordedWordCount: 0, fillers: { um: 0, like: 0, "you know": 0 }, hedges: { "I think": 0, maybe: 0, just: 0, "kind of": 0 } }, focus: null, created_at: now };

const bundles = {
  opening: { session: session("practice"), turns: [opening], feedback: [] },
  mid: { session: session("practice"), turns: [opening, answer1, objection], feedback: [] },
  late: { session: session("practice"), turns: [opening, answer1, objection, answer2, closing], feedback: [] },
  feedback: { session: session("feedback"), turns: [opening, answer1, objection, answer2, closing], feedback: [fb0] },
  complete: { session: session("complete"), turns: [opening, answer1, objection, answer2, closing, retryAnswer], feedback: [fb0, fb1] },
};

function wav(seconds) {
  const rate = 8000, samples = Math.floor(rate * seconds), buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(36 + samples * 2, 4); buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36); buffer.writeUInt32LE(samples * 2, 40);
  return buffer;
}
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function mock(page, { bundle = "mid", speakSeconds = 0.15, turnDelay = 0, transcribeDelay = 0, sessionsDelay = 0, recent = [], fail = false } = {}) {
  await page.route("**/api/auth", (route) => route.fulfill(json({ ok: true })));
  await page.route("**/api/sessions?*", async (route) => { await wait(sessionsDelay); await route.fulfill(fail ? json({ error: { message: "We couldn’t reach your saved practice. Check your connection and try again." } }, 503) : json({ sessions: recent })); });
  await page.route("**/api/sessions/*", async (route) => { await wait(sessionsDelay); await route.fulfill(fail ? json({ error: { message: "We couldn’t reach your saved practice. Check your connection and try again." } }, 503) : json(bundles[bundle])); });
  await page.route("**/api/turn", async (route) => { await wait(turnDelay); await route.fulfill(json(route.request().postDataJSON().action === "start" ? bundles.opening : bundles.late)); });
  await page.route("**/api/feedback", async (route) => { await wait(turnDelay); await route.fulfill(json(bundles.feedback)); });
  await page.route("**/api/speak", (route) => route.fulfill({ status: 200, contentType: "audio/wav", body: wav(speakSeconds) }));
  await page.route("**/api/transcribe", async (route) => { await wait(transcribeDelay); await route.fulfill(json({ text: answer2.text, audioDurationMs: 8400 })); });
  await page.route("**/api/waitlist", (route) => route.fulfill(json({ joined: true })));
}

const practiceUrl = `/practice/raise?session=${SESSION}`;
const idle = async (page) => { await page.getByRole("button", { name: "Record an answer" }).waitFor(); await page.getByRole("button", { name: "Hear the manager" }).waitFor(); await wait(400); };

const shots = [
  { name: "landing", url: "/", fullPage: true },
  { name: "pricing", url: "/pricing", fullPage: true },
  { name: "pricing-joined", url: "/pricing", fullPage: true, run: async (page) => { await page.getByLabel(/email/i).fill("dana@example.com"); await page.getByRole("button", { name: "Join Pro waitlist" }).click(); await page.getByText("You’re on the Pro waitlist.").waitFor(); } },
  { name: "setup", url: "/practice/raise", fullPage: true, run: async (page) => { await page.getByLabel("Your job role").waitFor(); } },
  { name: "setup-recent-errors", url: "/practice/raise", fullPage: true, mock: { recent: [session("feedback")] }, run: async (page) => { await page.getByLabel("Your job role").fill("O"); await page.getByLabel("Achievement 1").fill("abc"); await page.getByLabel("Achievement 2").focus(); await page.getByLabel("What might your manager say?").fill("The budget is frozen until next quarter"); await page.getByLabel("Your job role").focus(); } },
  { name: "setup-loading", url: "/practice/raise", mock: { sessionsDelay: 4000 }, run: async () => { await wait(900); } },
  { name: "practice-error", url: practiceUrl, mock: { fail: true }, run: async (page) => { await page.getByRole("button", { name: "Try connecting again" }).waitFor(); } },
  { name: "practice-idle", url: practiceUrl, run: idle },
  { name: "practice-speaking", url: practiceUrl, mock: { speakSeconds: 9 }, run: async (page) => { await page.getByRole("button", { name: "Stop playback" }).waitFor(); await wait(900); } },
  { name: "practice-listening", url: practiceUrl, run: async (page) => { await idle(page); await page.getByRole("button", { name: "Record an answer" }).click(); await page.getByRole("button", { name: /Stop recording/ }).waitFor(); await wait(2300); } },
  { name: "practice-processing", url: practiceUrl, mock: { transcribeDelay: 6000 }, run: async (page) => { await idle(page); await page.getByRole("button", { name: "Record an answer" }).click(); await page.getByRole("button", { name: /Stop recording/ }).waitFor(); await wait(1500); await page.getByRole("button", { name: /Stop recording/ }).click(); await wait(900); } },
  { name: "practice-review", url: practiceUrl, run: async (page) => { await idle(page); await page.getByRole("button", { name: "Record an answer" }).click(); await page.getByRole("button", { name: /Stop recording/ }).waitFor(); await wait(1500); await page.getByRole("button", { name: /Stop recording/ }).click(); await page.getByText("Review the transcript", { exact: false }).waitFor(); await wait(300); } },
  { name: "practice-thinking", url: practiceUrl, mock: { turnDelay: 6000 }, run: async (page) => { await idle(page); await page.getByRole("textbox", { name: "Your answer", exact: true }).fill(answer2.text); await page.getByRole("button", { name: "Send answer", exact: true }).click(); await wait(1200); } },
  { name: "practice-mic-denied", url: practiceUrl, run: async (page) => { await idle(page); await page.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Test denial", "NotAllowedError"); }; }); await page.getByRole("button", { name: "Record an answer" }).click(); await page.getByText("Microphone access was denied.", { exact: false }).waitFor(); await wait(300); } },
  { name: "practice-late", url: practiceUrl, fullPage: true, mock: { bundle: "late" }, run: idle },
  { name: "feedback", url: `/results/${SESSION}`, fullPage: true, mock: { bundle: "feedback" }, run: async (page) => { await page.getByRole("heading", { name: "Three changes to try" }).waitFor(); await wait(600); } },
  { name: "results-loading", url: `/results/${SESSION}`, mock: { bundle: "feedback", sessionsDelay: 4000 }, run: async () => { await wait(900); } },
  { name: "retry", url: `${practiceUrl}&retry=1`, mock: { bundle: "feedback" }, run: async (page) => { await page.getByRole("heading", { name: "Try that moment again." }).waitFor(); await idle(page); } },
  { name: "comparison", url: `/results/${SESSION}`, fullPage: true, mock: { bundle: "complete" }, run: async (page) => { await page.getByRole("heading", { name: "One objection. Two answers." }).waitFor(); await wait(1600); } },
  { name: "not-found", url: "/nope" },
];

const browser = await chromium.launch({ channel: "chrome", args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
const failures = [];
for (const viewport of [{ label: "mobile", width: 390, height: 844, deviceScaleFactor: 2 }, { label: "desktop", width: 1280, height: 800, deviceScaleFactor: 1 }]) {
  for (const shot of shots) {
    if (filter && !shot.name.includes(filter)) continue;
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.deviceScaleFactor, reducedMotion: reduceMotion ? "reduce" : "no-preference", permissions: ["microphone"] });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text().split("\n")[0].slice(0, 200)}`); });
    try {
      await mock(page, shot.mock);
      await page.goto(base + shot.url, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      if (shot.run) await shot.run(page);
      if (shot.fullPage) {
        await page.evaluate(async () => {
          for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 2) { scrollTo(0, y); await new Promise((done) => setTimeout(done, 60)); }
          scrollTo(0, 0);
        });
        await wait(400);
      }
      await page.screenshot({ path: join(out, `${shot.name}-${viewport.label}.png`), fullPage: Boolean(shot.fullPage) });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (overflow > 0) failures.push(`${shot.name}-${viewport.label}: horizontal overflow ${overflow}px`);
      if (errors.length) failures.push(`${shot.name}-${viewport.label}: ${errors.join(" | ")}`);
      console.log(`ok ${shot.name}-${viewport.label}`);
    } catch (error) {
      failures.push(`${shot.name}-${viewport.label}: ${error.message.split("\n")[0]}`);
      await page.screenshot({ path: join(out, `${shot.name}-${viewport.label}-FAILED.png`) }).catch(() => {});
    }
    await context.close();
  }
}
await browser.close();
if (failures.length) { console.log("\nISSUES\n" + failures.join("\n")); process.exitCode = 1; }
