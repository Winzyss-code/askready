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

The models must be available to your OpenAI project. `.env.local` is ignored by Git. Never put the server secret or OpenAI key in a `NEXT_PUBLIC_` variable.

## Supabase setup

1. Create a Supabase project and copy its base URL and publishable/public key.
2. Enable **anonymous sign-ins** under Authentication → Sign In / Providers (dashboard labels may vary).
3. Apply the correct SQL in the Supabase SQL Editor:
   - **New, empty project:** run `supabase/schema.sql` once. It includes the full schema and practice RPCs.
   - **Existing checkpoint-1 installation:** run `supabase/migrations/002_practice.sql` once. Do not rerun the initial schema.
4. Add the server secret/service-role key to `.env.local` and restart the app.
5. Open the landing page to create an anonymous account, then start practice.

These are versioned, one-time migrations, not reset scripts. The application does not apply SQL automatically. Anonymous Supabase accounts use the `authenticated` Postgres role. The Data API must remain enabled.

## Product flow

0. **Pick a conversation:** the landing page lists two tracks and seven scenarios from `config/scenarios.ts`. Only scenarios marked `live` link to practice.
1. **Learn and set up:** the scenario's technique (three steps and a weak line beside a stronger one, static copy we wrote), then a short form: role, the ask, two supporting facts, the likely pushback, and the counterpart's temperament. Labels come from the scenario's config.
2. **Practice:** two to six answers, using voice or text. The counterpart (a manager, a teammate or a friend or relative, depending on the scenario) responds to the actual case in one to three short sentences. The technique stays available as a reminder. There is no live coaching or score meter.
3. **Feedback:** five coaching estimates, each grounded in an exact quote, plus three “You said / Say this instead / Why” improvements.
4. **Retry:** answer the same hardest **answered** objection again. Opening greetings and unanswered final questions cannot become the retry.
5. **Compare:** the selected original answer and retry are evaluated against the same objection, five dimensions, and scoring anchors. A lower retry score is shown honestly; improvement is not guaranteed.
6. **Tomorrow:** the weakest rubric dimension determines a specific next exercise, and the results page shows days in a row and the suggested next conversation.
7. **Progress:** `/progress` shows days in a row, a level from 1 to 4 for each of the five skills, and sessions per conversation. A new account sees an empty state with no numbers.

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

Tables are `sessions`, `turns`, `feedback`, and `waitlist`. The skills work added no tables, columns or migrations. Additions to the requested minimal schema support correctness: session status and request IDs, deterministic turn sequence and attempt, feedback focus containing the original objection/answer/baseline, and waitlist ownership. Feedback is unique per session and attempt.

**Authentication:** same-origin route handlers create and verify anonymous accounts using Supabase Auth. Access and refresh tokens stay in HTTP-only, SameSite=Lax cookies, marked Secure in production. Tokens are not returned in JSON or stored in localStorage. Closing a tab preserves access; clearing cookies or changing browsers can lose it. Account recovery/linking is outside this MVP.

**Authorization:** reads carry the verified user's JWT, so RLS enforces own-row access. Direct client writes are denied. Server writes use the service key only after identity verification. Practice RPCs receive the verified user ID and enforce ownership, state, ordering, idempotency, and quota in the database. RPC execution is restricted to `service_role`.

**Quota/concurrency:** an advisory transaction lock makes the one-session-per-UTC-day creation limit atomic. Request IDs prevent duplicate saved turns and sessions after retries. Database state/count checks reject concurrent stale writes; an in-process lock also reduces duplicate AI requests on one instance. Anonymous quotas are per identity, not per human: a new browser identity can evade them. Cross-instance duplicate AI generation can still consume provider tokens before the database resolves the race.

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

## Feedback integrity

The dimensions are clear request, evidence, structure, objection handling, and next step. Scores range from 0 to 100 with common anchors in `config/rubric.ts`. They are labeled **coaching estimates**; there is no confidence score or psychological inference.

The strong model returns strict structured JSON, validated with Zod. Invalid structure or ungrounded evidence triggers **one retry**, then a recoverable error. The prompt asks for one unbroken sentence per quote, because the model otherwise tends to stitch excerpts together with an ellipsis, which validation rejects. Network, provider authorization and quota errors surface without pretending feedback exists. Every evidence quote must be an exact contiguous substring of the relevant user answer(s).

Rewrites are deliberately conservative, and it shows: the fixed phrasing was written for a raise conversation and can read stiffly in the other two scenarios, especially the next-step rewrite. The model chooses a dimension and a supporting user statement; code composes the suggested answer from fixed phrasing and the user's supplied request/complete verbatim achievement or answer. Missing evidence becomes `[add a measurable result]`. This avoids accepting freely invented facts or stripping a negation from an excerpt. It does not verify whether the user's own statements are true. The model's explanation and numeric judgment remain subjective.

The structured schema restricts supporting statements to an enum of complete user-provided facts (or an empty value for the placeholder). This constraint prevents the provider from shortening or paraphrasing a fact before validation. Validation failures log only their category and schema path, never the transcript.

Comparison uses `feedback[0].focus.baselineScores` for the single original answer against `feedback[1].scores` for the retry. It does **not** compare a full-session score to a single-answer score.

## Voice and delivery observations

The interaction is turn-based. The browser chooses a supported MediaRecorder MIME type (including WebM/MP4), records for up to **90 seconds**, and limits uploads to **3.5 MB**. The API also bounds multipart bytes before parsing. Mic denial or an unsupported recorder leaves text entry available. Transcription is server-side Whisper; typed answers use the same practice flow.

