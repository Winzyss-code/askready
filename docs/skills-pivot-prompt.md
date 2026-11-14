# Prompt for Claude Code: turn AskReady from a one-scenario tool into a skills gym

You are modifying an existing, working, deployed Next.js app called AskReady. Do not rebuild it. Read this whole brief before touching anything, then work through the steps in order, verifying and committing after each one.

## Why this change

I'm in a 24-hour hackathon (B2C, web only, US adults 25-45, solo). Judges weigh: 40% does it work end to end, 20% clear paid value and a reason to return tomorrow, 15% one clear user and pain, 15% why it makes money, 10% originality.

Today the app does one thing: rehearse asking for a raise. It reads as a one-trick tool. It tests the user but never teaches, has no progression, and gives no reason to come back tomorrow. The engine underneath is good and stays: turn-based voice or text roleplay, coaching grounded in the user's exact words, a retry of the hardest objection, and a before/after comparison on one rubric.

The new product: **AskReady is a daily speaking gym for the hard conversations at work.** Hero user: a capable professional who does good work but avoids hard conversations (doesn't ask, doesn't say no, softens feedback). One rep a day: learn one technique, rehearse it out loud against an AI counterpart who pushes back, get coached on your exact words, retry the hardest moment, and watch five skills level up over days.

The name AskReady stays. Every scenario is an ask met with pushback, which is exactly what the existing rubric (clear request, evidence, structure, objection handling, next step) measures. That is why this pivot is config plus a thin progress layer, and why scenarios that don't fit that shape (small talk, for example) are out of scope.

## Hard rules

1. **Nothing fake.** No mocked AI output, no seeded or invented user data, no fake payments, no invented statistics or testimonials. Progress numbers come only from the user's saved sessions. Anything illustrative on marketing pages stays labeled as an example, as it is now. Lesson text is human-authored static copy (given below); never present it as AI-generated or personalised.
2. **Do not weaken the feedback integrity code.** In `lib/scoring.ts` and `lib/llm.ts`, the exact-quote grounding, the `supportingFact` enum constraint, the code-assembled rewrites, the single retry on invalid output, and the Zod schemas stay as they are. You may change prompt wording about roles only.
3. **No database migration in steps 1-6.** Skill levels, streak and recommendations are derived from the existing `sessions` and `feedback` tables. The app does not apply SQL automatically, so any schema change needs me to run it by hand; only step 7 touches SQL and it is optional.
4. **Keep stored shapes stable.** Do not rename the `Setup` keys (`role`, `desiredRaise`, `achievements`, `objection`), the scenario ids `raise`, `pushback`, `feedback`, or the persona ids `budget`, `friendly`, `analyst`. Saved sessions, SQL tests and scripts depend on them. Relabel in the UI through config instead.
5. **Keep the raise scenario's form labels exactly as they are** ("Your job role", "What raise are you asking for?", "Achievement 1", "Achievement 2", "What might your manager say?", "Start my rehearsal") so the existing Playwright selectors keep working.
6. Follow `DESIGN.md`: existing tokens, type classes (`display`, `figure`, `mark`), and components in `components/ui/`. No new colors, fonts or dependencies. Match the code style already in each file.
7. Never log prompts, transcripts or keys. Keep secrets server-side.
8. Do not deploy and do not push. I will review and deploy myself.
9. If a step fails verification twice, stop and tell me what failed and what you tried, rather than working around it.

## Step 0: baseline

The repo has no commits yet. Run `git status` and confirm no `.env*` file other than `.env.example` would be staged, then commit everything as "Baseline before skills pivot". Run `npm run check` and `npm test` and record that both pass before you change anything. Commit again after each step below once its checks pass.

## Step 1: make the engine scenario-driven (config and prompts)

The engine is already keyed by `scenario_id` and `persona_id`, but manager/employee/raise wording is hardcoded in several places. Move it into config.

**New file `config/tracks.ts`:**

```ts
export const tracks = [
  { id: "ask", title: "Ask for more", description: "Make the case for what you've earned, and don't leave without a next step." },
  { id: "ground", title: "Hold your ground", description: "Say no, disagree, and give honest feedback without burning the relationship." },
] as const;
```

