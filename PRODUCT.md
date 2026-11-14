# AskReady

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
User-specified: Next.js App Router, TypeScript, Tailwind, Vercel, Supabase anonymous auth and Postgres with RLS. Server-side OpenAI transcription, TTS, and an environment-configured LLM wrapper.

## Users
US adults aged 25–45 who avoid or dread hard conversations, at work and in life: asking for more, saying no, setting boundaries, giving honest feedback. They come with one conversation in mind and stay to get better at the next one.

## Product Purpose
A daily practice for hard conversations. Each session teaches one technique, rehearses it by voice against an AI counterpart who pushes back, coaches on the user’s exact words, and has them retry the hardest moment and compare both answers on the same rubric. Skill levels and days in a row, derived from saved sessions, give a reason to come back tomorrow.

## Capabilities and Constraints
Two tracks and seven scenarios in `config/scenarios.ts`; four are live (ask for a raise, the flagship; say no to extra work; give difficult feedback; set a boundary with a friend or family member) and three are labeled coming soon. Each scenario can name the counterpart temperaments that fit it. Every scenario is an ask met with pushback, so all share one rubric of five skills. Lessons are static copy we wrote, never generated. Turn-based voice with an always-available text fallback. The counterpart appears as a small animated character whose mouth follows the real audio and whose mood comes only from the model's tag on each reply, never from judging the user. No live scoring. Quotes must be real; rewrites must preserve facts. Scores and skill levels are coaching estimates, not validated measurements. Progress is computed from saved sessions on every request; nothing is seeded or stored separately. Free includes one session per UTC day (`config/plans.ts`, enforced in SQL); Pro is an honestly labeled $12.99/month waitlist with no payment anywhere in the app.

## Product Principles
- Verify each working checkpoint before starting the next.
- Preserve the retry and text fallback.
- Teach before testing: the technique comes before the rehearsal and is recapped after it.
- Show a number only when it comes from the user’s own saved sessions.
- Never simulate successful AI, billing, or database operations.
- Keep private keys server-side and user data isolated.

## Evidence on Hand
The user supplied the product requirements. There are no testimonials, measured latency claims, or verified outcome statistics. The planned Pro price and the “about 2–3 minutes” session length are our own estimates, not tested with users.

## Open Decisions
Which three scenarios to launch next, and whether progress should survive a browser change (it needs account linking, which is out of scope). The visual system is settled in `DESIGN.md`.
