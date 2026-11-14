---
name: AskReady
description: Practice asking for a raise, get coaching on your own words, retry the hardest moment, compare the two attempts.
colors:
  ink: "#14213a"
  ink-hover: "#24365c"
  marker: "#e4f03e"
  marker-hover: "#d3e02a"
  paper: "#f4f5f1"
  surface: "#fdfdfb"
  neutral-100: "#eceee9"
  neutral-200: "#dfe2dd"
  neutral-300: "#c3c8ca"
  neutral-400: "#7f899b"
  neutral-500: "#586379"
  neutral-600: "#3a455c"
  success: "#1c6b45"
  success-soft: "#dcefe2"
  warning: "#8a5300"
  warning-soft: "#f9ecd2"
  error: "#b3261e"
  error-soft: "#fbe6e3"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.5rem"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 88"
  headline:
    fontFamily: "Bricolage Grotesque, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 88"
  title:
    fontFamily: "Bricolage Grotesque, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 88"
  figure:
    fontFamily: "Bricolage Grotesque, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "'tnum', 'lnum'"
    fontVariation: "'wdth' 88"
  lead:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.45
  body:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.5
  caption:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "8px"
  lg: "16px"
  full: "9999px"
spacing:
  unit: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "40px"
  3xl: "64px"
  section: "96px"
  section-lg: "128px"
  gutter: "16px"
  gutter-sm: "32px"
  shell: "72rem"
  measure: "36rem"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
  button-accent:
    backgroundColor: "{colors.marker}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
    height: "48px"
  button-accent-hover:
    backgroundColor: "{colors.marker-hover}"
  button-secondary:
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
    height: "48px"
  button-secondary-hover:
    backgroundColor: "{colors.neutral-100}"
  button-ghost:
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
    height: "48px"
  button-ghost-hover:
    backgroundColor: "{colors.neutral-100}"
  button-disabled:
    backgroundColor: "{colors.neutral-200}"
    textColor: "{colors.neutral-500}"
  button-sm:
    typography: "{typography.label}"
    padding: "8px 16px"
    height: "44px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "48px"
  field-disabled:
    backgroundColor: "{colors.neutral-100}"
    textColor: "{colors.neutral-500}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  panel-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "40px"
  badge-neutral:
    backgroundColor: "{colors.neutral-100}"
    textColor: "{colors.neutral-600}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "24px"
  badge-outline:
    textColor: "{colors.neutral-600}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "24px"
  badge-marker:
    backgroundColor: "{colors.marker}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "24px"
  badge-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "24px"
  badge-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    rounded: "{rounded.sm}"
  badge-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    rounded: "{rounded.sm}"
  badge-error:
    backgroundColor: "{colors.error-soft}"
    textColor: "{colors.error}"
    rounded: "{rounded.sm}"
  badge-lg:
    typography: "{typography.body}"
    padding: "0 12px"
    height: "32px"
  notice-info:
    backgroundColor: "{colors.neutral-100}"
    textColor: "{colors.neutral-600}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "16px"
  notice-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.neutral-600}"
    rounded: "{rounded.md}"
    padding: "16px"
  notice-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.neutral-600}"
    rounded: "{rounded.md}"
    padding: "16px"
  notice-error:
    backgroundColor: "{colors.error-soft}"
    textColor: "{colors.neutral-600}"
    rounded: "{rounded.md}"
    padding: "16px"
  counterpart-character:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    accentColor: "{colors.marker}"
    size: "7rem"
  record-control:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.full}"
    size: "96px"
  record-control-recording:
    backgroundColor: "{colors.marker}"
    textColor: "{colors.ink}"
  record-control-off:
    backgroundColor: "{colors.neutral-200}"
    textColor: "{colors.neutral-500}"
  score-bar-track:
    backgroundColor: "{colors.neutral-200}"
    rounded: "{rounded.full}"
    height: "8px"
  score-bar-fill:
    backgroundColor: "{colors.ink}"
    rounded: "{rounded.full}"
  score-bar-fill-muted:
    backgroundColor: "{colors.neutral-400}"
    rounded: "{rounded.full}"
  skeleton:
    backgroundColor: "{colors.neutral-200}"
    rounded: "{rounded.sm}"
---

# Design System: AskReady