**`config/scenarios.ts`:** extend the `Scenario` type and replace `requestLabel` / `requestPlaceholder` with a `fields` object. Shape:

```ts
export type Scenario = {
  id: string; trackId: "ask" | "ground"; title: string; description: string; live: boolean;
  userRole: string;                               // "an employee asking their manager for a raise"
  counterpart: { role: string; label: string };   // role is used in prompts, label in UI ("Manager", "Teammate")
  opening: string;                                // prompt directive for the counterpart's first line
  systemPrompt: string;
  fields: {
    request: { label: string; placeholder: string };
    facts: { legend: string; hint: string; labels: [string, string]; placeholders: [string, string] };
    objection: { label: string; hint: string; placeholder: string };
  };
  lesson?: {                                      // required when live
    technique: string; summary: string;
    steps: { title: string; text: string; dimension: Dimension }[];
    weak: string; strong: string;
  };
};
```

Six scenarios, in this order. Three are live; the other three are `live: false` with title, description, track and sensible field/prompt config but no lesson. They stay off only because each live scenario must pass a real end-to-end run first.

| id | track | title | live | counterpart label |
| --- | --- | --- | --- | --- |
| `raise` | ask | Ask for a raise | yes | Manager |
| `promotion` | ask | Ask for a bigger role | no | Manager |
| `offer` | ask | Negotiate a job offer | no | Hiring manager |
| `pushback` | ground | Say no to extra work | yes | Manager |
| `feedback` | ground | Give difficult feedback | yes | Teammate |
| `credit` | ground | Speak up when someone takes credit | no | Coworker |

Every scenario uses the same conversation shape: the counterpart opens by inviting the user to start (one short line that fits the scenario), the user makes their case, the counterpart pushes back using the user's expected objection. `lib/scoring.ts` `answeredObjections` skips the opener and relies on this shape, so keep it.

Live scenario content (use this copy; tighten only for length):

**raise** (keep its existing labels and placeholders)
- systemPrompt: keep the current one, and move the "budget constraints, timing, or what results justify the request" examples here from the shared roleplay prompt.
- Lesson technique: "Ask, proof, next step". Summary: "A vague ask is easy to wave away. Say the number, back it with two results, and don't leave without a date."
- Steps: (1) "Say the number": "Open with the exact raise you want in one sentence. Then stop talking." → `clear_request`. (2) "Give two proofs": "Name two results you can support. Results, not effort." → `evidence`. (3) "Ask for the next step": "If the answer isn't yes, ask what would make it a yes, and by when." → `next_step`.
- Weak: "I've been working really hard this year, so I was hoping we could maybe look at my pay at some point?"
- Strong: "I'm asking for a 10% raise. I cut weekly reporting from five hours to three and trained two new colleagues. What would you need to see to approve it, and when can we decide?"

**pushback**
- userRole: "an employee telling their manager they can't take on additional work as asked". Counterpart role: "the user's manager, who wants them to take on more work".
- Fields: request label "What do you need instead?", placeholder "Move the vendor audit to next sprint". Facts legend "What's already on your plate?", hint "Two real commitments your manager can weigh against the new work.", labels "Commitment 1" / "Commitment 2". Objection label "What might your manager say?", placeholder "Everyone is stretched. I need you to make it work."
- systemPrompt: a workload conversation; the manager wants the extra work done, presses on urgency and team needs using the user's expected objection, and becomes willing to trade off priorities or timing when the user names specific commitments and offers a concrete choice. Never invents deadlines or company facts.
- Lesson technique: "Goal, trade-off, choice". Summary: "A bare no sounds like you don't care. A trade-off sounds like you're protecting the work."
- Steps: (1) "Agree with the goal": "Start with what you both want, so the no isn't personal." → `objection_handling`. (2) "Name the trade-off": "Say what is already on your plate and what would slip. Facts, not feelings." → `evidence`. (3) "Offer a choice": "Ask which one should move, or when you could take it on." → `next_step`.
- Weak: "I guess I can try to fit it in, I'm just pretty busy right now."
- Strong: "I want the launch to go well too. I'm already on the migration and the Q3 report, both due Friday. If I take this on, one of them slips. Which should move, or can this wait until Monday?"

