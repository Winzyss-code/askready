import { z } from "zod";
import { rubric } from "@/config/rubric";
import type { DeliveryStats, Dimension, Improvement, Scores, Setup, Turn } from "@/types/domain";

export const dimensionSchema = z.enum(["clear_request", "evidence", "structure", "objection_handling", "next_step"]);
const scoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  quote: z.string().min(1).max(500),
  reason: z.string().min(1).max(500),
}).strict();
export const scoresSchema = z.object({
  clear_request: scoreSchema,
  evidence: scoreSchema,
  structure: scoreSchema,
  objection_handling: scoreSchema,
  next_step: scoreSchema,
}).strict();

// The AI chooses the weakness and supporting excerpt. It never writes unchecked
// factual prose into the user's proposed answer: code assembles the rewrite.
export const improvementPlanSchema = z.object({
  quote: z.string().min(1).max(600),
  dimension: dimensionSchema,
  supportingFact: z.string().max(600),
  why: z.string().min(1).max(600),
}).strict();
export type ImprovementPlan = z.infer<typeof improvementPlanSchema>;

export function isExactQuote(quote: string, sources: string[]) {
  return quote.trim().length > 0 && sources.some((source) => source.includes(quote));
}

export function assertGroundedScores(scores: Scores, sources: string[]) {
  for (const dimension of rubric) {
    if (!isExactQuote(scores[dimension.id].quote, sources)) {
      throw new Error(`Score quote is not an exact user excerpt: ${dimension.id}`);
    }
  }
}

function sentence(value: string) {
  const trimmed = value.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** Facts stay verbatim. This is deliberately more conservative than free rewrites. */
export function buildImprovements(plans: ImprovementPlan[], setup: Setup, userSources: string[]): Improvement[] {
  const factualSources = [...setup.achievements, ...userSources];
  return plans.map((plan) => {
    if (!isExactQuote(plan.quote, userSources)) throw new Error("Improvement quote is not an exact user excerpt");
    // A substring could silently drop a negation ("did not increase sales").
    // Require the entire supplied achievement/answer, not a favorable fragment.
    if (plan.supportingFact && !factualSources.includes(plan.supportingFact)) {
      throw new Error("Supporting fact is not a complete verbatim user statement");
    }
    const fact = plan.supportingFact ? sentence(plan.supportingFact) : "[add a measurable result].";
    const request = sentence(setup.desiredRaise);
    const templates: Record<Dimension, string> = {
      clear_request: `Here is what I'm asking for: ${request}`,
      evidence: `Here is the evidence I can point to: ${fact}`,
      structure: `My request: ${request} My evidence: ${fact} What would be the next step?`,
      objection_handling: `I understand the concern. Here is the evidence I can point to: ${fact} What would we need to resolve before moving forward?`,
      next_step: "What would you need from me to make a decision, and when can we revisit this?",
    };
    return { quote: plan.quote, rewrite: templates[plan.dimension], why: plan.why };
  });
}

function countWords(text: string) {
  return text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function countPhrases(texts: string[], phrases: readonly string[]) {
  return Object.fromEntries(phrases.map((phrase) => {
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${phrase.replaceAll(" ", "\\s+")}(?![\\p{L}\\p{N}])`, "giu");
    return [phrase, texts.reduce((count, text) => count + (text.match(pattern)?.length ?? 0), 0)];
  }));
}

/** Lexical observations, not psychological measurements. No audio is analyzed. */
export function deliveryStats(turns: Turn[]): DeliveryStats {
  const userTurns = turns.filter((turn) => turn.role === "user");
  const spoken = userTurns.filter((turn) => typeof turn.audio_duration_ms === "number" && turn.audio_duration_ms > 0);
  const texts = userTurns.map((turn) => turn.text);
  const recordedWordCount = spoken.reduce((total, turn) => total + countWords(turn.text), 0);
  const audioDurationMs = spoken.reduce((total, turn) => total + (turn.audio_duration_ms ?? 0), 0);
  return {
    wordCount: userTurns.reduce((total, turn) => total + countWords(turn.text), 0),
    recordedWordCount,
    audioDurationMs,
    wordsPerMinute: audioDurationMs > 0 ? Math.round(recordedWordCount * 60_000 / audioDurationMs) : null,
    fillers: countPhrases(texts, ["um", "uh", "like", "you know", "basically"]),
    hedges: countPhrases(texts, ["maybe", "I think", "kind of", "sort of", "I guess", "just"]),
  };
}

export function nextExercise(scores: Scores) {
  return rubric.reduce((weakest, item) => scores[item.id].score < scores[weakest.id].score ? item : weakest);
}

export function answeredObjections(turns: Turn[]) {
  const original = turns.filter((turn) => turn.attempt === 0).sort((a, b) => a.sequence - b.sequence);
  return original.flatMap((turn, index) => {
    const answer = original[index + 1];
    // The initial manager opener has no employee case to challenge yet.
    if (index === 0 || turn.role !== "assistant" || answer?.role !== "user") return [];
    return [{ objection: turn, answer }];
  });
}