Recorded from the shipped build (`app/globals.css`, `app/layout.tsx`, `components/`), after the finish review. Tailwind v4 reads its theme from the `@theme` block in `app/globals.css`; the default palettes, type sizes, radii and shadows are reset there, so only the tokens above compile. Light mode only: `color-scheme: light` is set and no dark theme exists.

## Overview

**Creative North Star: "The Film Room"**

A rehearsal is game tape. The coach marks the moment, you run it again, and the board shows what changed. The surface is a whiteboard: chalk-white ground, one dry-erase navy for everything written and everything pressed, and a single telestrator yellow that behaves like a marker stroke over the tape. Sections are divided by court-line hairlines, numbers are set like a scoreboard, and nothing glows.

The sports idea lives in structure and marks only. Copy stays plain and warm ("attempt", never "rep"); the counterpart character is the only figure, and there is no celebration, no gradients and no glass. Practice and results screens are operational and quiet; the landing and pricing pages are built from the same parts, including a still of the real recorder as the hero illustration, so the first thing shown is the thing done.

Scores are coaching estimates and are always labelled as such; example content on marketing surfaces is labelled illustrative. Lower scores are stated as plainly as gains.

**Key Characteristics:**
- Flat chalk paper, navy ink, one yellow marker; no gradients, no glass, no glow.
- Hairlines divide; a card is a discrete object, never a default wrapper.
- Scoreboard figures: display face, tabular lining numerals, tight to an edge.
- One counterpart character whose posture and face change with state and mood; one record control that is also a clock.
- Short ease-out transitions; exactly one rewarding motion (the attempt-2 bars).
- State is always readable from shape plus a text label, never from colour or motion alone.

## Colors

A two-colour system on a tinted white: navy ink does the work, yellow marks, and every neutral leans towards the ink's hue.

### Primary
- **Dry-Erase Ink** (`ink`): all body and display type, primary buttons, the counterpart character, score-bar fills, filled progress pips, and the one dark panel a page may carry. `ink-hover` is its only lighter step, used on hover of ink surfaces.

### Secondary
- **Telestrator Yellow** (`marker`): the mark. It appears as the stroke under the coach's rewrite and under the few words that matter (the hero phrase, the stated intention, the attempt-2 average), as the recording state of the record control and its clock arc, as a positive delta badge, as the chosen/live indicator (selected manager tick, "Available now", "Focused retry"), as the speaking bars of the manager disc, as the accent button on an ink panel, and as the focus halo and text selection. `marker-hover` is its hover step on the accent button.

### Tertiary
- **Status Green / Amber / Red** (`success`, `warning`, `error`, each with a `-soft` ground): status only. The strong value is the icon or badge text; the soft value is the notice or badge ground. Notice body copy sits in `neutral-600` on the soft ground. A score drop uses the warning badge; a failed request uses error; a satisfied field and the ready dot use success.

### Neutral
- **Chalk Paper** (`paper`): the page ground and the text colour on ink.
- **Board Surface** (`surface`): cards and fields; one step brighter than paper.
- **neutral-100**: hover grounds, the user's transcript bubble, info notices, neutral badges, disabled field ground.
- **neutral-200**: hairlines, card borders, bar tracks, skeletons, disabled button ground.
- **neutral-300**: stronger rules between list rows, empty pips, the resting record-ring track, resting waveform dots, dashed empty-state border.
- **neutral-400**: control borders (fields, secondary buttons), the attempt-1 bar, decorative step numerals. Not a body-text colour.
- **neutral-500**: quiet text: hints, captions, the "You said" quote, attempt-1 figures.
- **neutral-600**: secondary text: lead paragraphs, nav links, notice copy.

### Named Rules
**The Marker Rule.** Yellow marks; it never warns. Status is carried by the semantic colours. A waitlist, a limit or a denied microphone is an outline badge or a warning notice, not a yellow one.

**The Ink-Under-Marker Rule.** Yellow never carries meaning alone on paper. It always sits behind or beside ink: a stroke under ink text, a disc with an ink glyph, a ring around an ink border. Text on marker is always ink.

**The One Ink Rule.** There is one dark colour. Primary actions, type, bars and the dark panel are all the same navy; hierarchy comes from size, weight and the neutral scale, not from a second brand colour.

## Typography

**Display Font:** Bricolage Grotesque (falls back to Hanken Grotesk, then ui-sans-serif, system-ui)
**Body Font:** Hanken Grotesk (falls back to ui-sans-serif, system-ui)

Both load through `next/font/google` with `display: swap`; Bricolage loads its width axis.