**feedback**
- userRole: "someone giving difficult feedback to a teammate". Counterpart role: "the user's teammate, who is receiving difficult feedback about their work".
- Fields: request label "What do you need them to change?", placeholder "Send your section of the report by Thursday noon". Facts legend "What happened, specifically?", hint "Two concrete moments. Dates and details beat 'always' and 'never'.", labels "Example 1" / "Example 2". Objection label "How might they react?", placeholder "I've been swamped, and nobody told me it was urgent."
- systemPrompt: the teammate reacts like a real colleague: minimises, explains, or points to other causes, using the reaction the user expects; stays professional; concedes and agrees to something concrete once the user gives a specific example and a clear request. Never invents project facts.
- Lesson technique: "Example, impact, request". Summary: "Feedback lands when it's about one specific moment, not about the person."
- Steps: (1) "One specific example": "Describe what happened, once, with a detail. No 'always' or 'never'." → `evidence`. (2) "The impact": "Say what it caused for you or the team. Keep it factual." → `structure`. (3) "A clear request": "Say what you need to change, and agree when you'll check in." → `clear_request`.
- Weak: "You're always late with stuff and it's kind of becoming a problem for everyone."
- Strong: "Your section of the client report came in two days after the deadline last week, and I rewrote the summary overnight. I need your part by Thursday noon. Can we agree on that and check in next Friday?"

**`config/personas.ts`:** personas become temperaments that work for any counterpart. Keep ids. `budget` → name "The hard-liner", title "Tough and constraint-focused", description "Leads with limits: budget, time, priorities. Needs a concrete case." `friendly` → "The friendly deflector" (unchanged idea, drop the word "manager"). `analyst` → "The skeptic", "Asks what happened, what changed, and how you know." Rewrite each `systemPrompt` without the word "manager" or "employee"; the role now comes from the scenario.

**`config/rubric.ts`:** make the five `exercise` strings scenario-neutral (no "raise", no "manager"). Keep ids, labels, descriptions and `scoreAnchors`.

**`lib/llm.ts`:**
- `roleplay()`: build the system prompt from `scenario.counterpart.role`, `scenario.userRole`, `persona.systemPrompt`, `scenario.systemPrompt` and `scenario.opening`. Remove the hardcoded "You play a manager", "employee" and budget examples. Keep every guardrail sentence (stay in character, 1-3 sentences and 65 words, no coaching, no invented facts, untrusted content, professional) and keep the length validation.
- `evaluationRules` / `answerEvaluationRules`: say "the user" and "the counterpart" instead of "employee" and "manager". In `generateFeedback` and `generateRetryFeedback`, add one line of scenario context to the system message (title, user role, counterpart role). Do not change schemas, validation or the retry loop.
- Update user-facing error strings that say "manager" (here, in `lib/sessions.ts` `dbErrors`, `app/api/turn/route.ts`, `app/api/speak/route.ts`).

**UI strings that hardcode the old scenario:**
- `components/setup-form.tsx`: read labels, legends, hints and placeholders from `scenario.fields`; "Choose your manager" → "Choose who you're up against"; make the closing disclaimers role-neutral. The `nudges` validation messages should be neutral too.
- `components/practice-flow.tsx`: "AI manager", "Your manager is thinking…", "Hear the manager", "Your manager is speaking", the `"Your manager"` fallback and the aria-label should use the persona name or `scenario.counterpart.label`. If a `?session=` belongs to another scenario, redirect to that scenario's practice URL instead of throwing.
- `components/results-view.tsx`: transcript label "Manager" → the scenario's counterpart label (look the scenario up from `bundle.session.scenario_id`).
- `app/practice/[scenarioId]/page.tsx`: the coming-soon state should point to the live scenarios, not "a raise conversation".
- `components/practice-preview.tsx`: "The budget hawk" → "The hard-liner".

