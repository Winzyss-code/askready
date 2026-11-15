# AskReady

A daily practice for the hard conversations at work: asking for more, saying no, giving honest feedback. Each session teaches one technique, rehearses it out loud against an AI manager or teammate who pushes back, gives three specific improvements on your own words, then has you retry the hardest answered objection and compare both answers using the same rubric. Skill levels and days in a row are worked out from your saved sessions.

Four conversations are live: ask for a raise (the flagship), say no to extra work, give difficult feedback, and set a boundary with a friend or family member. Three more are listed as coming soon and cannot be started.

**Live app:** https://askready-orcin.vercel.app (see [Verification](#verification) for which build has been checked there)

**Stack:** Next.js App Router, TypeScript, Tailwind CSS, Supabase anonymous Auth + Postgres, OpenAI Whisper, OpenAI chat completions, and OpenAI TTS. Deploy to Vercel. There are no simulated AI responses or fake purchases in the product.

## Run locally

Requires Node.js 22+ and npm.

```sh
npm ci
cp .env.example .env.local
# Fill in .env.local using the table below.
npm run dev
```

Open http://localhost:3000. A missing configuration produces a recoverable error rather than fabricated success. Restart the dev server after changing environment variables.

| Variable | Required value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project base URL, e.g. `https://your-project.supabase.co` — **omit `/rest/v1/`** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key (`sb_publishable_…`) or legacy public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server secret key (`sb_secret_…`) or legacy service-role key; never expose to the browser |
| `OPENAI_API_KEY` | Server-side OpenAI key for transcription, speech, and the default LLM connection |
| `LLM_PROVIDER_API_KEY` | Optional separate OpenAI key for chat; falls back to `OPENAI_API_KEY` |
| `LLM_MODEL_FAST` | Roleplay model; suggested starting value: `gpt-4.1-mini` |
| `LLM_MODEL_STRONG` | Structured coaching model; suggested starting value: `gpt-4.1` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Optional. Cloudflare Turnstile site key; turns on the CAPTCHA for new anonymous accounts and sign-in links (see [Protection](#protection)) |
| `NEW_SESSIONS_PER_IP_PER_DAY` | Optional. New sessions per network per UTC day across all accounts; default 30 |

The models must be available to your OpenAI project. `.env.local` is ignored by Git. Never put the server secret or OpenAI key in a `NEXT_PUBLIC_` variable.

## Supabase setup

1. Create a Supabase project and copy its base URL and publishable/public key.
2. Enable **anonymous sign-ins** under Authentication → Sign In / Providers (dashboard labels may vary).
3. Apply the correct SQL in the Supabase SQL Editor:
   - **New, empty project:** run `supabase/schema.sql` once. It includes the full schema and practice RPCs.
   - **Existing checkpoint-1 installation:** run `supabase/migrations/002_practice.sql` once. Do not rerun the initial schema.
   - **Existing installation with 002:** run `supabase/migrations/003_resilience.sql` once. It adds saved moods, the shared rate limit and the speed timings. The app runs without it (moods reload as neutral, rate limits are per instance, `/speed` says it isn't recording), so it can be applied whenever is convenient. It is safe to rerun.
4. Add the server secret/service-role key to `.env.local` and restart the app.
   For “Save your progress”: under Authentication → URL Configuration, set the Site URL and add `https://<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback`) to the redirect URLs. Keep the Email provider enabled. Supabase’s built-in email only delivers to the project team and a few messages an hour, so set up custom SMTP before real users rely on it.
5. Open the landing page to create an anonymous account, then start practice.

These are versioned, one-time migrations, not reset scripts. The application does not apply SQL automatically. Anonymous Supabase accounts use the `authenticated` Postgres role. The Data API must remain enabled.

## Product flow

A first visit can skip the form: **Or try a ready-made example** on the landing page (or **Use an example case** on any setup page) fills in a made-up case that is labelled as one and can be edited, and **Start with this example** begins straight away. Each live scenario has its own example in `config/scenarios.ts`.

0. **Pick a conversation:** the landing page lists two tracks and seven scenarios from `config/scenarios.ts`. Only scenarios marked `live` link to practice.
1. **Learn and set up:** the scenario's technique (three steps and a weak line beside a stronger one, static copy we wrote), then a short form: role, the ask, two supporting facts, the likely pushback, and the counterpart's temperament. Labels come from the scenario's config.
2. **Practice:** two to six answers, using voice or text. The counterpart (a manager, a teammate or a friend or relative, depending on the scenario) responds to the actual case in one to three short sentences. The technique stays available as a reminder. There is no live coaching or score meter.
3. **Feedback:** while the coach works, the screen lists its steps (reading your answers, scoring five skills, writing three changes, picking the moment to retry, checking quotes, saving), each shown only once the server has reached it. Then five coaching estimates, each grounded in an exact quote, plus three “You said / Say this instead / Why” improvements. The retry card says why that moment was picked (that answer’s average and weakest skill) and links to it, highlighted, in the transcript.
4. **Retry:** answer the same hardest **answered** objection again. Opening greetings and unanswered final questions cannot become the retry. A “Try: …” line by the recorder keeps the coach’s rewrite of that answer in view (or, for older coaching, the exercise for its weakest skill).
5. **Compare:** the selected original answer and retry are evaluated against the same objection, five dimensions, and scoring anchors. The page opens with one headline naming the biggest gain (“Your answer to “Why now?” went from 25 to 75 on Evidence.”), or saying plainly that the retry scored the same or lower. Improvement is not guaranteed.
6. **Tomorrow:** the weakest rubric dimension determines a specific next exercise, and the results page shows days in a row, the suggested next conversation and **Add tomorrow to your calendar**: a calendar file (`/api/calendar`, stateless, nothing stored) for tomorrow at about this time, in the visitor’s own time zone. There is no email reminder: that needs an email provider and a scheduler, which this build doesn’t have.
7. **Progress:** `/progress` shows days in a row, a level from 1 to 4 for each of the five skills, and sessions per conversation. A new account sees an empty state with no numbers.
8. **Save your progress (optional):** on `/progress` and the results page, an anonymous account can add an email. Supabase sends a link; opening it makes the same account permanent, so nothing moves. On another browser, **Sign in instead** sends a link to a saved account (the answer is the same whether or not the address has one). Links land on `/auth/callback`, which hands the session to the server so tokens stay in HTTP-only cookies. A saved account can sign out of a browser; an anonymous one can’t, because its progress would be lost.

Progress is derived on every request from the `sessions` and `feedback` rows the account already owns (`lib/progress.ts`); there is no progress table and nothing is seeded. Skill levels average the first, uncoached attempt of the last three coached sessions, so they are coaching estimates and move with a small sample. Days are UTC days, counted from when a session was created, and cover the 100 most recent sessions.

Free includes one new session per UTC day and its retry, in any live conversation. Existing practice can be resumed. Once the day's session is used, the setup page of every conversation shows a card in place of the form, with a link back to that session, tomorrow's suggested conversation and the Pro waitlist; the lesson stays readable. That card is a convenience: the server and the database still enforce the limit. The limit and the planned price live in `config/plans.ts`; the limit must match `create_practice` in `supabase/schema.sql`. Pro is a **waitlist only**, with a planned price of **$12.99/month**. The form saves an email and never charges, starts a subscription, or activates an entitlement.

## Architecture and data

```text
app/
  page.tsx                        Landing: tracks, scenarios, example comparison
  practice/[scenarioId]/page.tsx Lesson, setup, conversation and retry
  results/[sessionId]/page.tsx   Saved feedback, comparison and technique recap
  progress/page.tsx              Days in a row, skill levels, next conversation
  pricing/page.tsx               Free plan and honest Pro waitlist
  api/                          Validated route handlers
components/                     Small task-focused UI components
hooks/use-speech.ts              Audio playback and fallback lifecycle
config/
  tracks.ts                     The two tracks scenarios are grouped under
  scenarios.ts                  Seven scenarios (four live): copy, form labels, lesson, prompts
  personas.ts                   Counterpart temperaments, and which ones each scenario offers
  plans.ts                      Free daily limit and planned Pro price
  rubric.ts                     Shared dimensions, anchors and exercises
lib/
  llm.ts                        Single chat-completion wrapper and structured feedback
  stt.ts / tts.ts                Server-only OpenAI speech clients
  scoring.ts                    Grounding, conservative rewrites and delivery math
  progress.ts                   Days in a row, skill levels and next conversation from saved sessions
  sessions.ts / supabase.ts      Verified auth, scoped reads and transactional writes
  api.ts / validation.ts        Bounded input, Zod validation and safe JSON errors
  client.ts / rate-limit.ts      Browser request helper and basic throttling
types/domain.ts                 Shared session/turn/feedback contracts
supabase/schema.sql             Full fresh-install schema
supabase/migrations/            Upgrade scripts
supabase/tests/                 Ownership and transaction regression checks
scripts/                       Foundation, scoring, progress and LLM contract tests; live flow; screenshots
```

Adding or enabling a scenario means editing `config/scenarios.ts` only. The stored setup keeps its original keys (`role`, `desiredRaise`, `achievements`, `objection`) for every scenario; models are shown scenario-neutral names instead.

Tables are `sessions`, `turns`, `feedback`, and `waitlist`, plus, from migration 003, `turns.emotion` (each reply’s mood), `rate_limits` (hashed keys only) and `stage_timings` (a stage name and a duration only). The two new tables are server-only: RLS is on with no policies, and only `service_role` is granted access. Additions to the requested minimal schema support correctness: session status and request IDs, deterministic turn sequence and attempt, feedback focus containing the original objection/answer/baseline, and waitlist ownership. Feedback is unique per session and attempt.

**Authentication:** same-origin route handlers create and verify anonymous accounts using Supabase Auth. Access and refresh tokens stay in HTTP-only, SameSite=Lax cookies, marked Secure in production. Tokens are not returned in JSON or stored in localStorage. Closing a tab preserves access; clearing cookies or changing browsers loses it unless the progress was saved to an email (above).

**Authorization:** reads carry the verified user's JWT, so RLS enforces own-row access. Direct client writes are denied. Server writes use the service key only after identity verification. Practice RPCs receive the verified user ID and enforce ownership, state, ordering, idempotency, and quota in the database. RPC execution is restricted to `service_role`.

**Quota/concurrency:** an advisory transaction lock makes the one-session-per-UTC-day creation limit atomic. Request IDs prevent duplicate saved turns and sessions after retries. Database state/count checks reject concurrent stale writes; an in-process lock also reduces duplicate AI requests on one instance. Anonymous quotas are per identity, not per human; see [Protection](#protection) for what limits a new browser identity. Cross-instance duplicate AI generation can still consume provider tokens before the database resolves the race.

### Protection

- **Shared rate limit.** Every limit is checked in memory and, with migration 003, in the database (`rate_limit_hit`), so it holds across instances and deploys. Keys are SHA-256 hashed before they are sent, so no IP address or user id is stored. If the function is missing or storage is down, the shared check fails open and the in-memory one still applies.
- **New sessions per network.** On top of one free session per account per day, one network can start `NEW_SESSIONS_PER_IP_PER_DAY` (default 30) a day across all accounts. It is generous because a venue or office shares one address; it stops clearing cookies over and over, not a determined abuser with many networks.
- **CAPTCHA (optional).** With `NEXT_PUBLIC_TURNSTILE_SITE_KEY` set, a brand-new anonymous account and a sign-in link need a Cloudflare Turnstile token, which Supabase checks. Returning visitors never see it. **Turn it on in Supabase first** (Authentication → Bot and Abuse Protection, Turnstile, with the secret key), then set the site key; the other order blocks sign-up. Usually it finishes without asking anything.
- **Spending cap.** Not something code can do: set a monthly budget and alerts in the OpenAI dashboard (Settings → Limits). This is the backstop if everything else is bypassed.

## API routes

All write routes require same-origin requests. Inputs are validated with Zod; errors have `{ "error": { "code", "message" } }`.

| Route | Purpose |
| --- | --- |
| `POST /api/auth` | Create/resume anonymous account and check storage access |
| `GET /api/health` | Configuration readiness; not a live provider or RLS test |
| `GET /api/sessions?scenarioId=raise` | List recent owned sessions for resuming |
| `GET /api/sessions/[id]` | Load owned session, turns and feedback |
| `GET /api/progress` | Days in a row, skill levels, per-conversation counts and the suggested next conversation, computed from owned sessions |
| `POST /api/turn` | Start a session, append a roleplay exchange, or save a retry |
| `POST /api/feedback` | Generate and persist original or retry feedback |
| `POST /api/transcribe` | Bounded multipart audio → transcript and duration |
| `POST /api/speak` | Owned stored manager turn → synthesized audio |
| `POST /api/waitlist` | Save/update the current user's Pro-interest email |
| `GET /api/account` | Whether this account is saved to an email |
| `POST /api/account/link` | Email a link that saves this anonymous account |
| `POST /api/account/sign-in` | Email a sign-in link to a saved account |
| `POST /api/account/session` | From `/auth/callback`: take over the session an email link carried |
| `POST /api/account/sign-out` | Sign a saved account out of this browser |
| `GET /api/calendar` | A calendar file for tomorrow’s session (stateless) |
| `POST /api/timing` | A timing measured in the browser, for `/speed` |

`POST /api/turn` and `POST /api/feedback` also stream when the request has `Accept: application/x-ndjson`: one JSON object per line, ending in `{ "type": "done", "bundle" }` or `{ "type": "error", "error" }`. Checks that fail before any work starts still answer with a plain JSON error, and a repeated request answers with plain JSON. Without that header both routes behave as before.

## Feedback integrity

The dimensions are clear request, evidence, structure, objection handling, and next step. Scores range from 0 to 100. Each skill has its own anchors in `config/rubric.ts`, and they are deliberately strict: 100 needs every part of its line (for evidence, two concrete facts with a number or date; for next step, a decision or commitment tied to a specific day). The coach writes its reason before its score, naming the anchor met, and scoring runs at temperature 0 with a fixed seed. They are labeled **coaching estimates**; there is no confidence score or psychological inference.

**Calibration.** `scripts/calibration-set.json` holds 20 fixed answers across the four live scenarios, from caving to complete, each with the range we expect per skill, written before running the coach. `node scripts/calibration.mjs --runs=2` (live, billable, about 40 coach calls) scores each answer twice and reports how many scores land in range and how far repeated scores move. Measured on November 15, 2026 with `gpt-4.1`:

| Anchors | Scores in range | Notes |
| --- | --- | --- |
| Before (one shared line) | 83 of 100 (1 run) | Mid answers got 75–100 on structure and objection handling |
| After | 188 of 200 (94%, 2 runs) | Decent first answers now score 50–75, complete ones 100 |

Repeated scoring is not fully deterministic: in the final run most skill scores were identical across the two runs, but a few moved by 25 and one by 50. Two expected ranges were widened during tuning, each with its reason written beside it, where the anchor text itself allowed the higher score. The misses that remain are mostly clear request scored one step generously (“decide on my compensation” as specific). So: consistent enough to show a real before-and-after, not a measurement instrument.

The strong model returns strict structured JSON, validated with Zod. Invalid structure or ungrounded evidence triggers **one retry**, then a recoverable error. The prompt asks for one unbroken sentence per quote, because the model otherwise tends to stitch excerpts together with an ellipsis, which validation rejects. Network, provider authorization and quota errors surface without pretending feedback exists. Every evidence quote must be an exact contiguous substring of the relevant user answer(s).

Rewrites are deliberately conservative. The model chooses a dimension and a supporting user statement; code composes the suggested answer from fixed phrasing and the user's supplied request/complete verbatim achievement or answer. Each live scenario has its own phrasing (`rewrites` in `config/scenarios.ts`): a boundary rewrite offers an alternative (“Here’s what I can do instead: [one thing you can offer, and when]. Would that work for you?”) instead of asking for a decision. Missing evidence becomes a scenario-specific prompt such as `[add what happened, and when]`. A quote may differ from the user’s words only in quote-mark style or the case of its first letter, and is then replaced by the exact span the user wrote. This avoids accepting freely invented facts or stripping a negation from an excerpt. It does not verify whether the user's own statements are true. The model's explanation and numeric judgment remain subjective.

The structured schema restricts supporting statements to an enum of complete user-provided facts (or an empty value for the placeholder). This constraint prevents the provider from shortening or paraphrasing a fact before validation. Validation failures log only their category and schema path, never the transcript.

Comparison uses `feedback[0].focus.baselineScores` for the single original answer against `feedback[1].scores` for the retry. It does **not** compare a full-session score to a single-answer score.

## Voice and delivery observations

The counterpart is drawn as a small animated character (`components/Character.tsx`) that listens, thinks and speaks. Its mouth follows the loudness of the reply's real audio (`lib/useMouthSync.ts`): each piece of audio is decoded once into a loudness curve, and the mouth reads it at the player's current time. Audio plays through a normal audio element, never through Web Audio, so a suspended audio context (no tap yet, or iOS after an interruption) can't silence it. With browser speech, or before the curve is decoded, the mouth follows a speech-like pattern; with text-only playback it stays still. Its mood comes from a tag the model puts at the start of each reply (`[skeptical] …`), limited to the moods that fit the chosen temperament. The tag is removed before the reply is saved, shown or spoken (`lib/emotion.ts`). With migration 003 each reply's mood is saved, so a reloaded conversation keeps its expressions; without it, reloaded replies are neutral. At setup, each temperament shows the character with one line it might say in that scenario (`lines` in `config/personas.ts`, written by us).

**Streaming replies.** The counterpart's reply streams: the mood as soon as its tag closes, then the words as they're written, then each finished sentence. The server sends each sentence to text-to-speech as soon as it's finished, while the model writes the next, and streams the audio in sentence order. A reply is kept to three sentences and 65 words by cutting at the last whole sentence, not by rejecting it, because by then its first sentence may already be playing; only a first sentence over 65 words is an error. What was spoken is what is saved. If a sentence's speech fails, the browser's voice takes over for the rest; if that fails, the reply stays as text.

**iPhone and Safari.** One audio element is reused for every reply and unlocked by playing a tenth of a second of silence on the first tap, because iOS only lets an element play without a tap once it has played after one. The tap that starts a session doesn't cut that clip off. The recorder's level meter falls back to `webkitAudioContext`. **None of this has been tried on a physical iPhone**; it is built to the known Safari rules and tested in desktop Chrome only.


The interaction is turn-based. The browser chooses a supported MediaRecorder MIME type (including WebM/MP4), records for up to **90 seconds**, and limits uploads to **3.5 MB**. The API also bounds multipart bytes before parsing. Mic denial or an unsupported recorder leaves text entry available. Transcription is server-side Whisper; typed answers use the same practice flow.

**Transcribing while recording.** An answer is recorded in pieces: once a piece is at least 8 seconds long, it closes at the next pause of 0.4 seconds and a new one starts. Each finished piece is transcribed while the user keeps talking, with the words before it as Whisper's prompt so the transcript reads on across the cut, so at the end only the last piece is left to wait for. A piece that never reached speech level is not sent (Whisper tends to invent “Thank you.” for silence). Without a level meter the answer goes as one piece, as before. A short answer is one piece, so this only saves time on answers longer than about 8 seconds.

Manager speech is **AI-generated**, disclosed in the interface. OpenAI TTS falls back to browser `speechSynthesis`, then text-only. Playback can require a user gesture on mobile browsers; the UI permits replay. Sessions persist transcripts and results, not raw audio files. Audio and text are still sent to OpenAI for processing and are subject to that provider's data policies. Browser fallback speech may use the browser/OS speech provider.

Delivery observations are calculated separately from scores: phrase-boundary filler/hedge counts and approximate words per minute using recorded user words divided by recorded duration. Text-only answers have no speaking pace. These are transcript observations: Whisper may remove fillers, “like” and “just” may be legitimate words, and pauses/edits affect pace. They do not measure vocal confidence, emotion, or assertiveness.

Logs report stage timing metadata only, never prompts, transcripts, keys or tokens. With migration 003 the same timings (stage and duration, nothing else) are also saved, along with two measured in the browser (answer sent → reply starts playing; asked for coaching → coaching ready), and **`/speed`** shows the median and 90th percentile per stage for the last seven days, with sample counts.

The November 14 production smoke run measured roughly 3.7–4.8 seconds for `/api/turn`, 3.2 seconds for `/api/speak`, 3.6 seconds for `/api/transcribe`, and 8–9.3 seconds for feedback (single-run observations, not percentiles). The full sequential reply-audio path is therefore above the 3–5 second target. Speech fetches only the owned manager turn rather than reloading the entire session. `turn_total`, `transcribe_total`, and `speak_total` logs include route overhead as well as provider timings.

## Verification

Checkpoint 1 verified on November 14, 2026: lint, TypeScript, production build, missing-configuration/error smoke tests, and live Supabase anonymous sign-in, storage access, identity persistence, and refresh-token renewal passed. The full SQL schema and RLS ownership tests also passed in a disposable local PostgreSQL database. This does not establish that the deployed Supabase project's policies match the local migration, nor verify the later AI/voice flow.

```sh
npm run check                     # ESLint, TypeScript, production build
npm run test:foundation           # Build first; compiled route/error smoke tests
npm run test:foundation:live      # Build first; real Supabase Auth + storage check
npm test                         # Scoring, progress, mood-tag and LLM contract regressions
npm run check:services           # Read-only schema and provider access preflight
npm run test:flow:live            # Running app; real AI, DB, retry, progress, quota, waitlist
node scripts/check-secrets.mjs   # Build first; private-key scan of repo/client files
```

Live acceptance commands create anonymous test accounts and use billable provider calls with fictional rehearsal data. `test:flow:live` also stores a clearly synthetic `example.com` waitlist address. Set `ASKREADY_TEST_URL=https://your-app.vercel.app` to run against a deployment; the default is `http://localhost:3000`. Add `-- --voice` to include a real TTS-to-Whisper round trip. The flow defaults to the raise scenario; run `node scripts/check-flow.mjs --scenario=pushback` or `--scenario=feedback` or `--scenario=boundary` for the others (the boundary run also fails if the counterpart uses workplace or manager words), `--persona=<budget|friendly|analyst>` to pick the counterpart, and `--print` to read the conversation and coaching it produced.

For the browser flow, install Google Chrome, start the app, then run:

```sh
node scripts/prepare-voice-fixture.mjs
npm run test:browser
```

Playwright opens an isolated Chrome profile, feeds synthetic speech into the real MediaRecorder/Whisper path, and tests setup, real coaching, retry, reload, desktop/mobile layouts, and explicit microphone/TTS failure states. The TTS outage and mic denial are injected only by tests; production code has no mock provider. Screenshots go to ignored `test-results/`. It covers the raise scenario only. This does not replace a physical-device Safari/iPhone microphone check.

`node scripts/design-shots.mjs [name-filter] --base http://localhost:3000` screenshots every screen and state at 390px and 1440px into ignored `test-results/design/`. It mocks `/api` in the browser so states are repeatable; it is for reviewing layout, and is not evidence that anything works.

The LLM contract tests use isolated fetch fixtures to exercise validation/retry behavior. Test fixtures are not used by the application and are not evidence that a live provider works. Foundation tests deliberately blank Supabase configuration in their own process.

The live foundation check uses `.env.local` and creates one anonymous test account. It verifies sign-in, access to the sessions table, HTTP-only secure cookies, identity persistence, and refresh-token renewal through the compiled app handlers. It does not consume a practice session or call OpenAI. Run the SQL tests separately to verify row isolation. Server-only Supabase configuration is read at runtime so readiness reflects the running deployment's settings.

For SQL regression tests, use a **disposable test database** and administrative test connection:

```sh
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/flow.sql
```

Apply the full schema first. `supabase/tests/bootstrap-postgres.sql` supplies only Auth-compatible roles and `auth.uid()` for an **empty disposable plain PostgreSQL database**; never run it on Supabase or production. It does not emulate Supabase Auth or HTTP behavior.

### Live acceptance checklist

Do not treat a passing build or mocked test as end-to-end production verification:

- [x] Complete setup → text practice → grounded feedback → same-objection retry → comparison using real configured models.
- [x] Repeat with synthetic mic input through Chrome MediaRecorder and real Whisper/TTS; verify denied/unsupported mic, TTS failure and text fallback.
- [x] Reload results; verify the same account and saved comparison persist.
- [x] Verify a separate anonymous account cannot read another account's session.
- [x] Start another new session on the same UTC day; verify the server rejects it while resuming remains possible.
- [x] Save a fictional example.com waitlist entry through the real database API without purchase or entitlement.
- [x] Scan repository files and client bundles for configured private keys; confirm .env.local and .vercel are ignored.
- [x] Repeat the core flow on the deployed HTTPS URL; inspect desktop and 390px mobile layouts in Chrome.
- [ ] Physical microphone/speaker check on Safari/iPhone and Android hardware. On an iPhone, check: the opening reply plays after tapping **Start**, later replies play without another tap, the mouth moves while it speaks, a 20-second recorded answer transcribes, the calendar link opens Calendar, and after a phone call or locking the screen the next reply still plays.

Verified on November 14, 2026 at **https://askready-orcin.vercel.app**: live API flow and isolated Chrome browser acceptance both passed. The browser test completed voice + text → coaching → retry → comparison and reload with no page errors; mobile layouts had no horizontal overflow. The production dependency audit reported zero vulnerabilities; eight moderate advisories remain in development-only lint dependencies. Unit/contract tests: 15 passed. The schema, upgrade, RLS, quota, ordering and retry transaction tests passed in disposable PostgreSQL. Physical-device audio remains the explicit manual check above.

### Skills pivot, November 15, 2026

Checked against a **local production build** (`next build` and `next start`) using the real Supabase project and real OpenAI models. **None of this has been repeated on the deployed URL**, which still serves the build described above until the branch is deployed.

- `npm run check` passed. `npm test`: 21 passed, including five for `lib/progress.ts` (empty account, an unfinished session, days in a row across the UTC boundary, level boundaries and averaging, next-conversation order).
- The live flow passed for all three live scenarios (`raise`, `pushback`, `feedback`), including a new check that `/api/progress` matches the saved first-attempt scores and that a second account sees no progress.
- The browser test passed for the raise scenario.
- The counterpart character was added afterwards. With mocked APIs in Chrome: real audio moves its mouth and silent audio does not, so the analyser is driving it; the analyser is connected to the speakers; a reply shows thinking and then the model's mood; text-only playback stays neutral and still; a denied microphone shows concern. At 390px with a 4x CPU throttle it held 60 fps while speaking, and its box did not move between states. That was a desktop browser, not a real phone. Live: mood tags came back on 18 of 18 sampled replies and fit each temperament after one prompt adjustment; the raise and boundary live flows passed with the new mood checks.
- Later the same day, a fourth live scenario, “Set a boundary with a friend or family member”, was added. Its live flow passed against real models, including a new check that the counterpart never uses workplace or manager words. The first attempts failed: the counterpart sometimes took on the user’s side of the story and ran past the three-sentence limit, until the scenario prompt said whose side the setup is written from. In a 24-turn sample after that fix, about one reply in twelve still slipped partly into the user’s side. After the change, the raise and pushback flows passed again. The browser test failed once at the Whisper transcription step and passed on the rerun.
- The daily-limit card was checked once in a fresh Chrome profile with one real session: no card for a new account; card instead of the form in a different scenario, both while the session was open and after coaching; its links to the session, the coaching and pricing worked; a stale client that submitted the form anyway got `DAILY_LIMIT` from the server and then the card.
- Not rerun: the SQL tests (no SQL changed), the foundation tests, the voice round trip for the two new scenarios, and any physical-device check. Not measured: whether anyone comes back the next day.

Known rough edges: the counterpart sometimes refers to a setup fact before the user has said it; a new browser identity gets a new free session (see Protection for what now limits that).

### Pitch-readiness work, November 15, 2026

Checked against a **local production build** (a copy of the working tree, `next build` and `next start`) with the real Supabase project and real OpenAI models. **Not deployed**; the deployed URL still serves the earlier build.

- `npm test`: 34 passed, including streamed replies (mood first, sentences as soon as the next begins, stopping after three), coaching steps in order and when the coach retries, per-scenario rewrites, quote grounding, every live scenario having its own rewrites, example case and temperament lines, and a mood tag split from its words.
- Lint, TypeScript and the production build passed.
- SQL, in a disposable local PostgreSQL: the full schema with 003 folded in, the upgrade from the committed schema plus 003, rerunning 003, and the existing RLS and flow tests after the upgrade all passed. The rate limit allowed two hits and blocked the third; the timing summary's percentiles were right; the `authenticated` role could neither read timings nor call the rate limit; a bad mood or stage name was rejected.
- Live flows passed for all four live scenarios, now including a streamed reply and streamed coaching. Measured once each, locally: the first sentence was written at 1.8–2.1 s and its voice was ready at 3.7–5.5 s after the answer was sent (text-to-speech alone took 1.6–3.4 s per sentence; OpenAI's first byte is most of that); before, the whole reply took 3.4–4 s and a separate speech request about 3 s more. Coaching steps arrived at about 1.1 s (reading), 1.8 s (scoring), 3.3–3.7 s (changes), 4.7–4.8 s (moment) and 6.2–7.1 s (checking), with coaching saved at 6.6–8.3 s.
- The browser test passed against it: the example quick start, a temperament's line, a session started without any separate speech request, a recorded answer through the new piece-by-piece path and real Whisper, blocked playback with no browser voice (the reply stays readable and typing works), coaching steps, the retry tip, the comparison headline, reload, and 390 px layouts without horizontal overflow. In a separate Chrome check, the opening played through to its end, the mouth moved with it, and the unlock clip on the start tap no longer cut the opening off (a bug found and fixed here).
- Calibration, as in the table above.
- `public/demo.mp4` is a real session recorded with `scripts/record-demo.mjs` against that build and cut with `scripts/cut-demo.mjs` (waits cut, some moments sped up, nothing added). It is silent.
- **Not verified:** migration 003 on the real Supabase project (saved moods, the shared limit and `/speed` numbers there); any email actually sent or opened (the save and sign-in links, and the callback, were built to Supabase's documented API but no live email was sent); Turnstile end to end; the calendar file in Apple, Google or Outlook calendars; anything on a physical iPhone or Android device.

## Deploy to Vercel

1. Push the repository to your Git host and import it into Vercel as a Next.js project.
2. Select Node.js 22 and build command `npm run build`.
3. Set the environment variables above for the intended deployment environment. Apply the Supabase migration and enable anonymous sign-in first.
4. Deploy, then run the live acceptance checklist against the HTTPS URL.

This workspace is linked to `dastergtm-5519s-projects/askready`. For an authorized CLI deployment, run `node scripts/configure-vercel.mjs` to pipe the required environment values into the linked project's production environment, then `npx vercel deploy --prod`. Private keys are stored as Vercel secrets; `.vercelignore` excludes local env files, test artifacts, and raw recordings. The app is pinned to Node.js 22.

The feedback route declares `maxDuration = 120` to allow the structured pass plus one retry. Ensure the selected Vercel plan/runtime supports that duration. Other AI routes use bounded timeouts; recorder uploads stay below Vercel's request-body limit. No background worker or persistent local filesystem is required.

Rate limiting is shared across instances once migration 003 is applied; see [Protection](#protection) for the CAPTCHA and the OpenAI spending cap, which has to be set in OpenAI's dashboard. Quote speed from `/speed`, not from targets.
