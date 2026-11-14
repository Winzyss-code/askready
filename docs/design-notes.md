# AskReady design notes

Research was done with the Mobbin MCP before any code changed. These are the references that shaped the redesign, what was taken from each, and the decisions that followed.

## References

### 1. Meta AI, voice conversation
https://mobbin.com/screens/a13d716b-b9dc-4775-9934-b5c881b221a3

- **Layout:** one orb, the current line of speech set large beneath it, a "talk or type" field docked at the bottom.
- **Borrowed:** the manager's current line is the largest text on the practice screen, and typing sits in the same dock as the record button, so text never feels like a lesser path.
- **Left behind:** the multicolour gradient orb. Our manager is a flat disc in one ink.

### 2. Pi, "Pi is listening"
https://mobbin.com/screens/7f86354d-c06a-4c2f-8396-616c1ac2995c

- **Hierarchy:** a nearly empty screen. State is a short label, controls are round and sit low.
- **Borrowed:** one state label under the manager disc ("Your turn", "Listening", "Thinking", "Speaking") in place of status banners, and the rule that while you record, everything except the manager and the recorder dims.

### 3. Speak, roleplay lesson
https://mobbin.com/screens/bd1e2ff5-6a71-4579-b3c2-bd86055ef9f5

- **Layout:** scenario pill at the top, the other person's line as the focal bubble, a large mic button in the thumb zone.
- **Borrowed:** the record button is 80px, centred, and docked to the bottom edge on phones. The scenario and progress live in a thin strip above the conversation.

### 4. Speak, warm-up progress
https://mobbin.com/screens/4e0e5122-1a24-40a1-a51d-8412f223f941

- **Hierarchy:** "Question 3/9" with a slim segmented progress row.
- **Borrowed:** the six-pip answer counter in the play-clock strip ("Answer 2 of 6"), next to elapsed time.

### 5. Duolingo, roleplay feedback review
https://mobbin.com/screens/35a6f682-bab6-4fc2-be70-b5fa58792795

- **Hierarchy:** the key takeaway first, then your own lines annotated one by one.
- **Borrowed:** the feedback page opens with the overall result and a one-line read of strongest and weakest dimension. Each improvement quotes your own words before the rewrite.
- **Left behind:** mascots and celebration. The tone here is a coach's markup.

### 6. Hevy, workout comparison
https://mobbin.com/screens/0f91d578-7a46-466f-897c-08a505b17507

- **Layout:** two sides, each metric as a pair of bars with the difference stated as a number.
- **Borrowed:** the before/after board. Each dimension is a pair of bars on the same baseline (attempt 1 in grey, attempt 2 in ink) with a delta badge. Same baseline is what makes it readable in a glance.

### 7. State Farm, driving scorecard
https://mobbin.com/screens/651d6e8e-282e-4f0d-86ed-6de7efebb655

- **Spacing:** label left, bar in the middle, figure right-aligned to a hard edge, generous row height.
- **Borrowed:** the `ScoreBar` component: label, 8px bar, tabular figure tight to the right edge.

### 8. Future, coach-led onboarding
https://mobbin.com/flows/4581ab6f-c346-4d49-8167-e982a46d6eb7

- **Flow:** the coach asks one thing at a time, in a sentence, above each field group. A slim progress bar shows how much is left.
- **Borrowed:** the setup form is three numbered questions written the way a coach would ask them, with a live "3 of 5 answered" progress row. All fields stay on one page (see decisions).