**Tests and scripts:** follow the existing pattern in `scripts/test-scoring.mjs` to add a config test: every scenario has a valid `trackId`; every live scenario has a lesson with 3 steps whose `dimension` exists in the rubric; ids are unique. Give `scripts/check-flow.mjs` a `--scenario=<id>` option with a fictional setup and answers per live scenario (default `raise`, unchanged). Check whether `scripts/test-llm.mjs` or `scripts/design-shots.mjs` assert on changed strings and update them.

**Verify step 1:** `npm run check`, `npm test`. Then start the dev server and run `npm run test:flow:live` once for each of `raise`, `pushback`, `feedback` (these use real, billable OpenAI calls and create throwaway anonymous accounts; that is expected). Read one transcript per new scenario yourself: the counterpart must stay in role (a teammate must not talk like a manager approving budgets), push back on the user's actual words, and the rewrites in the coaching must read naturally for that scenario. If the fixed rewrite templates in `lib/scoring.ts` `buildImprovements` read awkwardly for a scenario, fix it through the field placeholders that guide what users type into the request field, not by loosening the templates.

## Step 2: the micro-lesson (teach before testing)

The loop becomes: **Learn → Rehearse → Get coached → Retry → Level up.**

- New `components/lesson-card.tsx`: renders `scenario.lesson`: technique name, summary, the three steps, and the weak line beside the strong line (label them "Sounds like" / "Try instead", and caption them as an example we wrote). No AI call. Readable in under a minute.
- In `components/practice-flow.tsx`, the setup stage shows the lesson first, above the form, under a heading like "Today's technique". The form follows on the same page; do not add a separate route or a blocking step.
- During the conversation, the sidebar card ("Your intention") also lists the three step titles as a compact reminder under the user's request.
- On the results page, add a short "Technique you practiced" recap near the coaching: the three steps, each with the score of its related rubric dimension from this session, labeled as the related coaching estimate. No new model call.

**Verify step 2:** `npm run check`; view setup, practice and results at 1440px and 390px for all three live scenarios. No horizontal overflow.

## Step 3: landing page, copy and the three layout bugs

Rewrite `app/page.tsx` in place, config-driven, in this section order:

1. **Hero.** H1: "Say the hard thing at work. Practice it out loud first." (highlight the second sentence with the existing `mark`). Sub: "One short rep a day for the conversations you avoid: asking for more, saying no, giving honest feedback. Learn one technique, rehearse it by voice with an AI who pushes back, get coached on your exact words, then try again." CTA "Start today's rep" → first live scenario. Beside it: "One free rep a day. No signup form." Keep `PracticePreview` on the right.
2. **How a rep works.** Four steps: Learn one technique / Rehearse out loud / Get coached on your words / Retry and level up.
3. **Tracks.** One block per track from `config/tracks.ts`, listing its scenarios from config with "Available now" or "Coming soon" and a link for live ones. Replaces the current "Conversations worth preparing for" list.
4. **One objection. Two answers.** Keep the existing illustrative comparison and its "illustrative example" labeling.
5. **Why not just ask a chatbot?** Three short points, each true of the code today: every score quotes your exact words and is rejected if it doesn't; you retry the same objection and both answers are scored on the same rubric; your skill levels and streak carry across days. Do not name competitors and do not claim other products can't do these things.
6. **Pricing band** and 7. **privacy note**, updated for the new wording.

Fix these three bugs, and confirm each with a screenshot before and after at 1440px and 390px (use Playwright; `scripts/design-shots.mjs` shows the pattern):

- **Error banner in the hero.** `components/auth-status.tsx` renders a warning `Notice` inside the hero when anonymous sign-in fails or Supabase isn't configured. Remove `AuthStatus` from the landing page. `practice-flow.tsx`, `results-view.tsx` and `waitlist-form.tsx` already call `ensureClientAuth()` and show their own errors where the user needs them. Delete the component if nothing else uses it.
- **Misaligned highlight on the score.** In `components/comparison-board.tsx` the Attempt 2 average wraps a `figure`-class number in `.mark` (defined in `app/globals.css`), and the marker band sits off the digits. Fix the alignment for large figures (a figure-specific variant of the mark is fine) without changing how `.mark` looks on headline text.
- **Unbalanced "How it works".** The 5fr/7fr split leaves a short heading floating beside a tall list. Put the heading above and lay the four steps out as an even grid (four columns on desktop, stacked on mobile).

