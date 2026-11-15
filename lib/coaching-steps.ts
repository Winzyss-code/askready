// What the coach is doing while it writes feedback. The server reports each step only once its work has
// actually reached it (see structured() in lib/llm.ts); the browser shows the ones reported so far.
export type CoachingStep = "reading" | "scoring" | "changes" | "moment" | "checking" | "retrying" | "saving";
export const coachingStepLabels: Record<CoachingStep, string> = {
  reading: "Reading your answers",
  scoring: "Scoring five skills",
  changes: "Writing three changes",
  moment: "Picking the moment to retry",
  checking: "Checking every quote against your words",
  retrying: "A quote didn’t match your words exactly, so the coach is trying again",
  saving: "Saving your coaching",
};