Manager speech is **AI-generated**, disclosed in the interface. OpenAI TTS falls back to browser `speechSynthesis`, then text-only. Playback can require a user gesture on mobile browsers; the UI permits replay. Sessions persist transcripts and results, not raw audio files. Audio and text are still sent to OpenAI for processing and are subject to that provider's data policies. Browser fallback speech may use the browser/OS speech provider.

Delivery observations are calculated separately from scores: phrase-boundary filler/hedge counts and approximate words per minute using recorded user words divided by recorded duration. Text-only answers have no speaking pace. These are transcript observations: Whisper may remove fillers, “like” and “just” may be legitimate words, and pauses/edits affect pace. They do not measure vocal confidence, emotion, or assertiveness.

Short replies target roughly 3–5 seconds to first reply audio, but this is **a target, not a verified latency claim**. Logs report stage timing metadata only, never prompts, transcripts, keys or tokens.

The November 14 production smoke run measured roughly 3.7–4.8 seconds for `/api/turn`, 3.2 seconds for `/api/speak`, 3.6 seconds for `/api/transcribe`, and 8–9.3 seconds for feedback (single-run observations, not percentiles). The full sequential reply-audio path is therefore above the 3–5 second target. Speech fetches only the owned manager turn rather than reloading the entire session. `turn_total`, `transcribe_total`, and `speak_total` logs include route overhead as well as provider timings.

## Verification

Checkpoint 1 verified on November 14, 2026: lint, TypeScript, production build, missing-configuration/error smoke tests, and live Supabase anonymous sign-in, storage access, identity persistence, and refresh-token renewal passed. The full SQL schema and RLS ownership tests also passed in a disposable local PostgreSQL database. This does not establish that the deployed Supabase project's policies match the local migration, nor verify the later AI/voice flow.

```sh
npm run check                     # ESLint, TypeScript, production build
npm run test:foundation           # Build first; compiled route/error smoke tests
npm run test:foundation:live      # Build first; real Supabase Auth + storage check
npm test                         # Scoring, progress and LLM contract regressions
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
- [ ] Physical microphone/speaker check on Safari/iPhone and Android hardware.

Verified on November 14, 2026 at **https://askready-orcin.vercel.app**: live API flow and isolated Chrome browser acceptance both passed. The browser test completed voice + text → coaching → retry → comparison and reload with no page errors; mobile layouts had no horizontal overflow. The production dependency audit reported zero vulnerabilities; eight moderate advisories remain in development-only lint dependencies. Unit/contract tests: 15 passed. The schema, upgrade, RLS, quota, ordering and retry transaction tests passed in disposable PostgreSQL. Physical-device audio remains the explicit manual check above.

### Skills pivot, November 15, 2026

Checked against a **local production build** (`next build` and `next start`) using the real Supabase project and real OpenAI models. **None of this has been repeated on the deployed URL**, which still serves the build described above until the branch is deployed.

- `npm run check` passed. `npm test`: 21 passed, including five for `lib/progress.ts` (empty account, an unfinished session, days in a row across the UTC boundary, level boundaries and averaging, next-conversation order).
- The live flow passed for all three live scenarios (`raise`, `pushback`, `feedback`), including a new check that `/api/progress` matches the saved first-attempt scores and that a second account sees no progress.
- The browser test passed for the raise scenario.
- Later the same day, a fourth live scenario, “Set a boundary with a friend or family member”, was added. Its live flow passed against real models, including a new check that the counterpart never uses workplace or manager words. The first attempts failed: the counterpart sometimes took on the user’s side of the story and ran past the three-sentence limit, until the scenario prompt said whose side the setup is written from. In a 24-turn sample after that fix, about one reply in twelve still slipped partly into the user’s side. After the change, the raise and pushback flows passed again. The browser test failed once at the Whisper transcription step and passed on the rerun.
- The daily-limit card was checked once in a fresh Chrome profile with one real session: no card for a new account; card instead of the form in a different scenario, both while the session was open and after coaching; its links to the session, the coaching and pricing worked; a stale client that submitted the form anyway got `DAILY_LIMIT` from the server and then the card.
- Not rerun: the SQL tests (no SQL changed), the foundation tests, the voice round trip for the two new scenarios, and any physical-device check. Not measured: whether anyone comes back the next day.

Known rough edges: the rewrite templates were written for workplace asks, so in the boundary scenario they read like a negotiation (“What would you need from me to make a decision…”, “[add a measurable result]”); scoring is generous on decent answers (the anchors are coarse, so a solid first attempt can score 100 on several skills and leave little room to show improvement); the counterpart sometimes refers to a setup fact before the user has said it; a new browser identity gets a new free session.

## Deploy to Vercel

1. Push the repository to your Git host and import it into Vercel as a Next.js project.
2. Select Node.js 22 and build command `npm run build`.
3. Set the environment variables above for the intended deployment environment. Apply the Supabase migration and enable anonymous sign-in first.
4. Deploy, then run the live acceptance checklist against the HTTPS URL.

This workspace is linked to `dastergtm-5519s-projects/askready`. For an authorized CLI deployment, run `node scripts/configure-vercel.mjs` to pipe the required environment values into the linked project's production environment, then `npx vercel deploy --prod`. Private keys are stored as Vercel secrets; `.vercelignore` excludes local env files, test artifacts, and raw recordings. The app is pinned to Node.js 22.

The feedback route declares `maxDuration = 120` to allow the structured pass plus one retry. Ensure the selected Vercel plan/runtime supports that duration. Other AI routes use bounded timeouts; recorder uploads stay below Vercel's request-body limit. No background worker or persistent local filesystem is required.

Basic rate limiting is bounded, in-memory and per instance: it resets on redeploy and is not distributed abuse protection. Before public scale, add a shared limiter, Supabase CAPTCHA support, provider spend limits, and account recovery. Track model token/audio usage and real stage latency before promising a cost or speed target.