**Character:** A heavy, slightly condensed grotesque for headings and figures against a calm, open text grotesque. The display face is always weight 700 at 88% width with tight tracking; the text face does everything else at 400, 500 and 600.

The scale is seven sizes: 12 / 14 / 16 / 20 / 28 / 40 / 56 px.

### Hierarchy
- **Display** (700, 56px, 1.02): page headline at 640px and wider on landing and pricing, and at 1024px and wider on setup and results. Also the large average figures on the comparison at desktop.
- **Headline** (700, 40px, 1.08): the same headlines below those widths; plan prices; error and empty page titles.
- **Title** (700, 28px, 1.2): section headings and numbered setup questions. The landing steps its section headings up to 40px at 1024px.
- **Figure** (700, tabular lining numerals, line-height 1, tracking -0.02em): scores, clocks, counts and prices, at 16, 20, 28, 40 or 56px depending on rank. A unit beside a figure ("/100", "wpm", "/ 1:30") drops to the text face at 14 or 16px, weight 400, in `neutral-500`.
- **Lead** (400 or 500, 20px, 1.45): the paragraph under a headline (400, `neutral-600`); the manager's current line, the rewrite and quoted objections (500, ink). On the practice screen at 1024px the manager's line steps up to 28px with snug leading; it is the largest text on that screen.
- **Body** (400, 16px, 1.6): running copy, held to the 36rem measure.
- **Label** (600, 14px, 1.5): field labels, row headers, small headings such as "You said" and "Say this instead", button-sm text. Weight 400 at this size is the hint and helper text.
- **Caption** (400 or 600, 12px, 1.5): badges, column headers, speaker names in the transcript, fine print.

The wordmark and the practice strip title use the display face at 20px.

### Named Rules
**The Scoreboard Rule.** Any number that can change or be compared is tabular. Ranked figures use the display face; inline counts ("2 of 6 answers", "0 / 3,000") keep the text face with tabular numerals.

**The Sentence-Case Rule.** No uppercase and no letter-spaced labels anywhere. Small headings are sentence-case, weight 600, and differ from body by weight and colour only.

## Layout

A single shell (max-width 72rem) is centred with 16px gutters, 32px from 640px. Running text is held to a 36rem measure. Spacing sits on a 4px unit; the steps in regular use are 4, 8, 12, 16, 24, 32, 40 and 64px, with 96px (128px from 1024px) between landing sections and 64px between results sections.

Breakpoints are 640px (sm), 768px (md) and 1024px (lg). Everything is one column below lg. At lg, pages split asymmetrically rather than into equal halves: 7fr/5fr for the hero, 5fr/7fr for heading-left, content-right sections and for setup, a fluid column plus a 22rem rail on practice, and a 16rem figure column plus a fluid column for the score summary. Column gaps are 64px (48px on practice). The left heading column on setup and the right rail on practice are sticky.

Lists of like things (steps, scenarios, reasoning rows) are ruled rows, not card grids: a top hairline per row, a closing hairline on the last.

The practice screen is a strip, a stage and a dock. The strip is a ruled band carrying the scenario title, six answer pips with "n of 6 answers", and elapsed time. The stage holds the manager disc, name, a one-line state label and the manager's current line. The dock is the record control with a text field beneath it, separated by a top hairline; below lg it bleeds to the screen edges and sticks to the bottom only when the viewport is at least 44rem tall, so short screens and open keyboards keep the manager's line visible. On phones the recorder is centred with the waveform and clock above it; from 640px it sits left with the waveform beside it. While recording, the strip, the finish row and the rail drop to 50% opacity; the manager and the recorder do not.

The comparison is two halves around a centre rail at md and wider: attempt 1 left in `neutral-500`, attempt 2 right in ink, a vertical hairline between them carrying the average delta. Beneath it, one row per dimension: label, attempt-1 figure and bar, attempt-2 figure and bar, delta right-aligned in a 6rem column. Below md each row stacks label and delta on one line with the two bars beneath, and a small legend replaces the column headers.

Interactive targets are at least 44px tall; default buttons and fields are 48px.

## Elevation & Depth

Flat. Depth is tonal: paper, then the slightly brighter surface inside a 1px `neutral-200` border, then ink for the one dark panel. Hairlines, not shadows, separate things.

