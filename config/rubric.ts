import type { Dimension } from "@/types/domain";

// Anchors are per skill and deliberately strict: 100 needs every part of its line, so a decent first answer
// lands around 50–75 and a retry has room to show the change. They are scenario-neutral: "the ask" is a raise,
// a trade-off, a change or a boundary, depending on the conversation. scripts/calibration.mjs checks them.
type Anchors = Record<0 | 25 | 50 | 75 | 100, string>;
export const rubric: { id: Dimension; label: string; description: string; exercise: string; anchors: Anchors }[] = [
  {
    id: "clear_request", label: "Clear request", description: "States the desired outcome explicitly and specifically.", exercise: "Say what you want in one direct sentence, then stop.",
    anchors: {
      0: "No ask at all, or it contradicts itself.",
      25: "The ask is only implied or hinted at (\"maybe we could look at it\"), or the only request is to meet or talk about it.",
      50: "The ask is named but not specific (\"a raise\", \"my compensation\", \"be on time\"), or buried under apology or hedging (\"I don't think I can\").",
      75: "A specific ask, but hedged, softened into a question, or stated after a long lead-in.",
      100: "One direct sentence with the exact ask: an amount, a date, or a precise behavior, with no hedging.",
    },
  },
  {
    id: "evidence", label: "Evidence", description: "Connects relevant, specific facts or results to the request.", exercise: "Explain two specific facts that support your request. Use only details you can support.",
    anchors: {
      0: "No supporting facts.",
      25: "Only general claims about effort or character (\"I work hard\", \"you always do this\").",
      50: "One concrete fact or moment, with no number or date, and at most a vague outcome (\"it caused problems\").",
      75: "Concrete facts with a specific outcome, but nothing measured or dated; or one measured or dated fact on its own.",
      100: "At least two concrete facts, one of them with a number or a date, and a result tied to the ask.",
    },
  },
  {
    id: "structure", label: "Structure", description: "Presents an organized, concise answer.", exercise: "Practice a 45-second answer: your request, two reasons, then one next step.",
    // The model reads structure loosely unless it counts the three parts first.
    anchors: {
      0: "None of the three parts: an explicit ask, at least one supporting fact, and a next step.",
      25: "One of the three parts, or the parts are mixed together and repeated.",
      50: "Two of the three parts, or all three with a lot of padding.",
      75: "All three parts, but out of order or longer than it needs to be.",
      100: "All three parts, in the order ask, support, next step, in about 80 words or fewer.",
    },
  },
  {
    id: "objection_handling", label: "Objection handling", description: "Addresses the other person's actual concern with a relevant response.", exercise: "Name the other person’s concern, address it with a fact, and propose a practical way forward.",
    anchors: {
      0: "Never mentions the concern, gives in completely, or argues with the person.",
      25: "Deflects or concedes (\"I understand, never mind\") without answering the concern. An apology alone is not an acknowledgment.",
      50: "Acknowledges the concern itself but does not answer it, or answers a different concern.",
      75: "Acknowledges the concern and answers it with a fact, but offers no way forward that fits it.",
      100: "Names the concern in their terms, answers it with a specific fact, and offers a concrete way forward that fits it.",
    },
  },
  {
    id: "next_step", label: "Next step", description: "Asks for a decision, timeline, or concrete follow-up.", exercise: "Close with a specific follow-up date and ask what needs to happen before then.",
    anchors: {
      0: "No next step; the answer just ends.",
      25: "A vague hope (\"hopefully we can figure it out\").",
      50: "Asks to revisit or talk again, with no time and no decision asked for.",
      75: "Asks for a decision or commitment with a vague or missing time (\"soon\", \"later this year\"), or sets a specific time only to talk.",
      100: "Asks for a decision, a commitment or an agreement to a concrete offer, tied to a specific day, date or deadline (\"by Friday\", \"at our 1:1 on the 15th\").",
    },
  },
];

export const scoreAnchors = `Score each skill on its own anchors (in the rubric below). The anchors are cumulative: a score needs everything in its line. Write the reason first: name the highest anchor line the user's words fully meet and what is missing for the next line; then give the score. Give 100 only when every part of the 100 line is present in the user's words. When an answer meets one line and part of the next, give an integer in between (for example 60 or 85); when unsure, give the lower one. Apply the same anchors to every attempt. Score only observable wording, never personality, accent, identity or internal confidence. Facts from the setup count only when the user actually says them. For clear request, judge the ask this conversation is about (the setup's request), as the user words it.`;