Also update: `app/layout.tsx` metadata (title "AskReady — Practice hard conversations out loud", matching description), `components/site-chrome.tsx` (header CTA "Start today's rep", footer line), and `tests/browser/practice.spec.ts` for the new hero heading and any changed link names.

**Verify step 3:** `npm run check`, `npm test`, and the Playwright browser test if Chrome is available (`node scripts/prepare-voice-fixture.mjs && npm run test:browser` against the running app).

---
**CUT LINE A.** If time is nearly gone, stop here: the app is already a multi-skill product that teaches. Skip to step 8.

---

## Step 4: progress derived from real sessions (the reason to return tomorrow)

No new tables. A "rep" is a session whose status is `feedback` or `complete`.

**New `lib/progress.ts`** (pure functions, no `server-only`, unit-testable like `lib/scoring.ts`). Input: the user's sessions with their attempt-0 feedback scores, plus `now`. Output:

```ts
type Progress = {
  totalReps: number;
  today: { used: boolean; sessionId: string | null; scenarioId: string | null; status: Session["status"] | null };
  streak: { current: number; week: { date: string; done: boolean }[] };   // last 7 UTC days
  skills: { id: Dimension; label: string; score: number | null; level: number | null; samples: number }[];
  scenarios: { id: string; reps: number; lastAt: string | null }[];
  next: { scenarioId: string; focus: Dimension | null };
};
```

- `today.used` means any session created since UTC midnight, whatever its status; this mirrors the quota in the `create_practice` SQL function.
- Streak: consecutive UTC days with at least one rep, ending today or yesterday (so it doesn't look broken before today's rep). UTC because the quota resets at UTC midnight.
- Skill score: the mean of that dimension's score over the user's most recent three reps, using attempt-0 (whole first conversation) scores only, since those measure what the user does before coaching. Level: 1 for 0-39, 2 for 40-59, 3 for 60-79, 4 for 80-100. `null` until there is at least one rep.
- Next rep: the live scenario practiced least recently (never-practiced first, in config order). `focus` is the user's lowest-scoring dimension, or `null` with no reps.

**New `app/api/progress/route.ts`** (GET, `requireUser`, user JWT so RLS applies, `Cache-Control: no-store`, same error shape as other routes). Load up to 60 recent sessions with feedback. Try a PostgREST embed (`sessions?select=id,scenario_id,status,created_at,feedback(attempt,scores)&order=created_at.desc&limit=60`); if the embed isn't available, use two queries.

**New `components/progress-panel.tsx`** (client; `ensureClientAuth()` then fetch) with three uses:
- **Landing hero**, compact, where `AuthStatus` used to be: for a user with at least one rep, show the streak and "Next rep: <scenario>" as a link. For a new user or on any error, render nothing.
- **New page `app/progress/page.tsx`** ("Your progress", linked from the header): streak with the 7-day row, the five skills as level plus `ScoreBar`, reps per scenario, and the next-rep card. Empty state for zero reps: one sentence and a link to the first scenario, no placeholder numbers. State plainly that levels are coaching estimates averaged from the user's last three first attempts.
- **Results page**: extend the existing "Tomorrow, work on …" section in `components/results-view.tsx` to show the streak and tomorrow's recommended scenario by name alongside the weakest-dimension exercise.

**Tests:** unit tests for `lib/progress.ts`: no sessions; a session still in `practice` counts for `today.used` but not as a rep; streak across consecutive UTC days; streak that ended two days ago is 0; level boundaries at 39/40, 59/60, 79/80; next-rep ordering.

**Verify step 4:** `npm run check`, `npm test`. In the running app, complete a real rep in a fresh browser profile and confirm the landing strip, `/progress` and the results page all show numbers that match that session's saved scores.

## Step 5: the daily limit as an honest paywall moment