### Also consulted
- **Vercel, split hero** (https://mobbin.com/sites/sections/892a4a8f-55b5-4bad-84b3-c77a538bcfb2): left-aligned promise with real product UI on the right. The landing hero follows this, using the actual practice components instead of a screenshot.
- **Headspace** (https://mobbin.com/sites/sections/a94d32f9-490d-4c2d-b3fe-a9beaa1e5044) and **Sketch** (https://mobbin.com/sites/sections/312580d5-9c82-48fd-9ef4-dbc6275c3768), two-plan pricing: two columns of equal weight, included items as a plain checklist. Pricing follows this, with planned Pro items marked differently from shipped Free items.
- **Babbel, lesson results** (https://mobbin.com/screens/8a2cc965-df95-4fc9-86f6-0cf612efb167): score first, then grouped detail.
- **Roku voice, anti-reference** (https://mobbin.com/screens/9fc48322-f53d-463a-bde8-f2a5a92825d3): the purple glow "Listening…" look that every assistant ships. This is the look the redesign avoids.

## Direction: Film Room

A coach's film session. Your rehearsal is the tape, the coach marks three moments, you run the hard one again, and the board shows what changed.

- **Ground:** whiteboard chalk white. No gradients, no glass.
- **Ink:** one dry-erase navy for type, bars and primary buttons.
- **Marker:** one telestrator yellow. It is the only colour that marks anything: the highlight on "Say this instead", the record clock, positive deltas, the current step.
- **Lines:** 1px court-line hairlines divide sections. Cards are used where content is a discrete object (an improvement, a persona, a plan), not as a default wrapper.
- **Figures:** scores are set in the display face with tabular numerals, right-aligned.
- **Voice:** the sports idea stays in structure. Copy is plain: "attempt", not "rep".

## Decisions

1. **Tokens live in `app/globals.css`.** The project uses Tailwind v4, which has no `tailwind.config` file; the theme is declared in CSS with `@theme`. Default Tailwind colours, type sizes, radii and shadows are reset there, so a class like `bg-stone-50` no longer exists and only tokens compile.
2. **Type:** Bricolage Grotesque (display, slightly condensed, weight 700) and Hanken Grotesk (text), both through `next/font`. Scale is 12/14/16/20/28/40/56.
3. **The manager is one disc.** Five marks inside it change shape per state: a low resting waveform (idle), a single dot on a white disc inside a marker ring that follows your microphone level (listening), three stepping dots inside a thin orbit ring (thinking), five tall marker-yellow bars inside a ring (speaking). The four states differ in silhouette and colour, so they are distinct even with motion turned off. An earlier flat line at rest read as five dashes in review and was replaced.
4. **The record button is a 90-second clock.** An 80px disc sits inside a 96px ring; the ring fills as the recording limit approaches, and the label under it says what a press will do. While the manager is speaking or thinking the button greys out and the label fades, so nothing reads as pressable; the accessible name stays "Record an answer". The waveform beside it is drawn from the real microphone signal. On phones the dock sticks to the bottom edge only when the viewport is at least 44rem tall, so short screens and open keyboards keep the manager's line visible.
5. **Setup is one page, not a hidden-step wizard.** A wizard would hide required fields from browser validation and from the existing end-to-end test. Grouped questions and a live progress row give the conversational feel without that cost. Fields validate when you leave them.
6. **The comparison is a table for assistive tech and a board for the eye.** ARIA table roles keep header, five dimensions and the average as rows; CSS lays them out as paired bars.
7. **One rewarding motion.** On the comparison, attempt 2 bars grow out from the attempt 1 value and the deltas settle in after. Nothing else on the page animates on load; notices and the field-valid check settle in over 240ms when they appear.
8. **Practice hides the marketing chrome.** On `/practice` the header drops its call to action and the footer is removed.
9. **Reduced motion** removes the bar growth, disc morph timing, skeleton shimmer and speaking loop. State is still readable from shape and label.
10. **The transcript is open, and never moves the page.** It is shown by default at every width and collapses from its heading. At desktop width it sits in the side column and scrolls inside itself; on phones it sits below the record dock. New lines never scroll the page, so the record button stays under your thumb.
11. **Feedback leads with one number, then the three changes.** The original rehearsal shows the average, the strongest and weakest dimension in a sentence, and five bars; reasoning sits behind a disclosure. Delivery observations are a separate, quieter section: phrase counts as dot rows and pace as a single marker on a slower–faster track.
12. **Loading is skeletons, never a spinner.** The practice space, the manager's next line, a transcription in progress and saved coaching each have a skeleton in the shape of what is coming.
13. **The landing mock is the real recorder, mid-answer.** The hero shows the practice screen in its recording state (listening disc, 0:12 on the clock, a still waveform), built from the same components and classes as the product, so the first thing a visitor sees is the thing they will do.
14. **The retry invitation is the one dark panel on the feedback page.** The explanation and the button sit on the left; the objection you will answer again is set large on the right. What comes after it ("Tomorrow, work on…") is a plain ruled section, not another card, so the retry stays the loudest thing below the three changes.
15. **Yellow marks, it never warns.** "Waitlist only" on Pro is an outline badge. Marker yellow is the mark: a highlight, the recorder, a gain, the one chosen or live thing, and focus. Caution and errors use the semantic colours.

## What did not change

API routes, data flow, validation rules, recording and transcription logic, speech playback, scoring and limits are untouched. The composer gained a read-only audio analyser on the microphone stream for the waveform; it does not alter what is recorded or sent. The unused `@fontsource-variable/dm-sans` and `@fontsource-variable/newsreader` packages were removed once the fonts moved to `next/font`. `scripts/design-shots.mjs` captures every screen and state at 390px and 1280px against mocked API responses; the mocks live only in that script.