### Shadow Vocabulary
- **Lift** (`box-shadow: 0 8px 24px -8px rgb(20 33 58 / 0.2)`): the retry invitation panel on the feedback page.
- **Float** (`box-shadow: 0 28px 56px -20px rgb(20 33 58 / 0.32)`): the product still in the landing hero, the only object presented as a picture of the product.

Both are ink-tinted. Rings drawn with `box-shadow` (the focus halo, the outline badge, the selected manager card's inset ring) are outlines, not elevation.

### Named Rules
**The Flat Board Rule.** Cards, fields, buttons and badges carry no shadow at rest or on hover. A shadow is reserved for at most one object per page that is deliberately lifted off the board.

## Shapes

Three corner radii and the circle. Small marks (badges, skeleton lines, link focus shape) take 4px. Controls and cards (buttons, fields, cards, notices, transcript bubbles) take 8px. The dark panel and the hero still take 16px. Everything that is a signal rather than a container is fully round: the manager disc, the record control, bars and their tracks, pips, dots, the brand mark, the selection tick.

Borders are always 1px. `neutral-200` is the hairline and the card edge; `neutral-300` rules list rows; `neutral-400` outlines controls; ink closes the comparison table above its average row and outlines the chosen manager card. A dashed `neutral-300` border appears only on an empty state.

The recurring silhouette is a disc with short vertical bars: the brand mark (three yellow bars on an ink disc) and the microphone waveform are the same figure. The counterpart character keeps the disc's ink mass and adds a face.

**The Marker Stroke.** The highlight is a flat yellow band across the lower half of the text line (0.5em tall, anchored at 88% of the line box), extended 0.15em past the text at each end and cloned across line breaks. It is never a full background, an underline or a box.

## Components

Controls are plain and firm: flat fills, 1px borders, a 1px press, no shine.

### Buttons
- **Shape:** gently rounded (8px), 48px minimum height, 12px by 20px padding, 16px weight-600 label, 8px gap to a 16px trailing or leading icon. The small size is 44px tall, 8px by 16px, 14px label.
- **Primary:** ink fill, paper text; hover lightens to `ink-hover`. One per view where possible.
- **Accent:** marker fill, ink text; hover `marker-hover`. Used only on an ink panel, where primary would disappear.
- **Secondary:** transparent with a `neutral-400` border; hover darkens the border to ink and fills `neutral-100`.
- **Ghost:** text only; hover fills `neutral-100`.
- **Pressed:** moves down 1px and scales to 0.985. **Disabled:** `neutral-200` fill, `neutral-500` text, no border.
- **Transitions:** colour properties 180ms, transform 150ms, on the shared ease-out curve.
- **Text link:** weight 600, underlined (1px, offset 0.2em); hover thickens the underline to 2px. Used for secondary navigation beside a button ("Return home") and for disclosures.

### Badges
- **Style:** 24px tall, 4px corners, 12px weight-600 text, no wrap. A large size (32px, 16px text) is used for the average delta on the centre rail.
- **Tones:** neutral (`neutral-100`), outline (1px inset `neutral-300` ring), marker, ink, success, warning, error.
- **Delta badge:** a gain is marker with "+n"; a drop is warning with "−n"; no change is outline with "No change". Always tabular.

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** surface on paper.
- **Shadow Strategy:** none (see The Flat Board Rule).
- **Border:** 1px `neutral-200`.
- **Internal Padding:** 20px for small cards (intention, resume), 20px rising to 32px at 640px for improvement cards and plans, 20px rising to 40px for the landing example.
- **Used for:** an improvement, a manager persona, a plan, the stated intention, a saved session, the example comparison. Everything else is a ruled section.
- **Selectable card (manager choice):** a whole-card label with a 48px round icon seat, name with a title badge, description, and a 24px round tick. Chosen: ink border plus a 1px inset ink ring, icon seat turns ink with a marker glyph, tick turns marker with an ink check, title badge turns ink. Unchosen hover: `neutral-400` border on `neutral-100`.
- **Improvement card:** a `neutral-400` figure numeral at the left; "You said" (quote in `neutral-500`) beside "Say this instead" (20px weight-500 quote under the marker stroke) in a 2fr/3fr split from 768px; "Why:" beneath a hairline.
- **Ink panel:** 16px corners, ink ground, paper text with `neutral-200`/`neutral-300` secondary text and `neutral-500` rules, 24px padding rising to 40px. Holds the accent button. At most one per page.

### Inputs / Fields
- **Style:** surface fill, 1px `neutral-400` border, 8px corners, 48px minimum height, 12px by 16px padding; placeholder in `neutral-500`. Text areas resize vertically; the answer field grows with its content up to 14rem.
- **Label:** 14px weight 600 above the control, 8px gap; a small success check settles in at the label's right when the field passes.
- **Hover / Focus:** border darkens to ink; keyboard focus adds the global focus ring.
- **Error:** border turns error; one 14px error line replaces the hint beneath. Fields validate when left, never while typing.
- **Disabled:** `neutral-300` border, `neutral-100` fill, `neutral-500` text.

### Focus
Every focusable element gets a 2px ink outline at 2px offset inside a 6px marker halo, so the ring reads on paper and on ink alike.

### Navigation
A 64px header inside the shell: the wordmark (brand disc plus "AskReady" in the display face at 20px) at the left; at the right a 14px weight-600 `neutral-600` "Pricing" link that turns ink on hover, and a small primary button from 640px. On practice routes the button and the footer are removed so nothing competes with the conversation. The footer is a single hairline, one line of `neutral-500` text and one link.

### Notices
An inline message: tone icon (20px) at the left, optional weight-600 title, 14px body in `neutral-600`, 8px corners, 16px padding, on the tone's soft ground (info uses `neutral-100`). It settles in (4px rise and fade, 240ms). One next action may sit inside it. Page-level failures are not notices: they are a 32px error icon, a display heading, one sentence, a primary retry button and a "Return home" link.

### Loading
Skeletons, never a spinner. `neutral-200` blocks with 4px corners in the shape of what is coming (a disc and lines for the practice space, three lines for the manager's next reply, three short bars inside the answer field while transcribing, a figure and rows for saved coaching) with a slow shimmer (1.6s linear). A text status line always accompanies them.

### Progress pips
A row of 6px-tall fully round segments, ink when done and `neutral-300` when not, always beside a tabular text count ("3 of 5 answered", "2 of 6 answers").

### Score bar
An 8px fully round track in `neutral-200` with an ink fill (or `neutral-400` for attempt 1). As a summary row: weight-600 label in a 10rem column, bar, then a 20px figure right-aligned to the edge; on phones the label and figure share a line above the bar.

### Counterpart character (signature)
One small ink creature drawn in a 100-unit SVG (`components/Character.tsx`): a rounded body, a short antenna with a marker tip, two paper eyes with ink pupils, paper brows and a paper mouth. It is not human and has no other colours. Sizes match the old disc: 7rem on the practice stage at desktop, 4.5rem on phones, on the setup step and in the hero still. The box never changes size between states, so nothing around it moves.
- **States (posture and gaze):** idle breathes slowly (4.2s) and blinks every three to six seconds; listening leans in, the pupils widen, and it nods with the live microphone level; thinking tilts back, looks up and aside, with three `neutral-400` dots stepping upward; speaking bobs gently while the mouth follows the voice.
- **Moods (brows, mouth, cheeks):** neutral; skeptical (one brow up, a sideways mouth); warm (soft brows, a smile, marker cheeks); impatient (brows pulled down, a flat mouth, a small repeated tap); impressed (brows up, a smile, marker cheeks); concerned (brows pulled up, a small frown), which is ours alone and shows only beside an error or an unavailable microphone.
- **Temperaments:** one small difference each. The hard-liner has heavy, lowered brows; the deflector soft arched brows; the skeptic thin brows and `neutral-300` glasses; the guilt-tripper brows set high in the middle.
- **Where moods come from:** only from the mood tag the model puts on each reply, limited to the moods that fit the temperament. The character never reacts to how well the user is doing. Text-only playback stays neutral and never moves its mouth.

Its mouth is drawn outside React, one frame at a time, from the playing audio. The character is decorative when unlabelled; on the practice stage it carries an accessible name with the counterpart and state, and the text state label beside it ("Your turn", "Listening", "Speaking", "Your manager is thinking…") is still the live status.

### Record control (signature)
A 96px ring around an 80px disc, with a weight-600 label beneath that says what a press will do. The ring is a 90-second clock: a marker arc fills clockwise from the top as the limit approaches.
- **Ready:** ink disc, paper microphone, `neutral-300` ring track; hover lightens the disc. Label "Record an answer".
- **Recording:** marker disc, ink stop square, ink ring track with the marker arc. Label "Stop recording". Beside it, a waveform drawn from the real microphone signal (3px ink bars on a 6px pitch, resting as `neutral-300` dots) and the elapsed figure with "/ 1:30".
- **Waiting** (microphone permission, transcribing, sending) and **Off** (manager speaking or thinking): `neutral-200` disc, `neutral-500` glyph; transcribing swaps the microphone for an ellipsis. The label fades to transparent so nothing reads as pressable, except while waiting for permission, when it reads "Waiting for microphone…". The accessible name stays in place throughout.

Pressing scales the control to 0.96. Finish is a separate button set apart beneath a hairline, never beside the recorder. If voice is unavailable the recorder row is hidden, a warning notice explains, and the text field opens to four rows.

### Transcript
A panel in the practice rail under a heading that is also its toggle ("Transcript" with a tabular line count and a chevron). It is open by default and collapses from the heading. From 1024px it is capped at 24rem and scrolls inside itself, pinned to the newest line, so the page and the recorder do not move; below that it sits under the dock and flows with the page. Manager lines are flush left with an 8px ink dot, a 12px weight-600 name and `neutral-600` text; the user's lines are indented 32px in a `neutral-100` bubble with 8px corners. Empty, it is a single dashed-border line of `neutral-500` text.

### Comparison board (signature)
Described in Layout. For assistive technology it is a table (ARIA table, row, header and cell roles) with a caption; for the eye it is paired bars on a shared baseline. The attempt-2 average carries the marker stroke; every delta is a delta badge.

### Disclosures
Secondary detail (score reasoning, the original answer, the full transcript) sits behind a native disclosure whose summary is a text link with a chevron that rotates when open.

### Motion
- **Transitions:** 150 to 250ms on one ease-out curve, `cubic-bezier(0.22, 1, 0.36, 1)`; the default is 180ms. Colour and border changes use 180ms, presses 150ms, the recording dim and label fade 200ms, disc colour changes and the settle-in 240ms.
- **Signal-bound motion** runs only while its state is true: the character's breathing, blinking, nods, thinking dots and mouth, the clock arc (linear between ticks), the skeleton shimmer.
- **The one rewarding motion:** on the comparison, each attempt-2 bar grows out from the attempt-1 value when it scrolls into view (0.7s, same curve, staggered 80ms per row from 150ms), and the average delta settles in after 500ms. Nothing else animates on arrival.
- **Reduced motion:** all CSS animations and transitions are switched off and the scripted motions run at zero duration; the character holds still expressions (speaking is a half-open mouth, with no blinking or nodding) and the waveform samples more slowly. The rendered DOM is identical in both modes, and every state remains readable from shape and label.

## Do's and Don'ts

### Do:
- **Do** keep yellow for the mark: the coach's highlight, the recorder, a gain, the one chosen or live thing, focus. Put ink on or beside it every time.
- **Do** divide sections with a 1px hairline and reach for a card only when the content is a discrete object (an improvement, a persona, a plan, a saved session).
- **Do** set every score, clock, count and price in tabular numerals, with ranked figures in the display face and their unit in small `neutral-500` text.
- **Do** give every state a shape and a text label. The character's states and the record control must stay distinguishable in a still frame.
- **Do** show loading as a skeleton in the shape of the coming content, with a status sentence.
- **Do** keep the text path equal to voice: the field sits in the same dock as the recorder and is always available.
- **Do** state a lower score as plainly as a gain (warning delta badge), and label estimates and illustrative examples as what they are.
- **Do** keep targets at 44px or taller and the focus ring (ink outline inside a marker halo) on every focusable element.
- **Do** write in sentence case with plain words; say "attempt".

### Don't:
- **Don't** use yellow as a warning or status tone, as body text, or alone on paper without ink.
- **Don't** add a second accent or a second dark colour; status colours are for status only.
- **Don't** use gradients, glass, blur or glow. The ground is flat and the only shadows are the two named lifts.
- **Don't** wrap sections in cards by default or nest a card inside a card.
- **Don't** use uppercase, letter-spaced labels or the display face below 16px.
- **Don't** use a spinner, or animate anything on arrival other than the attempt-2 bars and their delta.
- **Don't** change what is rendered under reduced motion; change only timing.
- **Don't** let sports language into the copy, add any figure besides the counterpart character, or add celebration.
- **Don't** put more than one ink panel on a page, or place Finish beside the record control.
- **Don't** add a dark theme by inverting these tokens; none was designed or built.