- Today a user who has used their free session can fill in the whole setup form for another scenario and only then get `DAILY_LIMIT`. Fix: in the setup stage of `components/practice-flow.tsx`, use `/api/progress`. If `today.used` and there's no session to resume in this scenario, show a card instead of the form: "That's today's rep", a link to resume or review today's session (in whichever scenario it belongs to), when the next rep unlocks (midnight UTC), tomorrow's recommended scenario, and "Pro will remove the daily limit. It isn't for sale yet." with a link to `/pricing`. The lesson stays readable. Keep the server-side checks as the source of truth and still handle a `DAILY_LIMIT` response.
- `app/pricing/page.tsx`: Free = one full rep a day (lesson, rehearsal, coaching, retry, comparison), all live scenarios, skill levels and streak, voice or text. Pro (planned, waitlist only, $12.99/month planned): unlimited reps a day for the night before a real conversation, every track and scenario as they launch, tougher counterparts and longer conversations, full progress history. Keep every existing honesty statement: nothing is charged, joining the waitlist turns nothing on.
- New `config/plans.ts` holding the free daily limit (1, with a comment that it must match `create_practice` in `supabase/schema.sql`) and the planned Pro price; use it wherever copy states either number.

**Verify step 5:** in one browser profile, finish a rep, open a different scenario, and confirm the limit card appears before any form, with working links. `npm run check`, `npm test`.

## Step 6: docs

Update `PRODUCT.md` (users, purpose, capabilities) and `README.md` (intro, product flow, architecture list, API table, the new tests) to describe what now exists. Keep the README's existing candor about what is and isn't verified; do not claim verification you did not perform.

---
**CUT LINE B.** Everything below is optional. Only start it if all checks are green and I confirm there is time.

---

## Step 7 (optional): extras, in this order

1. **Add-to-calendar for tomorrow's rep.** On the results page, a link that downloads a small `.ics` (or opens a Google Calendar template URL) for tomorrow with the recommended scenario and the site URL. Generated client-side, no new dependency, no email collection.
2. **Level-up moment.** On the results page, if this session moved any skill to a higher level (compute progress with and without this session), say so in one line. Only when it actually happened.
3. **A fourth live scenario.** Write a lesson for `promotion`, flip it live, and pass the live flow for it.
4. **Configurable free limit.** Only if I ask: write `supabase/migrations/003_daily_limit.sql` that replaces `create_practice` with a `p_daily_limit integer default 1` parameter (re-apply the revoke/grant lines for the new signature and mirror the change in `supabase/schema.sql` and `supabase/tests/flow.sql`), read the limit from `config/plans.ts`, and keep the app working against the old function until I confirm I have run the SQL. Stop and ask me to apply it.

## Step 8: final verification and handoff

Run `npm run check`, `npm test`, `node scripts/check-secrets.mjs` (after a build), the live flow for each live scenario, and the browser test if available. Then report:

- what changed, by step, and which steps were skipped;
- the output of each check, including anything that failed or that you could not run;
- anything in the copy you were unsure was true of the product;
- the exact commands I should run to deploy and to smoke-test production.

## Acceptance criteria

- The original raise flow works exactly as before: setup → voice or text rehearsal → grounded coaching → same-objection retry → comparison → reload persists.
- `pushback` and `feedback` complete the same flow against real models, with the counterpart in the right role and no "manager"/"raise" wording leaking into the wrong scenario anywhere in UI, prompts or errors.
- Adding or enabling a scenario requires editing only `config/scenarios.ts`.
- Every live scenario shows its lesson before the form; the technique is visible during practice and recapped in results.
- The landing page presents two tracks and six scenarios, three available; no error banner in the hero; the score highlight sits on the digits; "How a rep works" is an even four-step layout; nothing overflows at 390px.
- `/progress`, the landing strip and the results page show streak, levels and next rep computed only from the user's saved sessions; a new user sees an empty state with no numbers.
- A user who has used today's rep sees the limit card before filling in any form, with a path to their session, tomorrow's rep and the Pro waitlist. No payment UI exists anywhere.
- `npm run check` and `npm test` pass. No new dependencies, no schema change (unless step 7.4 was explicitly requested), no secrets in client bundles.
